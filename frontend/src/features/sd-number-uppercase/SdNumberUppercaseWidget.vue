<script setup lang="ts">
import { computed } from "vue";
import type { WidgetConfig } from "@/types";
import type { SdWidgetSizeKey } from "@/features/sd-widgets/sdSizePresets";
import { normalizeSdNumberUppercaseWidgetData } from "./sdNumberUppercaseModel";

const props = defineProps<{
  widget: WidgetConfig;
  sizeKey: SdWidgetSizeKey;
  refreshToken?: number;
}>();

const data = computed(() =>
  normalizeSdNumberUppercaseWidgetData(props.widget.data),
);
const iconDerived = computed(
  () =>
    props.sizeKey === "1x1" ||
    props.sizeKey === "1x2" ||
    props.sizeKey === "2x1",
);
</script>

<template>
  <span
    class="sd-number-uppercase-widget"
    data-sd-number-uppercase-widget
    :data-sd-number-uppercase-size="sizeKey"
    :data-sd-number-uppercase-input="data.inputNumber"
    :data-sd-number-uppercase-result="data.uppercaseResult"
  >
    <span
      class="number-uppercase-card"
      :class="[
        `number-uppercase-card--${sizeKey}`,
        { 'number-uppercase-card--icon-derived': iconDerived },
      ]"
      :data-mtab-derived-size="iconDerived ? '1x1-centered' : undefined"
    >
      <span
        v-if="iconDerived"
        class="number-uppercase-icon-tile"
        aria-hidden="true"
      >
        <span class="number-uppercase-icon-symbol">¥</span>
      </span>
      <span v-else class="number-uppercase-cover-content" aria-hidden="true">
        <span class="number-uppercase-cover-coin">¥</span>
        <span class="number-uppercase-cover-amount">¥ 1234.56</span>
        <span class="number-uppercase-cover-result">
          壹仟贰佰叁拾肆元伍角陆分
        </span>
        <span class="number-uppercase-cover-label">
          金额换算 | Amount Conversion
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.sd-number-uppercase-widget,
.number-uppercase-card {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.number-uppercase-card {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: inherit;
  background:
    radial-gradient(
      circle at 82% 17%,
      var(
        --sd-theme-number-uppercase-number-uppercase-widget-accent-surface-01
      ),
      transparent 15%
    ),
    radial-gradient(
      circle at 18% 88%,
      var(
        --sd-theme-number-uppercase-number-uppercase-widget-accent-surface-02
      ),
      transparent 18%
    ),
    var(
      --sd-theme-number-uppercase-number-uppercase-widget-accent-surface-03
    );
  color: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-text-01
  );
}

.number-uppercase-card::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    var(
      --sd-theme-number-uppercase-number-uppercase-widget-accent-surface-04
    ),
    transparent
  );
  content: "";
}

.number-uppercase-icon-tile {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  overflow: hidden;
  border-radius: inherit;
  background: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-surface-03
  );
}

.number-uppercase-card--1x2 .number-uppercase-icon-tile {
  width: 60px;
  height: 100%;
}

.number-uppercase-card--2x1 .number-uppercase-icon-tile {
  width: 100%;
  height: 60px;
}

.number-uppercase-icon-tile::before {
  position: absolute;
  inset: 8px;
  border: 1px solid
    var(
      --sd-theme-number-uppercase-number-uppercase-widget-accent-border-01
    );
  border-radius: 999px;
  content: "";
}

.number-uppercase-icon-symbol {
  position: relative;
  z-index: 1;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Helvetica Neue",
    "PingFang SC",
    sans-serif;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}

.number-uppercase-cover-content {
  position: relative;
  z-index: 1;
  display: flex;
  max-width: calc(100% - 24px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.number-uppercase-cover-coin {
  position: absolute;
  top: -17px;
  right: -21px;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid
    var(
      --sd-theme-number-uppercase-number-uppercase-widget-accent-border-02
    );
  border-radius: 999px;
  background: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-surface-02
  );
  color: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-text-02
  );
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.number-uppercase-cover-amount {
  color: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-text-01
  );
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
  white-space: nowrap;
}

.number-uppercase-cover-result {
  max-width: 100%;
  margin-top: 6px;
  overflow: hidden;
  color: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-text-01
  );
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.number-uppercase-cover-label {
  margin-top: 8px;
  color: var(
    --sd-theme-number-uppercase-number-uppercase-widget-accent-text-03
  );
  font-size: 12px;
  line-height: 1.2;
  opacity: 0.86;
  white-space: nowrap;
}

.number-uppercase-card--2x2 .number-uppercase-cover-content {
  max-width: calc(100% - 22px);
  max-height: calc(100% - 20px);
}

.number-uppercase-card--2x2 .number-uppercase-cover-coin {
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  font-size: 10px;
}

.number-uppercase-card--2x2 .number-uppercase-cover-amount {
  font-size: 23px;
  line-height: 1.05;
}

.number-uppercase-card--2x2 .number-uppercase-cover-result {
  display: -webkit-box;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.22;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}

.number-uppercase-card--2x2 .number-uppercase-cover-label {
  max-width: 100%;
  margin-top: 7px;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
}

.number-uppercase-card--icon-derived .number-uppercase-cover-content {
  display: none;
}
</style>
