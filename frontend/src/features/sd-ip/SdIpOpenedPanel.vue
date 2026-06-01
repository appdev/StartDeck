<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import type { WidgetConfig } from "@/types";
import { SD_IP_LATENCY_PATH, SD_IP_PROXY_PATH } from "./sdIpTypes";
import { useSdIpRuntime } from "./useSdIpRuntime";

defineProps<{
  widget: WidgetConfig;
}>();

const runtime = useSdIpRuntime();

onMounted(() => {
  void runtime.ensureLoaded().then(() => runtime.refreshLatencyIfNeeded());
  runtime.startLatencyAutoRefresh();
});

onBeforeUnmount(() => {
  runtime.stopLatencyAutoRefresh();
});
</script>

<template>
  <section
    class="sd-ip-opened-panel"
    :data-sd-ip-api="SD_IP_PROXY_PATH"
    :data-sd-ip-latency-api="SD_IP_LATENCY_PATH"
    :data-sd-ip-address="runtime.address.value"
    :data-sd-ip-location="runtime.area.value"
    :data-sd-ip-latency="runtime.latencyValue.value"
    :data-sd-ip-latency-status="runtime.latencyStatus.value"
    :data-sd-ip-map-url="runtime.mapEmbedUrl.value"
    :data-sd-ip-source-status="runtime.sourceStatus.value"
  >
    <section
      v-if="runtime.mapEmbedUrl.value"
      class="opened-ip-map-layer"
      data-sd-ip-map
      aria-label="IP归属地地图"
    >
      <iframe
        title="IP归属地地图"
        :src="runtime.mapEmbedUrl.value"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
      />
      <p class="opened-ip-map-attribution">
        城市级大致位置 ·
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
      </p>
    </section>

    <section
      v-else
      class="opened-ip-map-layer opened-ip-map-empty"
      data-sd-ip-map-empty
      aria-label="IP归属地地图"
    >
      <span>暂无地图</span>
    </section>

    <section
      class="opened-ip-info-card"
      data-sd-ip-info-card
      aria-live="polite"
    >
      <p class="opened-ip-kicker">当前位置</p>
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
        <div class="opened-ip-latency-row">
          <dt>PING测试：</dt>
          <dd>
            <span
              class="opened-ip-latency-value"
              :class="{ 'is-testing': runtime.latencyLoading.value }"
            >
              {{ runtime.latencyLabel.value }}
            </span>
            <button
              type="button"
              class="opened-ip-latency-action"
              :disabled="runtime.latencyLoading.value"
              aria-label="刷新延迟"
              title="刷新延迟"
              @click="runtime.refreshLatency()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3z"
                />
              </svg>
              <span>刷新</span>
            </button>
          </dd>
        </div>
      </dl>
      <p v-if="runtime.latencyError.value" class="opened-ip-latency-error">
        {{ runtime.latencyError.value }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.sd-ip-opened-panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--sd-theme-ip-ip-opened-panel-surface-01);
  color: var(--sd-theme-ip-ip-opened-panel-text-01);
  font-family:
    "HarmonyOS Sans",
    "PingFang SC",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.opened-ip-map-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    color-mix(
      in srgb,
      var(--sd-theme-ip-ip-opened-panel-surface-01) 94%,
      var(--sd-theme-ip-ip-opened-panel-text-02)
    ),
    color-mix(
      in srgb,
      var(--sd-theme-ip-ip-opened-panel-surface-01) 82%,
      var(--sd-theme-ip-ip-opened-panel-accent-text-01)
    )
  );
}

.opened-ip-map-layer iframe {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  border: 0;
  filter: saturate(1.08) contrast(1.04);
}

.opened-ip-map-layer::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      28deg,
      transparent 0 47%,
      color-mix(
          in srgb,
          var(--sd-theme-ip-ip-opened-panel-text-02) 12%,
          transparent
        )
        47.4% 48.1%,
      transparent 48.6% 100%
    ),
    linear-gradient(
      152deg,
      transparent 0 54%,
      color-mix(
          in srgb,
          var(--sd-theme-ip-ip-opened-panel-accent-text-01) 12%,
          transparent
        )
        54.4% 55.1%,
      transparent 55.6% 100%
    ),
    radial-gradient(
      circle at 50% 50%,
      color-mix(
          in srgb,
          var(--sd-theme-ip-ip-opened-panel-accent-text-01) 34%,
          transparent
        )
        0 4px,
      transparent 5px 100%
    );
  background-size:
    270px 190px,
    230px 210px,
    100% 100%;
  opacity: 0.5;
}

.opened-ip-map-attribution {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 2;
  margin: 0;
  padding: 7px 10px;
  border: 1px solid
    color-mix(
      in srgb,
      var(--sd-theme-ip-ip-opened-panel-text-02) 12%,
      transparent
    );
  border-radius: 8px;
  background: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-surface-01) 72%,
    transparent
  );
  backdrop-filter: blur(14px) saturate(1.25);
  color: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-text-02) 74%,
    transparent
  );
  font-size: 11px;
  line-height: 16px;
}

.opened-ip-map-attribution a {
  color: inherit;
  text-decoration: none;
}

.opened-ip-map-empty {
  display: grid;
  place-items: center;
}

.opened-ip-map-empty span {
  color: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-text-02) 50%,
    transparent
  );
  font-size: 14px;
  line-height: 20px;
}

.opened-ip-info-card {
  position: absolute;
  top: 42px;
  left: 42px;
  z-index: 2;
  width: min(430px, calc(100% - 84px));
  max-height: calc(100% - 84px);
  min-width: 0;
  overflow: auto;
  padding: 18px 20px 20px;
  border: 1px solid
    color-mix(
      in srgb,
      var(--sd-theme-ip-ip-opened-panel-text-02) 16%,
      transparent
    );
  border-radius: 8px;
  background: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-surface-01) 76%,
    transparent
  );
  box-shadow: 0 18px 40px
    color-mix(
      in srgb,
      var(--sd-theme-ip-ip-opened-panel-text-02) 14%,
      transparent
    );
  backdrop-filter: blur(20px) saturate(1.3);
}

.opened-ip-kicker {
  margin: 0 0 6px;
  color: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-accent-text-01) 84%,
    var(--sd-theme-ip-ip-opened-panel-text-02)
  );
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.opened-ip-info-card h2 {
  margin: 0;
  color: var(--sd-theme-ip-ip-opened-panel-text-02);
  font-size: 18px;
  font-weight: 600;
  line-height: 25px;
}

.opened-ip-error {
  margin: 8px 0 0;
  color: var(--sd-theme-ip-ip-opened-panel-accent-text-01);
  font-size: 12px;
  line-height: 18px;
}

.opened-ip-info-card dl {
  display: grid;
  gap: 8px;
  margin: 18px 0 0;
}

.opened-ip-info-card dl div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: baseline;
  min-height: 24px;
}

.opened-ip-info-card dt,
.opened-ip-info-card dd {
  margin: 0;
  color: var(--sd-theme-ip-ip-opened-panel-text-02);
  font-size: 15px;
  font-weight: 400;
  line-height: 23px;
}

.opened-ip-info-card dd {
  overflow-wrap: anywhere;
}

.opened-ip-latency-row dd {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.opened-ip-latency-value {
  display: inline-flex;
  min-width: 92px;
  min-height: 30px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border: 1px solid
    color-mix(
      in srgb,
      var(--sd-theme-ip-ip-opened-panel-text-02) 20%,
      transparent
    );
  border-radius: 7px;
  background: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-text-02) 9%,
    transparent
  );
  color: var(--sd-theme-ip-ip-opened-panel-text-02);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 22px;
  white-space: nowrap;
}

.opened-ip-latency-value.is-testing {
  color: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-text-02) 64%,
    transparent
  );
}

.opened-ip-latency-action {
  display: inline-flex;
  min-width: 72px;
  min-height: 30px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  border-radius: 7px;
  background: color-mix(
    in srgb,
    var(--sd-theme-ip-ip-opened-panel-accent-text-01) 68%,
    var(--sd-theme-ip-ip-opened-panel-text-02)
  );
  color: var(--sd-theme-ip-ip-opened-panel-surface-01);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.opened-ip-latency-action:disabled {
  cursor: wait;
  opacity: 0.58;
}

.opened-ip-latency-action svg {
  width: 15px;
  height: 15px;
  fill: currentColor;
}

.opened-ip-latency-error {
  margin: 10px 0 0;
  color: var(--sd-theme-ip-ip-opened-panel-accent-text-01);
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 760px) {
  .opened-ip-info-card {
    top: 24px;
    left: 20px;
    width: calc(100% - 40px);
    max-height: calc(100% - 48px);
    padding: 16px 16px 18px;
  }

  .opened-ip-map-attribution {
    right: 12px;
    bottom: 12px;
  }
}
</style>
