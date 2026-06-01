// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import IconShape from "./IconShape.vue";
import { useConfigStore } from "@/stores/config";

describe("IconShape", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("renders stable seed icons without transient cache-busting params", () => {
    const config = useConfigStore();
    config.resourceVersion = 123456;

    const wrapper = mount(IconShape, {
      props: {
        shape: "rounded",
        icon: "/assets/seed-icons/nav/github.svg",
      },
    });

    const image = wrapper.find("image");
    expect(image.attributes("href")).toBe("/assets/seed-icons/nav/github.svg");
  });
});
