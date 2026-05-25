<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import { useMainStore } from "../stores/main";
import AppButton from "@/components/base/AppButton.vue";
import AppModalShell from "@/components/base/AppModalShell.vue";
import { useUiFeedbackStore } from "@/stores/uiFeedback";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(["update:show"]);

const store = useMainStore();
const uiFeedback = useUiFeedbackStore();
const authMode = computed(() => store?.systemConfig?.authMode ?? "single");

const username = ref("");
const password = ref("");
const isRegister = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      username.value = "";
      password.value = "";
      isRegister.value = false;
      nextTick(() => {
        if (authMode.value === "multi") {
          const input = document.querySelector(
            'input[placeholder="用户名"]',
          ) as HTMLInputElement | null;
          input?.focus();
          if (!input) inputRef.value?.focus();
        } else {
          inputRef.value?.focus();
        }
      });
    }
  },
);

const close = () => emit("update:show", false);

const handleSubmit = async () => {
  if (authMode.value === "multi" && !username.value.trim()) {
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
    if (isRegister.value) {
      await store.register(username.value, password.value);
      uiFeedback.notify({
        title: "注册成功",
        message: "请使用新账号登录。",
        tone: "success",
      });
      isRegister.value = false;
      password.value = "";
    } else {
      const success = await store.login(username.value, password.value);
      if (success) {
        close();
      }
    }
  } catch (e: unknown) {
    const err = e as Error;
    void uiFeedback.alert({
      title: isRegister.value ? "注册失败" : "登录失败",
      message: err.message || "操作失败！",
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
          <span v-if="isRegister">新用户注册</span>
          <template v-else>
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
            <span>{{ authMode === "single" ? "管理员登录" : "用户登录" }}</span>
          </template>
        </h3>
      </div>
    </template>

    <div class="space-y-5">
      <div class="space-y-4">
        <div v-if="authMode === 'multi'">
          <input
            v-model="username"
            type="text"
            placeholder="用户名"
            class="sd-input text-center text-lg tracking-widest"
            @keyup.enter="handleSubmit"
          />
        </div>
        <div>
          <input
            ref="inputRef"
            v-model="password"
            type="password"
            placeholder="密码"
            class="sd-input text-center text-lg tracking-widest"
            @keyup.enter="handleSubmit"
          />
        </div>
      </div>

      <AppButton variant="primary" block @click="handleSubmit">
        {{ isRegister ? "注 册" : "登 录" }}
      </AppButton>

      <div v-if="authMode === 'multi'" class="text-center">
        <button
          @click="isRegister = !isRegister"
          class="text-sm text-[var(--sd-color-text-secondary)] transition-colors hover:text-[var(--sd-color-text-primary)] hover:underline"
        >
          {{ isRegister ? "已有账号？去登录" : "没有账号？去注册" }}
        </button>
      </div>
    </div>
  </AppModalShell>
</template>
