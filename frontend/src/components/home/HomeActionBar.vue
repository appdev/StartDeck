<script setup lang="ts">
import HomeToolbar from "./HomeToolbar.vue";
import HomeToolbarButton from "./HomeToolbarButton.vue";

withDefaults(
  defineProps<{
    isSaving?: boolean;
    hasUnsavedChanges?: boolean;
  }>(),
  {
    isSaving: false,
    hasUnsavedChanges: false,
  },
);

defineEmits<{
  save: [];
  addWidget: [];
  addGroup: [];
}>();
</script>

<template>
  <HomeToolbar
    class="sd-home-action-bar"
    test-id="home-action-bar"
    ariaLabel="首页编辑操作"
  >
    <HomeToolbarButton
      variant="primary"
      :busy="isSaving"
      :data-dirty="hasUnsavedChanges ? 'true' : 'false'"
      aria-label="保存：保存并退出编辑"
      title="保存：保存并退出编辑"
      @click="$emit('save')"
    >
      {{ isSaving ? "保存中..." : "保存" }}
    </HomeToolbarButton>
    <HomeToolbarButton variant="secondary" @click="$emit('addWidget')">
      添加组件
    </HomeToolbarButton>
    <HomeToolbarButton variant="secondary" @click="$emit('addGroup')">
      新建分组
    </HomeToolbarButton>
  </HomeToolbar>
</template>
