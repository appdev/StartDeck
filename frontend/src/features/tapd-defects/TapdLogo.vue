<script setup lang="ts">
import { TAPD_LOGO_URL } from "./tapdDefectTypes";

withDefaults(
  defineProps<{
    size?: "small" | "normal" | "large";
  }>(),
  {
    size: "normal",
  },
);
</script>

<template>
  <span class="tapd-logo" :class="`tapd-logo--${size}`" aria-label="TAPD">
    <img :src="TAPD_LOGO_URL" alt="TAPD" draggable="false" />
  </span>
</template>

<style scoped>
.tapd-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 42px;
  height: 28px;
  overflow: hidden;
  border: 1px solid
    color-mix(in srgb, var(--sd-widget-border) 80%, var(--sd-component-surface));
  border-radius: 9px;
  background: var(--sd-component-surface);
  box-shadow: 0 6px 14px
    color-mix(in srgb, var(--sd-color-text-primary) 10%, transparent);
}

.tapd-logo--small {
  width: 34px;
  height: 24px;
  border-radius: 8px;
}

.tapd-logo--large {
  width: 54px;
  height: 36px;
  border-radius: 11px;
}

.tapd-logo img {
  display: block;
  width: 78%;
  height: 78%;
  object-fit: contain;
}
</style>
