// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ItabWeatherOpenedPanel from "./ItabWeatherOpenedPanel.vue";
import ItabWeatherWidget from "./ItabWeatherWidget.vue";
import {
  resetItabWeatherRuntimeForTests,
  resolveItabWeatherSkinClass,
} from "./useItabWeatherRuntime";
import { resetItabIpRuntimeForTests } from "@/features/itab-ip/useItabIpRuntime";

const response = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  } as Response);

describe("ItabWeatherWidget", () => {
  afterEach(() => {
    resetItabWeatherRuntimeForTests();
    resetItabIpRuntimeForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads current weather through the backend proxy and renders iTab size UI", async () => {
    const fetchMock = vi.fn((rawUrl: string | URL | Request) => {
      const url = String(rawUrl);
      expect(url).toContain("/api/itab/weather/current");
      expect(url).toContain("location=101280601");
      return response({
        sourceStatus: "ok",
        current: {
          status: "ok",
          now: {
            tmp: "31",
            cond_txt: "晴",
            cond_code: "100",
            hum: "60",
            pres: "1002",
            wind_dir: "南风",
            wind_sc: "2",
          },
          air_now_city: { qlty: "优", aqi: "22" },
          sun: { rise: "05:40", set: "18:59" },
          daily_forecast: [
            {
              date: "2026-05-22",
              tmp_max: "33",
              tmp_min: "26",
              cond_txt_d: "晴",
              cond_code_d: "100",
              wind_sc: "2",
            },
          ],
        },
        hourly: {
          updateTime: "2026-05-22T10:30+08:00",
          hourly: [
            { fxTime: "2026-05-22T11:00+08:00", temp: "32", icon: "100" },
          ],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ItabWeatherWidget, {
      props: {
        sizeKey: "1x2",
        widget: {
          id: "weather",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
          data: {
            runtime: "itab-weather",
            version: 1,
            sizeKey: "1x2",
            location: {
              id: "101280601",
              city: "深圳",
              province: "广东省",
              type: "city",
            },
          },
        },
      },
    });

    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.attributes("data-itab-weather-size")).toBe("1x2");
    expect(
      wrapper
        .find(".weather-icon-content")
        .classes()
        .some((className) => /^weather-sunny_[dn]$/.test(className)),
    ).toBe(true);
    expect(wrapper.text()).toContain("深圳");
    expect(wrapper.text()).toContain("31°");
    expect(wrapper.text()).toContain("晴");
  });

  it("uses the shared IP lookup as the default weather location without requesting the weather location endpoint", async () => {
    const fetchMock = vi.fn((rawUrl: string | URL | Request) => {
      const url = String(rawUrl);
      if (url.includes("/api/ip")) {
        return Promise.resolve(
          Response.json({
            success: true,
            ip: "163.125.214.27",
            country: "中国",
            region: "广东省",
            adm2: "深圳",
            city: "龙华",
            district: "龙华",
            weatherLocationId: "101280608",
            weatherLocationType: "city",
            latitude: "22.696667",
            longitude: "114.045422",
            cached: true,
          }),
        );
      }
      expect(url).toContain("/api/itab/weather/current");
      expect(url).toContain("location=101280608");
      return response({
        sourceStatus: "ok",
        current: {
          status: "ok",
          now: {
            tmp: "28",
            cond_txt: "阴",
            cond_code: "104",
          },
          daily_forecast: [
            {
              date: "2026-05-22",
              tmp_max: "30",
              tmp_min: "26",
              cond_txt_d: "阴",
              cond_code_d: "104",
              wind_sc: "2",
            },
          ],
        },
        hourly: {
          updateTime: "2026-05-22T10:30+08:00",
          hourly: [
            { fxTime: "2026-05-22T11:00+08:00", temp: "28", icon: "104" },
          ],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ItabWeatherWidget, {
      props: {
        sizeKey: "1x2",
        widget: {
          id: "weather-ip-default",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
          data: {
            runtime: "itab-weather",
            version: 1,
            sizeKey: "1x2",
          },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("/api/itab/weather/location"))).toBe(
      false,
    );
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/api/ip?"),
        expect.stringContaining("/api/itab/weather/current"),
      ]),
    );
    expect(urls.find((url) => url.includes("/api/ip"))).not.toContain(
      "refresh=1",
    );
    expect(wrapper.text()).toContain("龙华");
    expect(wrapper.text()).toContain("28°");
  });

  it("falls back to the weather location endpoint when IP lookup has no weather location", async () => {
    const fetchMock = vi.fn((rawUrl: string | URL | Request) => {
      const url = String(rawUrl);
      if (url.includes("/api/ip")) {
        return Promise.resolve(
          Response.json({
            success: true,
            ip: "127.0.0.1",
            country: "本机",
            region: "本地网络",
            city: "本机",
            cached: false,
          }),
        );
      }
      if (url.includes("/api/itab/weather/location")) {
        return response({
          id: "101280601",
          name: "深圳",
          adm1: "广东省",
          adm2: "深圳",
          type: "city",
          location: "114.05,22.55",
        });
      }
      expect(url).toContain("/api/itab/weather/current");
      expect(url).toContain("location=101280601");
      return response({
        sourceStatus: "ok",
        current: {
          status: "ok",
          now: {
            tmp: "31",
            cond_txt: "晴",
            cond_code: "100",
          },
          daily_forecast: [
            {
              date: "2026-05-22",
              tmp_max: "33",
              tmp_min: "26",
              cond_txt_d: "晴",
              cond_code_d: "100",
              wind_sc: "2",
            },
          ],
        },
        hourly: {
          updateTime: "2026-05-22T10:30+08:00",
          hourly: [
            { fxTime: "2026-05-22T11:00+08:00", temp: "32", icon: "100" },
          ],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ItabWeatherWidget, {
      props: {
        sizeKey: "1x2",
        widget: {
          id: "weather-ip-fallback",
          type: "itab-weather-00",
          enable: true,
          isPublic: true,
          data: {
            runtime: "itab-weather",
            version: 1,
            sizeKey: "1x2",
          },
        },
      },
    });

    await flushPromises();
    await flushPromises();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/api/ip?"),
        expect.stringContaining("/api/itab/weather/location"),
        expect.stringContaining("/api/itab/weather/current"),
      ]),
    );
    expect(wrapper.text()).toContain("深圳");
    expect(wrapper.text()).toContain("31°");
  });

  it("maps source weather codes to fixed source skin classes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00+08:00"));
    const daySample = {
      condition: "晴",
      sunrise: "00:00",
      sunset: "23:59",
    };

    expect(resolveItabWeatherSkinClass({ ...daySample, code: "150" })).toBe(
      "weather-sunny_d",
    );
    expect(resolveItabWeatherSkinClass({ ...daySample, code: "304" })).toBe(
      "weather-rain_d",
    );
    expect(resolveItabWeatherSkinClass({ ...daySample, code: "999" })).toBe(
      "weather-other",
    );
  });

  it("keeps the closed weather cover on source fixed skin colors", () => {
    const source = readFileSync(
      "src/features/itab-weather/ItabWeatherWidget.vue",
      "utf8",
    );
    const themeSource = readFileSync("src/assets/main.css", "utf8");

    expect(source).toContain(".weather-icon-content {");
    expect(source).toContain(
      "--sd-theme-itab-weather-weather-opened-panel-scene-base",
    );
    expect(themeSource).toContain(
      "--sd-theme-itab-weather-weather-opened-panel-scene-base: #184482;",
    );
    expect(source).toContain(
      "color: var(--sd-theme-itab-weather-weather-widget-text-01);",
    );
    expect(source).toContain(
      "--sd-theme-itab-weather-weather-opened-panel-scene-sunny-day",
    );
    expect(themeSource).toContain("#154280 30%");
    expect(themeSource).toContain("#335693");
    expect(themeSource).toContain("#a8b3d2");
    expect(source).toContain(
      "--sd-theme-itab-weather-weather-opened-panel-scene-cloudy-day",
    );
    expect(themeSource).toContain("#054989 30%");
    expect(themeSource).toContain("#72ade0");
    expect(source).toContain(
      "--sd-theme-itab-weather-weather-opened-panel-scene-yin-day",
    );
    expect(themeSource).toContain("#354564 30%");
    expect(themeSource).toContain("#4c5f7f");
    expect(themeSource).toContain("#8b9bb8");
    expect(source).toContain(
      'background-image: url("/itab/weather/background/cloud.webp");',
    );
    expect(source).toContain("opacity: 0.6;");
    expect(source).toContain(".weather-icon-content.weather-other");
  });

  it("keeps current weather in runtime cache until the user opens it after five minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T02:00:00+08:00"));
    const fetchMock = vi.fn(() =>
      response({
        sourceStatus: "ok",
        current: {
          status: "ok",
          now: {
            tmp: String(30 + fetchMock.mock.calls.length),
            cond_txt: "多云",
            cond_code: "101",
          },
          daily_forecast: [
            {
              date: "2026-05-27",
              tmp_max: "33",
              tmp_min: "27",
              cond_txt_d: "多云",
              cond_code_d: "101",
              wind_sc: "2",
            },
          ],
        },
        hourly: {
          updateTime: "2026-05-27T02:00+08:00",
          hourly: [
            { fxTime: "2026-05-27T03:00+08:00", temp: "30", icon: "101" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const widget = {
      id: "weather-cache",
      type: "itab-weather-00",
      enable: true,
      isPublic: true,
      data: {
        runtime: "itab-weather",
        version: 1,
        sizeKey: "1x2",
        location: {
          id: "101280608",
          city: "龙华",
          province: "广东省",
          type: "city",
        },
      },
    };

    const wrapper = mount(ItabWeatherWidget, {
      props: {
        sizeKey: "1x2",
        widget,
      },
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const openedBeforeTtl = mount(ItabWeatherOpenedPanel, {
      props: { widget },
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-05-27T02:05:01+08:00"));
    const openedAfterTtl = mount(ItabWeatherOpenedPanel, {
      props: { widget },
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    openedBeforeTtl.unmount();
    openedAfterTtl.unmount();
  });
});
