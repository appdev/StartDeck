<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import { useMainStore } from "../stores/main";
import OverlayMotion from "@/components/base/OverlayMotion.vue";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(["update:show"]);

const store = useMainStore();
const authMode = computed(() => store?.systemConfig?.authMode ?? "single");

const username = ref("");
const password = ref("");
const isRegister = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

// 监听打开：一旦打开，自动聚焦输入框，并清空旧密码
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      username.value = "";
      password.value = "";
      isRegister.value = false;
      nextTick(() => {
        // Focus username input if visible, else password
        if (authMode.value === "multi") {
          const input = document.querySelector('input[placeholder="用户名"]') as HTMLInputElement;
          if (input) input.focus();
          else inputRef.value?.focus();
        } else {
          inputRef.value?.focus();
        }
      });
    }
  },
);

const close = () => emit("update:show", false);

const handleSubmit = async () => {
  // If single user mode, username can be empty (defaults to admin on server)
  if (authMode.value === "multi" && !username.value.trim()) {
    alert("请输入用户名");
    return;
  }
  if (!password.value) {
    alert("请输入密码");
    return;
  }

  try {
    if (isRegister.value) {
      await store.register(username.value, password.value);
      alert("注册成功，请登录");
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
    alert(err.message || "操作失败！");
    password.value = "";
    // inputRef.value?.focus() // Focus password again
  }
};
</script>

<template>
  <OverlayMotion
    :show="show"
    :z-index="50"
    overlay-class="sd-overlay"
    panel-class="max-w-sm"
  >
    <div class="sd-modal-surface">
      <div class="sd-modal-header">
        <h3 class="sd-modal-title flex items-center gap-2">
          <span v-if="isRegister">新用户注册</span>
          <template v-else>
            <svg class="w-6 h-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>
              {{ authMode === "single" ? "管理员登录" : "用户登录" }}
            </span>
          </template>
        </h3>
        <button type="button" @click="close" class="sd-icon-button" aria-label="关闭登录弹窗">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="sd-modal-body">
        <div class="mb-5 space-y-4">
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

        <button
          @click="handleSubmit"
          class="sd-btn sd-btn-primary w-full"
        >
          {{ isRegister ? "注 册" : "登 录" }}
        </button>

        <div class="mt-4 text-center" v-if="authMode === 'multi'">
          <button
            @click="isRegister = !isRegister"
            class="text-sm text-gray-500 hover:text-gray-800 hover:underline transition-colors"
          >
            {{ isRegister ? "已有账号？去登录" : "没有账号？去注册" }}
          </button>
        </div>
      </div>
    </div>
  </OverlayMotion>
</template>
