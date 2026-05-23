<script setup lang="ts">
defineProps<{
  groups: Array<{ id: string; title: string }>;
  activeId?: string;
}>();

defineEmits<{
  select: [groupId: string];
}>();
</script>

<template>
  <nav
    v-if="groups.length > 0"
    class="sd-home-group-tabs"
    data-testid="home-group-tabs"
    aria-label="首页分组"
  >
    <button
      v-for="group in groups"
      :key="group.id"
      type="button"
      class="sd-home-group-tab"
      :class="{ 'is-active': group.id === activeId }"
      :aria-selected="group.id === activeId"
      @click="$emit('select', group.id)"
    >
      {{ group.title }}
    </button>
  </nav>
</template>
