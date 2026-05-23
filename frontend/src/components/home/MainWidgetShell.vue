<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
} from "vue";
import {
  formatWidgetShellViolations,
  STARTDECK_WIDGET_SHELL_CONTRACT_VERSION,
  STARTDECK_WIDGET_SHELL_PROFILE,
  validateWidgetShell,
  WidgetShellContractError,
  type WidgetShellViolation,
} from "@/features/widget-shell/WidgetShellContract";

const props = withDefaults(
  defineProps<{
    widgetType: string;
    widgetSize: string;
    title?: string;
    validateContract?: boolean;
  }>(),
  {
    title: "",
    validateContract: true,
  },
);

const rootRef = ref<HTMLElement | null>(null);
const shellViolations = ref<WidgetShellViolation[]>([]);
const shellContractLocked = ref(false);
let reportedViolationSignature = "";
let delayedValidationTimer: number | undefined;

const hasTitle = computed(() => props.title.length > 0);
const violationMessage = computed(() =>
  formatWidgetShellViolations(shellViolations.value),
);

const shouldValidateRenderedShell = () =>
  props.validateContract &&
  import.meta.env.MODE !== "test" &&
  typeof window !== "undefined" &&
  typeof window.getComputedStyle === "function";

const validateShell = async () => {
  if (shellContractLocked.value || !shouldValidateRenderedShell()) return;
  await nextTick();
  const result = validateWidgetShell(rootRef.value, {
    componentId: props.widgetType,
    profile: STARTDECK_WIDGET_SHELL_PROFILE,
  });
  if (result.valid) {
    if (shellViolations.value.length > 0) {
      shellViolations.value = [];
    }
    return;
  }

  shellContractLocked.value = true;
  shellViolations.value = result.violations;
  const signature = violationMessage.value;
  if (signature && signature !== reportedViolationSignature) {
    reportedViolationSignature = signature;
    console.error(
      new WidgetShellContractError(result.violations, {
        componentId: props.widgetType,
        profile: STARTDECK_WIDGET_SHELL_PROFILE,
      }),
    );
  }
};

const scheduleShellValidation = (delayMs: number) => {
  if (delayedValidationTimer !== undefined) {
    window.clearTimeout(delayedValidationTimer);
  }
  delayedValidationTimer = window.setTimeout(() => {
    delayedValidationTimer = undefined;
    void validateShell();
  }, delayMs);
};

onMounted(() => {
  void validateShell();
  scheduleShellValidation(250);
});

onUpdated(() => {
  scheduleShellValidation(280);
});

onBeforeUnmount(() => {
  if (delayedValidationTimer !== undefined) {
    window.clearTimeout(delayedValidationTimer);
  }
});
</script>

<template>
  <div
    ref="rootRef"
    class="sd-main-widget-shell"
    data-main-shell-managed="true"
    data-main-widget-shell
    :data-widget-shell-contract="STARTDECK_WIDGET_SHELL_CONTRACT_VERSION"
    :data-widget-type="widgetType"
    :data-widget-size="widgetSize"
  >
    <div class="sd-main-widget-shell-card" data-main-widget-shell-card>
      <div class="sd-main-widget-shell-content" data-main-widget-shell-content>
        <slot />
      </div>
      <div
        v-if="shellViolations.length > 0"
        class="sd-main-widget-shell-degraded"
        role="status"
        aria-live="polite"
      >
        <strong>组件外壳异常</strong>
        <span>{{ violationMessage }}</span>
      </div>
    </div>
    <div
      v-if="hasTitle"
      class="sd-main-widget-shell-title"
      data-main-widget-shell-title
    >
      <slot name="title">{{ title }}</slot>
    </div>
  </div>
</template>

<style scoped>
.sd-main-widget-shell {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  color: var(--sd-runtime-widget-text, #15171c);
}

.sd-main-widget-shell-card {
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  border: 0;
  border-radius: 18px;
  background: transparent;
  box-shadow: none;
}

.sd-main-widget-shell-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.sd-main-widget-shell-title {
  position: absolute;
  top: calc(100% + 5px);
  left: 50%;
  width: max(88px, 100%);
  z-index: 2;
  overflow: hidden;
  color: #fff;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
  pointer-events: none;
  text-align: center;
  text-overflow: ellipsis;
  text-shadow: 0 1px 7px rgba(0, 0, 0, 0.72);
  transform: translateX(-50%);
  white-space: nowrap;
}

.sd-main-widget-shell-degraded {
  position: absolute;
  inset: 0.75rem;
  z-index: 5;
  display: grid;
  align-content: center;
  gap: 0.35rem;
  border-radius: 1rem;
  background: rgba(127, 29, 29, 0.9);
  color: #fff;
  padding: 0.875rem;
  font-size: 0.75rem;
  line-height: 1.35;
}

.sd-main-widget-shell-degraded span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  white-space: pre-line;
}
</style>
