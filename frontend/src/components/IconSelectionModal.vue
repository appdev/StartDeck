<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from "vue";
import { useMainStore } from "../stores/main";
import OverlayMotion from "@/components/base/OverlayMotion.vue";

const props = defineProps<{
  show: boolean;
  candidates: string[]; // List of icon URLs or paths
  title: string; // Search term
  source: "local" | "api";
}>();

const emit = defineEmits(["update:show", "select", "cancelLink"]);
const store = useMainStore();

const timeoutSeconds = ref(10);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let timer: any = null;

const startTimer = () => {
  clearInterval(timer);
  timeoutSeconds.value = 10;
  timer = setInterval(() => {
    timeoutSeconds.value--;
    if (timeoutSeconds.value <= 0) {
      clearInterval(timer); // Ensure timer stops
      if (props.candidates.length > 0) {
        const first = props.candidates[0];
        if (first) {
          selectIcon(first);
        }
      }
    }
  }, 1000);
};

const selectIcon = (icon: string) => {
  clearInterval(timer);
  emit("select", icon);
  emit("update:show", false);
};

// Start timer when show becomes true
watch(
  () => props.show,
  (val) => {
    clearInterval(timer); // Clear any existing timer first
    if (val) {
      startTimer();
    }
  },
  { immediate: true }
);

onUnmounted(() => clearInterval(timer));

const getIconName = (url: string) => {
  // Extract name from URL or path
  // e.g., "icons/QQ.png" -> "QQ"
  // e.g., "https://simpleicons.org/icons/github.svg" -> "github"
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
const visibleCandidates = computed(() => props.candidates.slice(0, visibleCount.value));
const hasMore = computed(() => visibleCount.value < props.candidates.length);

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
  <OverlayMotion
    :show="show"
    :z-index="200"
    close-on-overlay
    overlay-class="sd-overlay pointer-events-auto"
    panel-class="max-w-2xl"
    @close="$emit('update:show', false)"
  >
    <div class="sd-modal-surface flex max-h-[80vh] flex-col">
      <div class="sd-modal-header">
        <h3 class="sd-modal-title flex items-center gap-2">
          <span>{{ source === "local" ? "本地图标" : "网络图标" }}</span>
          <span class="text-sm font-normal text-slate-500">({{ candidates.length }} 个匹配)</span>
        </h3>
        <div
          class="rounded-full bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-600"
        >
          <span>{{ timeoutSeconds }}s 后自动选择</span>
        </div>
      </div>

      <div class="sd-modal-body flex-1 min-h-[200px]">
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-4">
          <button
            v-for="icon in visibleCandidates"
            :key="icon"
            @click="selectIcon(icon)"
            class="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm"
          >
            <div
              class="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-lg shadow-sm group-hover:scale-105 transition-transform"
            >
              <img :src="store.getAssetUrl(icon)" class="w-8 h-8 object-contain" loading="lazy" />
            </div>
            <span
              class="text-xs text-gray-600 truncate w-full text-center font-medium"
              :title="getIconName(icon)"
            >
              {{ getIconName(icon) }}
            </span>
          </button>
        </div>
        <div v-if="hasMore" class="mt-4 flex justify-center">
          <button
            @click="loadMore"
            class="sd-btn sd-btn-secondary"
          >
            加载更多 ({{ candidates.length - visibleCount }} 个)
          </button>
        </div>
      </div>

      <div class="sd-modal-footer justify-between">
        <button
          v-if="source === 'api'"
          @click="$emit('cancelLink')"
          class="sd-btn sd-btn-danger-soft"
        >
          取消链接
        </button>
        <div v-else></div>

        <button
          @click="$emit('update:show', false)"
          class="sd-btn sd-btn-secondary px-6"
        >
          取消
        </button>
      </div>
    </div>
  </OverlayMotion>
</template>
