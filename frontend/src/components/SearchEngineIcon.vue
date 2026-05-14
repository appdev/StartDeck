<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SearchEngine } from "@/types";
import IconShape from "@/components/IconShape.vue";
import { resolveIconBackground } from "@/utils/iconAppearance";
import { getSearchEngineIcon } from "@/utils/searchEngines";

const props = withDefaults(
  defineProps<{
    engine?: SearchEngine | null;
    size?: number;
    shape?: string;
    imgScale?: number;
  }>(),
  {
    engine: null,
    size: 20,
    shape: "rounded",
    imgScale: 76,
  },
);

const failedSrc = ref("");

const fallbackIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="6.5"/><path d="m19 19-3.3-3.3"/></svg>`;

const iconSrc = computed(() => getSearchEngineIcon(props.engine));
const renderedIcon = computed(() => {
  if (iconSrc.value && failedSrc.value !== iconSrc.value) return iconSrc.value;
  return fallbackIcon;
});
const backgroundColor = computed(
  () =>
    resolveIconBackground(props.engine || {}, {
      fallback: "#f1f5f9",
      shape: props.shape,
    }).color,
);

watch(iconSrc, () => {
  failedSrc.value = "";
});

const markFailed = () => {
  failedSrc.value = iconSrc.value;
};
</script>

<template>
  <IconShape
    :shape="shape"
    :size="size"
    :icon="renderedIcon"
    :bgClass="backgroundColor"
    :imgScale="imgScale"
    @error="markFailed"
  />
</template>
