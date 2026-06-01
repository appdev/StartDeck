<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import WidgetSizeVariantPreview from "@/components/home/WidgetSizeVariantPreview.vue";
import WidgetRuntimeFrame from "@/features/widget-runtime/WidgetRuntimeFrame.vue";
import {
  applyRuntimeWidgetSize,
  isRuntimeWidget,
} from "@/features/widget-runtime/widgetRuntimeRegistry";
import type { RuntimeWidgetSizeKey } from "@/features/widget-runtime/widgetRuntimeSizes";
import {
  isSdWidgetSizeKey,
  withSdGridData,
} from "@/features/sd-widgets/sdGrid";
import {
  createWidgetFromCatalog,
  getWidgetCatalogItem,
  type WidgetCatalogItem,
  type WidgetCatalogSizePreset,
} from "@/utils/widgetCatalog";
import type { WidgetConfig } from "@/types";
import {
  AI_USAGE_CATALOG_ID,
  AI_USAGE_WIDGET_TYPE,
} from "@/features/ai-usage/aiUsageTypes";
import {
  TAPD_DEFECTS_CATALOG_ID,
  TAPD_DEFECTS_WIDGET_TYPE,
} from "@/features/tapd-defects/tapdDefectTypes";

const applyAiUsagePreviewState = (widget: WidgetConfig) => {
  if (widget.id !== AI_USAGE_CATALOG_ID && widget.type !== AI_USAGE_WIDGET_TYPE)
    return;
  const data =
    widget.data &&
    typeof widget.data === "object" &&
    !Array.isArray(widget.data)
      ? widget.data
      : {};
  widget.data = {
    ...data,
    providerId: "openai",
    displayName: "Codex 共享额度",
    accountLabel: "OpenAI · 当前组件实例",
    credentialStorage: "browser",
    credentialType: "access_token",
    lastSummary: {
      providerId: "openai",
      status: "connected",
      primaryRemainingPercent: 85,
      weeklyRemainingPercent: 40,
      primaryResetLabel: "18:52",
      weeklyResetLabel: "2026年5月31日 9:42",
      lastSyncedAt: "17:00",
    },
  };
};

const applyTapdDefectsPreviewState = (widget: WidgetConfig) => {
  if (
    widget.id !== TAPD_DEFECTS_CATALOG_ID &&
    widget.type !== TAPD_DEFECTS_WIDGET_TYPE
  )
    return;
  const data =
    widget.data &&
    typeof widget.data === "object" &&
    !Array.isArray(widget.data)
      ? widget.data
      : {};
  const queryData = (data as { query?: unknown }).query;
  widget.data = {
    ...data,
    catalogPreview: true,
    workspaceId: "20358627",
    projectName: "支付平台",
    visibilityScope: "owned-by-current-user",
    hasServerCredential: true,
    credentialType: "basic",
    credentialAccountHint: "tapd_user",
    blockedBugIds: ["1751", "1688", "1611"],
    blockedBugSnapshots: [
      {
        id: "1751",
        title: "历史环境噪音告警",
        blockedAt: "2026-05-28T08:30:00+08:00",
      },
      {
        id: "1688",
        title: "已迁移模块遗留缺陷",
        blockedAt: "2026-05-28T08:40:00+08:00",
      },
      {
        id: "1611",
        title: "重复记录的导入问题",
        blockedAt: "2026-05-28T08:50:00+08:00",
      },
    ],
    query: {
      ...(queryData &&
      typeof queryData === "object" &&
      !Array.isArray(queryData)
        ? queryData
        : {}),
      currentUser: "tapd_user",
      limit: 100,
      order: "modified desc",
    },
    lastSummary: {
      status: "connected",
      workspaceId: "20358627",
      projectName: "支付平台",
      total: 26,
      visibleTotal: 23,
      blockedTotal: 3,
      verificationTotal: 5,
      critical: 6,
      assignedToCurrentUser: 23,
      visibleScope: "owned-by-current-user",
      page: 1,
      limit: 100,
      lastSyncedAt: "2026-05-28T10:42:00+08:00",
      items: [
        {
          id: "1824",
          severity: "p0",
          priorityLabel: "P0",
          title: "支付回调失败导致订单挂起",
          status: "处理中",
          currentOwner: "tapd_user",
          modified: "2026-05-28 10:21:00",
          url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1824",
        },
        {
          id: "1819",
          severity: "p1",
          priorityLabel: "P1",
          title: "发票预览在窄屏布局错位",
          status: "待验证",
          currentOwner: "tapd_user",
          modified: "2026-05-28 09:48:00",
          url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1819",
        },
        {
          id: "1812",
          severity: "p2",
          priorityLabel: "P2",
          title: "搜索条件清空后仍保留旧结果",
          status: "已指派",
          currentOwner: "tapd_user",
          modified: "2026-05-27 18:12:00",
          url: "https://www.tapd.cn/20358627/bugtrace/bugs/view/1812",
        },
      ],
    },
  };
};

const markCatalogPreview = (widget: WidgetConfig) => {
  widget.data = {
    ...(widget.data && typeof widget.data === "object" ? widget.data : {}),
    catalogPreview: true,
  };
};

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
  markCatalogPreview(widget);
  applyAiUsagePreviewState(widget);
  applyTapdDefectsPreviewState(widget);
  if (isRuntimeWidget(widget)) {
    applyRuntimeWidgetSize(widget, size.key as RuntimeWidgetSizeKey);
    markCatalogPreview(widget);
    applyAiUsagePreviewState(widget);
    applyTapdDefectsPreviewState(widget);
    return widget;
  }
  return isSdWidgetSizeKey(size.key)
    ? withSdGridData(widget, size.key)
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
     captured source geometry at exact CSS pixels for shell validation. */
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
