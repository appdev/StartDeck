<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useMainStore } from "../stores/main";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import { useUiFeedbackStore } from "@/stores/uiFeedback";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(["update:show"]);

const store = useMainStore();
const uiFeedback = useUiFeedbackStore();

const username = ref("");
const password = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      username.value = "";
      password.value = "";
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  },
);

const close = () => emit("update:show", false);

const handleSubmit = async () => {
  if (!username.value.trim()) {
    uiFeedback.notify({
      title: "无法提交",
      message: "请输入用户名。",
      tone: "warning",
    });
    return;
  }
  if (!password.value) {
    uiFeedback.notify({
      title: "无法提交",
      message: "请输入密码。",
      tone: "warning",
    });
    return;
  }

  try {
    const success = await store.login(username.value, password.value);
    if (success) {
      close();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "操作失败！";
    if (message.trim() === "password_incorrect") {
      uiFeedback.notify({
        title: "登录失败",
        message: "密码错误，请重新输入。",
        tone: "danger",
      });
      password.value = "";
      return;
    }
    void uiFeedback.alert({
      title: "登录失败",
      message,
      tone: "danger",
    });
    password.value = "";
  }
};
</script>

<template>
  <AppModalShell
    :show="show"
    :z-index="50"
    close-on-overlay
    close-on-escape
    initial-focus="first"
    aria-label="登录"
    overlay-class="sd-overlay"
    panel-class="w-full max-w-sm"
    surface-class="max-w-sm sd-compact-window"
    @close="close"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <h3 class="sd-modal-title flex items-center gap-2">
          <svg
            class="h-6 w-6 text-[var(--sd-color-text-secondary)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>用户登录</span>
        </h3>
      </div>
    </template>

    <div class="space-y-5">
      <div class="space-y-4">
        <div>
          <input
            ref="inputRef"
            v-model="username"
            type="text"
            placeholder="用户名"
            class="sd-input text-center text-lg tracking-widest"
            @keyup.enter="handleSubmit"
          />
        </div>
        <div>
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            class="sd-input text-center text-lg tracking-widest"
            @keyup.enter="handleSubmit"
          />
        </div>
      </div>

      <AppButton variant="primary" block @click="handleSubmit">
        登 录
      </AppButton>
    </div>
  </AppModalShell>
</template>
