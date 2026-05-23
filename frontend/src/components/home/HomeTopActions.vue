<script setup lang="ts">
import { computed } from "vue";
import HomeToolbar from "./HomeToolbar.vue";
import HomeToolbarButton from "./HomeToolbarButton.vue";

type ForceMode = "auto" | "lan" | "wan" | "latency";

const props = withDefaults(
  defineProps<{
    forceMode: ForceMode;
    isLan: boolean;
    latency: number;
    isChecking?: boolean;
    isLogged?: boolean;
  }>(),
  {
    isChecking: false,
    isLogged: false,
  },
);

defineEmits<{
  toggleForceMode: [];
  settings: [];
  edit: [];
  login: [];
  logout: [];
}>();

const forceModeLabel = computed(() => {
  if (props.forceMode === "lan") return "内网";
  if (props.forceMode === "wan") return "外网";
  return "自动";
});

const networkLabel = computed(() => (props.isLan ? "内网" : "外网"));
const latencyLabel = computed(
  () => `${Math.max(0, Math.round(props.latency))}ms`,
);
const networkDetailLabel = computed(() =>
  props.forceMode === "auto"
    ? `${networkLabel.value} · ${latencyLabel.value}`
    : latencyLabel.value,
);
</script>

<template>
  <HomeToolbar
    class="sd-home-top-actions"
    test-id="home-top-actions"
    ariaLabel="首页快捷操作"
  >
    <HomeToolbarButton
      variant="primary"
      class="sd-home-top-network"
      :aria-busy="isChecking"
      :aria-label="`网络模式：${forceModeLabel}，当前${networkLabel}，延迟${latencyLabel}`"
      @click="$emit('toggleForceMode')"
    >
      <span v-if="isChecking" class="sd-home-top-spinner" aria-hidden="true" />
      <template v-else>
        <span class="sd-home-network-mode">{{ forceModeLabel }}</span>
        <span class="sd-home-network-separator" aria-hidden="true">·</span>
        <span class="sd-home-network-detail">{{ networkDetailLabel }}</span>
      </template>
    </HomeToolbarButton>
    <HomeToolbarButton aria-label="打开设置" @click="$emit('settings')">
      设置
    </HomeToolbarButton>
    <HomeToolbarButton
      variant="primary"
      :aria-label="isLogged ? '进入编辑模式' : '登录后编辑'"
      @click="isLogged ? $emit('edit') : $emit('login')"
    >
      {{ isLogged ? "编辑" : "登录" }}
    </HomeToolbarButton>
    <HomeToolbarButton
      v-if="isLogged"
      variant="danger"
      aria-label="退出登录"
      @click="$emit('logout')"
    >
      退出
    </HomeToolbarButton>
  </HomeToolbar>
</template>
