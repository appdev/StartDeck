<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useMainStore } from "../stores/main";
import OverlayMotion from "@/components/base/OverlayMotion.vue";

const props = defineProps<{
  show: boolean;
  title?: string;
  onSuccess: () => void;
}>();

const emit = defineEmits(["update:show"]);
const store = useMainStore();

const password = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const errorMsg = ref("");

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      password.value = "";
      errorMsg.value = "";
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  },
);

const close = () => emit("update:show", false);

const confirm = async () => {
  try {
    const success = await store.login(store.username || "admin", password.value);
    if (success) {
      props.onSuccess();
      close();
    }
  } catch (e: unknown) {
    errorMsg.value = (e instanceof Error ? e.message : null) || "密码错误，请重试";
    password.value = "";
    inputRef.value?.focus();
  }
};
</script>

<template>
  <OverlayMotion
    :show="show"
    :z-index="60"
    overlay-class="sd-overlay-strong"
    panel-class="max-w-sm"
  >
    <div class="sd-modal-surface">
      <div class="sd-modal-header">
        <h3 class="sd-modal-title text-base">{{ title || "请输入密码确认操作" }}</h3>
        <button type="button" @click="close" class="sd-icon-button" aria-label="关闭密码确认弹窗">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="sd-modal-body">
        <div class="mb-4">
          <input
            ref="inputRef"
            v-model="password"
            type="password"
            placeholder="请输入管理员密码"
            class="sd-input text-center text-lg tracking-widest"
            @keyup.enter="confirm"
          />
          <p v-if="errorMsg" class="text-red-500 text-xs mt-2 text-center">{{ errorMsg }}</p>
        </div>

        <div class="flex gap-3">
          <button
            @click="close"
            class="sd-btn sd-btn-secondary flex-1"
          >
            取消
          </button>
          <button
            @click="confirm"
            class="sd-btn sd-btn-primary flex-1"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </OverlayMotion>
</template>
