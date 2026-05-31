<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useMainStore } from "../stores/main";
import ActionFooter from "@/components/base/ActionFooter.vue";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import type { ManagedIconCandidate } from "@/utils/iconAssets";

const props = defineProps<{
  show: boolean;
  candidates: ManagedIconCandidate[];
  title: string; // Search term
  source: "local" | "api";
}>();

const emit = defineEmits(["update:show", "select", "cancelLink"]);
const store = useMainStore();

const selectIcon = (icon: ManagedIconCandidate) => {
  emit("select", icon);
  emit("update:show", false);
};

const getIconName = (candidate: ManagedIconCandidate) => {
  const url = candidate.label || candidate.url;
  // Extract name from URL or path
  // e.g., "/api/assets/icons/icn_github" -> "github"
  // e.g., "https://cdn.simpleicons.org/github" -> "github"
  try {
    if (!url) return "";
    const parts = url.split("/");
    const lastPart = parts[parts.length - 1];
    if (!lastPart) return url;
    // Remove extension if present
    const name = lastPart?.split(".")[0] || "";
    // Decode URI component just in case
    return decodeURIComponent(name);
  } catch {
    return url;
  }
};

const PAGE_SIZE = 100;
const visibleCount = ref(PAGE_SIZE);
const visibleCandidates = computed(() =>
  props.candidates.slice(0, visibleCount.value),
);
const hasMore = computed(() => visibleCount.value < props.candidates.length);
const dialogTitle = computed(() =>
  props.source === "local" ? "本地图标" : "网络图标",
);
const dialogSubtitle = computed(() => `${props.candidates.length} 个候选图标`);

const loadMore = () => {
  visibleCount.value += PAGE_SIZE;
};

// Reset visible count when candidates change or show changes
watch(
  () => [props.candidates, props.show],
  () => {
    visibleCount.value = PAGE_SIZE;
  },
);
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="200"
    :title="dialogTitle"
    :subtitle="dialogSubtitle"
    close-on-overlay
    close-on-escape
    trap-focus
    restore-focus
    initial-focus="first"
    :aria-label="`${dialogTitle}选择`"
    overlay-class="sd-overlay"
    panel-class="w-full max-w-3xl"
    body-class="p-0"
    @close="$emit('update:show', false)"
  >
    <div
      class="border-b border-[var(--sd-color-border-subtle)] px-4 py-3 text-sm text-[var(--sd-color-text-secondary)]"
    >
      请选择一个图标用于当前卡片。不会再自动选择首项。
    </div>

    <div class="max-h-[60vh] overflow-y-auto p-4">
      <div
        v-if="visibleCandidates.length"
        class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
      >
        <button
          v-for="icon in visibleCandidates"
          :key="icon.id || icon.url"
          @click="selectIcon(icon)"
          class="group flex flex-col items-center gap-3 rounded-xl border border-[var(--sd-color-border-subtle)] bg-[var(--sd-color-surface)] p-3 text-left transition-all hover:border-[var(--sd-color-border-accent)] hover:bg-[color-mix(in_srgb,var(--sd-color-surface-muted)_82%,var(--sd-color-surface)_18%)]"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--sd-color-surface-muted)_88%,var(--sd-color-surface)_12%)] shadow-sm transition-transform group-hover:scale-[1.03]"
          >
            <img
              :src="store.getAssetUrl(icon.url)"
              class="h-8 w-8 object-contain"
              loading="lazy"
            />
          </div>
          <span
            class="w-full truncate text-center text-xs font-medium text-[var(--sd-color-text-secondary)]"
            :title="getIconName(icon)"
          >
            {{ getIconName(icon) }}
          </span>
        </button>
      </div>

      <div
        v-else
        class="rounded-xl border border-dashed border-[var(--sd-color-border-subtle)] px-4 py-8 text-center text-sm text-[var(--sd-color-text-secondary)]"
      >
        未找到匹配图标，请返回后调整关键字或改用手动图标地址。
      </div>

      <div v-if="hasMore" class="mt-4 flex justify-center">
        <AppButton variant="secondary" @click="loadMore">
          加载更多 ({{ candidates.length - visibleCount }} 个)
        </AppButton>
      </div>
    </div>

    <template #footer>
      <ActionFooter>
        <AppButton
          v-if="source === 'api'"
          variant="danger-soft"
          @click="$emit('cancelLink')"
        >
          取消链接
        </AppButton>
        <AppButton variant="secondary" @click="$emit('update:show', false)"
          >取消</AppButton
        >
      </ActionFooter>
    </template>
  </AppModalShell>
</template>
