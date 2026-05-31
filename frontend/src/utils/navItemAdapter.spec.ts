import { describe, expect, it } from "vitest";
import {
  createNavItemFromCustomIcon,
  createNavItemFromSiteShortcut,
  normalizeNavIconBackground,
} from "./navItemAdapter";
import { STARTDECK_SITE_SHORTCUT_CATALOG } from "./siteShortcutCatalog";

describe("navItemAdapter", () => {
  it("maps site shortcut catalog entries into valid NavItem drafts", () => {
    const result = createNavItemFromSiteShortcut(
      STARTDECK_SITE_SHORTCUT_CATALOG.find((item) => item.id === "github")!,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.navItem).toMatchObject({
        title: "GitHub",
        url: "https://github.com",
        icon: "",
        iconBackgroundMode: "auto",
      });
      expect(result.navItem).not.toHaveProperty("isPublic");
    }
  });

  it("normalizes custom icon drafts and rejects empty drafts", () => {
    expect(createNavItemFromCustomIcon({ title: "", url: "" }).ok).toBe(false);

    const result = createNavItemFromCustomIcon({
      title: "Example",
      url: "example.com/app",
      icon: "",
      iconCustomBackgroundColor: "#ABC",
      iconBackgroundMode: "custom",
      iconSize: 500,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.navItem.title).toBe("Example");
      expect(result.navItem.url).toBe("https://example.com/app");
      expect(result.navItem.icon).toBe("");
      expect(result.navItem.iconCustomBackgroundColor).toBe("#aabbcc");
      expect(result.navItem.iconSize).toBe(220);
    }
  });

  it("creates StartDeck-owned text icon data URLs for custom icon drafts", () => {
    const result = createNavItemFromCustomIcon({
      title: "Docs",
      url: "docs.example.com",
      iconText: "文",
      useTextIcon: true,
      iconCustomBackgroundColor: "#1890ff",
      iconBackgroundMode: "custom",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.navItem.icon).toContain("data:image/svg+xml");
      expect(decodeURIComponent(result.navItem.icon)).toContain("文");
      expect(decodeURIComponent(result.navItem.icon)).toContain("#1890ff");
    }
  });

  it("falls back to auto background when custom color is invalid", () => {
    expect(
      normalizeNavIconBackground({
        iconBackgroundMode: "custom",
        iconCustomBackgroundColor: "javascript:alert(1)",
        iconAutoBackgroundColor: "#0369a1",
      }),
    ).toMatchObject({
      iconBackgroundMode: "auto",
      iconAutoBackgroundColor: "#0369a1",
      iconCustomBackgroundColor: "",
    });
  });
});
