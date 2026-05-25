<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import WidgetSizeVariantPreview from "@/components/home/WidgetSizeVariantPreview.vue";
import WidgetRuntimeFrame from "@/features/widget-runtime/WidgetRuntimeFrame.vue";
import { isRuntimeWidget } from "@/features/widget-runtime/widgetRuntimeRegistry";
import {
  isItabWidgetSizeKey,
  withItabGridData,
} from "@/features/itab-widgets/itabGrid";
import {
  createWidgetFromCatalog,
  getWidgetCatalogItem,
  type WidgetCatalogItem,
  type WidgetCatalogSizePreset,
} from "@/utils/widgetCatalog";
import type { WidgetConfig } from "@/types";

const query = computed(() =>
  typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search),
);

const catalogItem = computed(() => {
  const id = query.value.get("catalogId") || "";
  return id ? getWidgetCatalogItem(id) : undefined;
});

const requestedSizeKey = computed(() => query.value.get("size") || "2x2");

const previewSize = computed<WidgetCatalogSizePreset | undefined>(() => {
  const item = catalogItem.value;
  if (!item) return undefined;
  const requested = requestedSizeKey.value;
  return (
    item.supportedSizes.find((size) => size.key === requested) ||
    item.supportedSizes.find((size) => size.key === "2x2") ||
    item.supportedSizes.find((size) => size.default) ||
    item.supportedSizes[0]
  );
});

const previewWidget = computed<WidgetConfig | undefined>(() => {
  const item = catalogItem.value;
  const size = previewSize.value;
  if (!item || !size) return undefined;
  const widget = createWidgetFromCatalog(item);
  widget.id = `preview-${item.id}`;
  widget.enable = true;
  widget.isPublic = true;
  return isItabWidgetSizeKey(size.key)
    ? withItabGridData(widget, size.key)
    : {
        ...widget,
        colSpan: size.colSpan,
        rowSpan: size.rowSpan,
        w: size.colSpan,
        h: size.rowSpan,
      };
});

const fallbackPreview = computed(() => {
  const item: WidgetCatalogItem | undefined = catalogItem.value;
  const size = previewSize.value;
  return item && size ? { item, size } : undefined;
});

const previewStageStyle = computed(() => {
  const size = previewSize.value;
  if (!size) return undefined;
  const width = size.colSpan * 60 + Math.max(0, size.colSpan - 1) * 30;
  const height = size.rowSpan * 60 + Math.max(0, size.rowSpan - 1) * 30;
  return {
    width: `${width}px`,
    height: `${height}px`,
  };
});

onMounted(() => {
  document.documentElement.classList.add("widget-catalog-preview-route");
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove("widget-catalog-preview-route");
});
</script>

<template>
  <main class="widget-catalog-preview-page" data-widget-catalog-preview>
    <section
      v-if="catalogItem && previewWidget && previewSize"
      class="widget-catalog-preview-stage"
      :data-catalog-id="catalogItem.id"
      :data-widget-type="catalogItem.type"
      :data-size-key="previewSize.key"
      :style="previewStageStyle"
    >
      <WidgetRuntimeFrame
        v-if="isRuntimeWidget(previewWidget)"
        :widget="previewWidget"
        editing
      />
      <WidgetSizeVariantPreview
        v-else-if="fallbackPreview"
        :type="fallbackPreview.item.type"
        :title="fallbackPreview.item.title"
        :glyph="fallbackPreview.item.glyph"
        :size="fallbackPreview.size"
        preview-role="hero"
      />
    </section>
  </main>
</template>

<style scoped>
:global(html.widget-catalog-preview-route),
:global(html.widget-catalog-preview-route body),
:global(html.widget-catalog-preview-route #app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

:global(html.widget-catalog-preview-route) {
  /* The app scales compact viewports globally; catalog previews must keep
     captured iTab geometry at exact CSS pixels for shell validation. */
  zoom: 1;
}

.widget-catalog-preview-page {
  display: grid;
  width: 100vw;
  height: 100vh;
  place-items: center;
  overflow: hidden;
  background: transparent;
}

.widget-catalog-preview-stage {
  position: relative;
  overflow: hidden;
  width: 150px;
  height: 150px;
  border-radius: 18px;
  pointer-events: none;
}

.widget-catalog-preview-stage > :deep(*) {
  max-width: 100%;
}

.widget-catalog-preview-stage :deep(.sd-main-widget-shell-title) {
  display: none;
}

.widget-catalog-preview-stage :deep(.widget-size-variant-preview) {
  width: 100%;
  height: 100%;
}
</style>
