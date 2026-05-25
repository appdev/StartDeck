<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import type { ItabWidgetSizeKey } from "@/features/itab-widgets/itabSizePresets";
import { isItabWallpaperCopyrightVisible } from "./itabWallpaperModel";
import { useItabWallpaperRuntime } from "./useItabWallpaperRuntime";

const props = defineProps<{
  widget?: WidgetConfig;
  sizeKey: ItabWidgetSizeKey;
}>();

const widgetRef = computed(() => props.widget || null);
const runtime = useItabWallpaperRuntime(widgetRef);
const activeWallpaper = computed(() => runtime.featuredWallpaper.value);
const wallpaperDescription = computed(() =>
  activeWallpaper.value
    ? [
        activeWallpaper.value.title,
        activeWallpaper.value.location,
        `© ${activeWallpaper.value.credit}`,
      ]
        .filter(Boolean)
        .join(" ")
    : "",
);
const wallpaperStyle = computed<Record<string, string>>(() => ({
  "--wallpaper-image": activeWallpaper.value
    ? `url("${activeWallpaper.value.thumbnailUrl}")`
    : "none",
}));
const showCopyright = computed(
  () =>
    Boolean(activeWallpaper.value) &&
    isItabWallpaperCopyrightVisible(props.sizeKey),
);
</script>

<template>
  <span
    class="itab-wallpaper-widget"
    :class="[`is-size-${sizeKey}`, { 'has-copyright': showCopyright }]"
    :style="wallpaperStyle"
    data-itab-wallpaper-widget
    :data-itab-wallpaper-size="sizeKey"
    :data-itab-wallpaper-id="activeWallpaper?.id || ''"
    :data-itab-wallpaper-source-status="runtime.sourceStatus.value"
  >
    <span class="wallpaper-image" aria-hidden="true"></span>
    <span
      v-if="showCopyright"
      class="wallpaper-copyright"
      :title="wallpaperDescription"
    >
      <span class="wallpaper-copyright-text">{{ wallpaperDescription }}</span>
    </span>
  </span>
</template>

<style scoped>
.itab-wallpaper-widget {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sd-theme-itab-wallpaper-wallpaper-widget-accent-surface-01);
  color: var(--sd-theme-itab-wallpaper-wallpaper-widget-text-01);
  font-family:
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    sans-serif;
  letter-spacing: 0;
}

.wallpaper-image {
  position: absolute;
  inset: 0;
  background: var(--wallpaper-image) center/cover no-repeat;
}

.wallpaper-copyright {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  box-sizing: border-box;
  display: block;
  height: 40px;
  min-width: 0;
  overflow: hidden;
  background: var(--sd-theme-itab-wallpaper-wallpaper-widget-surface-01);
  color: var(--sd-theme-itab-wallpaper-wallpaper-widget-text-02);
  padding: 5px 10px 6px;
  font-size: 10.5px;
  font-weight: 400;
  line-height: 14px;
  text-shadow: 0 1px 2px
    var(--sd-theme-itab-wallpaper-wallpaper-widget-shadow-01);
  text-overflow: ellipsis;
  white-space: normal;
}

.wallpaper-copyright-text {
  display: -webkit-box;
  max-height: 28px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.is-size-1x2 .wallpaper-copyright {
  height: 26px;
  padding: 2px 8px 3px;
  font-size: 10px;
  line-height: 12px;
}

.is-size-1x2 .wallpaper-copyright-text {
  max-height: 24px;
}

.is-size-2x4 .wallpaper-copyright {
  width: min(62%, 210px);
  border-top-right-radius: 10px;
  background: var(--sd-theme-itab-wallpaper-wallpaper-widget-surface-02);
}
</style>
