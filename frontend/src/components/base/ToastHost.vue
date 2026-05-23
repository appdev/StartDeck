<script setup lang="ts">
export interface ToastHostItem {
  id: string | number;
  title?: string;
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
}

defineProps<{
  items: ToastHostItem[];
}>();

const emit = defineEmits<{
  (e: "dismiss", id: string | number): void;
}>();
</script>

<template>
  <div
    v-if="items.length"
    class="sd-toast-host"
    aria-live="polite"
    aria-atomic="false"
  >
    <section
      v-for="item in items"
      :key="String(item.id)"
      class="sd-toast"
      :class="{
        'is-success': item.tone === 'success',
        'is-warning': item.tone === 'warning',
        'is-danger': item.tone === 'danger',
      }"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div v-if="item.title" class="sd-toast-title">{{ item.title }}</div>
          <div class="sd-toast-message">{{ item.message }}</div>
        </div>
        <button
          class="sd-icon-button shrink-0"
          @click="emit('dismiss', item.id)"
          aria-label="关闭提示"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>
