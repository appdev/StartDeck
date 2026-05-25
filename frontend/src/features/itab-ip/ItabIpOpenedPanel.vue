<script setup lang="ts">
import { onMounted } from "vue";
import type { WidgetConfig } from "@/types";
import { ITAB_IP_PROXY_PATH } from "./itabIpTypes";
import { useItabIpRuntime } from "./useItabIpRuntime";

defineProps<{
  widget: WidgetConfig;
}>();

const runtime = useItabIpRuntime();

onMounted(() => {
  void runtime.load();
});
</script>

<template>
  <section
    class="itab-ip-opened-panel"
    :data-itab-ip-api="ITAB_IP_PROXY_PATH"
    :data-itab-ip-address="runtime.address.value"
    :data-itab-ip-location="runtime.area.value"
    :data-itab-ip-network="runtime.network.value"
    :data-itab-ip-coordinate="runtime.coordinate.value"
    :data-itab-ip-source-status="runtime.sourceStatus.value"
  >
    <section class="opened-ip-result" aria-live="polite">
      <h2>本机IP地址信息</h2>
      <p v-if="runtime.error.value" class="opened-ip-error">
        {{ runtime.error.value }}
      </p>
      <dl>
        <div>
          <dt>解析地址：</dt>
          <dd>{{ runtime.address.value }}</dd>
        </div>
        <div>
          <dt>归属地：</dt>
          <dd>{{ runtime.area.value }}</dd>
        </div>
        <div>
          <dt>网络：</dt>
          <dd>{{ runtime.network.value }}</dd>
        </div>
        <div>
          <dt>经纬度：</dt>
          <dd>{{ runtime.coordinate.value }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.itab-ip-opened-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--sd-theme-itab-ip-ip-opened-panel-surface-01);
  color: var(--sd-theme-itab-ip-ip-opened-panel-text-01);
  font-family:
    "HarmonyOS Sans",
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.opened-ip-result {
  width: calc(100% - 60px);
  margin: 78px 30px 0;
}

.opened-ip-result h2 {
  margin: 0;
  color: var(--sd-theme-itab-ip-ip-opened-panel-text-02);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
}

.opened-ip-error {
  margin: 8px 0 0;
  color: var(--sd-theme-itab-ip-ip-opened-panel-accent-text-01);
  font-size: 12px;
  line-height: 18px;
}

.opened-ip-result dl {
  display: grid;
  gap: 8px;
  margin: 25px 0 0;
}

.opened-ip-result dl div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: baseline;
  min-height: 24px;
}

.opened-ip-result dt,
.opened-ip-result dd {
  margin: 0;
  color: var(--sd-theme-itab-ip-ip-opened-panel-text-02);
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}

.opened-ip-result dd {
  overflow-wrap: anywhere;
}
</style>
