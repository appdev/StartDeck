// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ItabWeatherWidget from "./ItabWeatherWidget.vue";

const response = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  } as Response);

describe("ItabWeatherWidget", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
