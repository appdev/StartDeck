<script setup lang="ts">
import { computed } from "vue";
import { getAiUsageProvider } from "./aiUsageProviders";

const props = withDefaults(
  defineProps<{
    providerId: string;
    size?: "small" | "normal" | "large";
  }>(),
  {
    size: "normal",
  },
);

const provider = computed(() => getAiUsageProvider(props.providerId));
</script>

<template>
  <span
    class="ai-provider-icon"
    :class="[
      `ai-provider-icon--${provider.iconKey}`,
      `ai-provider-icon--${size}`,
    ]"
    :aria-label="provider.name"
  >
    <img :src="provider.iconUrl" :alt="provider.name" draggable="false" />
  </span>
</template>

<style>
.ai-provider-icon {
  --ai-provider-icon-size: 34px;
  --ai-provider-icon-radius: 12px;
  --ai-provider-icon-symbol-size: 62%;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: var(--ai-provider-icon-size);
  height: var(--ai-provider-icon-size);
  overflow: hidden;
  border: 1px solid var(--sd-widget-border);
  border-radius: var(--ai-provider-icon-radius);
  background: var(--sd-widget-surface-strong);
  line-height: 0;
}

.ai-provider-icon--small {
  --ai-provider-icon-size: 30px;
  --ai-provider-icon-radius: 10px;
}

.ai-provider-icon--large {
  --ai-provider-icon-size: 42px;
  --ai-provider-icon-radius: 15px;
}

.ai-provider-icon img {
  display: block;
  width: var(--ai-provider-icon-symbol-size);
  height: var(--ai-provider-icon-symbol-size);
  object-fit: contain;
}

.ai-provider-icon--openai {
  color: var(--sd-color-text-inverse);
  border-color: transparent;
  background: var(--sd-color-text-primary);
}

.ai-provider-icon--openai img {
  filter: invert(1);
}

[data-sd-theme="dark"] .ai-provider-icon--openai {
  color: var(--sd-color-text-inverse);
  background: var(--sd-color-text-primary);
}

[data-sd-theme="dark"] .ai-provider-icon--openai img {
  filter: none;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-sd-theme="light"]) .ai-provider-icon--openai {
    color: var(--sd-color-text-inverse);
    background: var(--sd-color-text-primary);
  }

  :root:not([data-sd-theme="light"]) .ai-provider-icon--openai img {
    filter: none;
  }
}

.ai-provider-icon--claude,
.ai-provider-icon--deepseek {
  border-color: var(--sd-color-border-subtle);
  background: color-mix(in srgb, var(--sd-component-surface) 72%, transparent);
}

[data-sd-theme="dark"] .ai-provider-icon--claude,
[data-sd-theme="dark"] .ai-provider-icon--deepseek {
  border-color: var(--sd-color-border-strong);
  background: color-mix(
    in srgb,
    var(--sd-component-text-primary) 8%,
    transparent
  );
}

@media (prefers-color-scheme: dark) {
  :root:not([data-sd-theme="light"]) .ai-provider-icon--claude,
  :root:not([data-sd-theme="light"]) .ai-provider-icon--deepseek {
    border-color: var(--sd-color-border-strong);
    background: color-mix(
      in srgb,
      var(--sd-component-text-primary) 8%,
      transparent
    );
  }
}

.ai-provider-icon--deepseek {
  --ai-provider-icon-symbol-size: 68%;
}
</style>
