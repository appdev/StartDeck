<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { useMainStore } from "../stores/main";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    zIndex?: number | string;
    onSuccess: () => void;
  }>(),
  {
    zIndex: 60,
  },
);

const emit = defineEmits(["update:show"]);
const store = useMainStore();

const password = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const errorMsg = ref("");
const titleText = computed(() => props.title || "请输入密码确认操作");

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
    const success = await store.login(
      store.username || "admin",
      password.value,
    );
    if (success) {
      props.onSuccess();
      close();
    }
  } catch (e: unknown) {
    errorMsg.value =
      (e instanceof Error ? e.message : null) || "密码错误，请重试";
    password.value = "";
    inputRef.value?.focus();
  }
};
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="zIndex"
    :title="titleText"
    initial-focus="first"
    blocking
    :show-close="false"
    overlay-class="sd-overlay-strong"
    panel-class="w-full max-w-sm"
    surface-class="max-w-sm sd-compact-window"
  >
    <div class="space-y-4">
      <div>
        <input
          ref="inputRef"
          v-model="password"
          type="password"
          placeholder="请输入管理员密码"
          class="sd-input text-center text-lg tracking-widest"
          @keyup.enter="confirm"
        />
        <p
          v-if="errorMsg"
          class="mt-2 text-center text-xs text-[var(--sd-color-accent-danger)]"
        >
          {{ errorMsg }}
        </p>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" data-modal-cancel @click="close"
        >取消</AppButton
      >
      <AppButton variant="primary" @click="confirm">确认</AppButton>
    </template>
  </AppModalShell>
</template>
