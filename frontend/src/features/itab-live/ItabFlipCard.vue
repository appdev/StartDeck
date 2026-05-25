<!--
Adapted from gaoshunpeng/vue-flip-card FlipCard.vue and flip-card.scss.
MIT License. Copyright (c) 2024 高顺鹏.
Permission is hereby granted, free of charge, to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of this software, subject
to including this copyright notice and permission notice in substantial copies.
-->
<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    digit: string;
    duration?: number;
  }>(),
  {
    duration: 420,
  },
);

const current = ref(props.digit);
const next = ref(props.digit);
const flipping = ref(false);

watch(
  () => props.digit,
  async (newValue, oldValue) => {
    if (newValue === oldValue || flipping.value) return;

    next.value = newValue;
    flipping.value = true;

    await new Promise((resolve) =>
      window.setTimeout(resolve, props.duration * 1.5),
    );
    current.value = newValue;
    flipping.value = false;
  },
);
</script>

<template>
  <div class="flip-card" :style="{ '--flip-duration': `${duration}ms` }">
    <div class="flip-card__top">
      <span>{{ next }}</span>
    </div>
    <div class="flip-card__bottom">
      <span>{{ current }}</span>
    </div>
    <div class="flip-card__back" :class="{ 'flip-down': flipping }">
      <span>{{ current }}</span>
    </div>
    <div class="flip-card__front" :class="{ 'flip-up': flipping }">
      <span>{{ next }}</span>
    </div>
  </div>
</template>

<style scoped>
.flip-card {
  position: relative;
  width: var(--flip-card-width, 40px);
  height: var(--flip-card-height, 60px);
  border-radius: var(--flip-card-radius, 6px);
  box-shadow: var(
    --flip-shadow,
    0 2px 8px var(--sd-theme-itab-live-flip-card-shadow-01)
  );
  color: var(--flip-text-color, var(--sd-theme-itab-live-flip-card-text-01));
  font-family: var(
    --flip-font-family,
    "DIN",
    "Roboto Mono",
    "SF Mono",
    monospace
  );
  font-size: var(--flip-font-size, 36px);
  font-weight: var(--flip-font-weight, 600);
  perspective: var(--flip-perspective, 300px);
}

.flip-card::after {
  position: absolute;
  top: 50%;
  left: 0;
  z-index: 5;
  width: 100%;
  height: 1px;
  background: var(
    --flip-center-line,
    var(--sd-theme-itab-live-flip-card-surface-01)
  );
  box-shadow: var(
    --flip-center-line-shadow,
    0 1px 0 var(--sd-theme-itab-live-flip-card-shadow-02)
  );
  content: "";
}

.flip-card__top,
.flip-card__bottom,
.flip-card__back,
.flip-card__front {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  height: 50%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.flip-card__top {
  top: 0;
  z-index: 1;
  border-bottom: 1px solid
    var(--flip-border-color, var(--sd-theme-itab-live-flip-card-border-01));
  border-radius: var(--flip-card-radius, 6px) var(--flip-card-radius, 6px) 0 0;
  background: var(
    --flip-bg-top,
    linear-gradient(
      180deg,
      var(--sd-theme-itab-live-flip-card-accent-surface-01) 0%,
      var(--sd-theme-itab-live-flip-card-accent-surface-02) 100%
    )
  );
}

.flip-card__bottom {
  bottom: 0;
  z-index: 1;
  border-radius: 0 0 var(--flip-card-radius, 6px) var(--flip-card-radius, 6px);
  background: var(
    --flip-bg-bottom,
    linear-gradient(
      180deg,
      var(--sd-theme-itab-live-flip-card-accent-surface-02) 0%,
      var(--sd-theme-itab-live-flip-card-accent-surface-01) 100%
    )
  );
}

.flip-card__back,
.flip-card__front {
  backface-visibility: hidden;
  transform-style: preserve-3d;
  will-change: transform;
}

.flip-card__back {
  top: 0;
  z-index: 3;
  border-bottom: 1px solid
    var(--flip-border-color, var(--sd-theme-itab-live-flip-card-border-01));
  border-radius: var(--flip-card-radius, 6px) var(--flip-card-radius, 6px) 0 0;
  background: var(
    --flip-bg-top,
    linear-gradient(
      180deg,
      var(--sd-theme-itab-live-flip-card-accent-surface-01) 0%,
      var(--sd-theme-itab-live-flip-card-accent-surface-02) 100%
    )
  );
  transform: rotateX(0deg);
  transform-origin: bottom center;
}

.flip-card__front {
  bottom: 0;
  z-index: 2;
  border-radius: 0 0 var(--flip-card-radius, 6px) var(--flip-card-radius, 6px);
  background: var(
    --flip-bg-bottom,
    linear-gradient(
      180deg,
      var(--sd-theme-itab-live-flip-card-accent-surface-02) 0%,
      var(--sd-theme-itab-live-flip-card-accent-surface-01) 100%
    )
  );
  transform: rotateX(90deg);
  transform-origin: top center;
}

.flip-card__back.flip-down {
  animation: flipDown var(--flip-duration) var(--flip-timing-down, ease-in)
    forwards;
}

.flip-card__front.flip-up {
  animation: flipUp var(--flip-duration) calc(var(--flip-duration) * 0.5)
    var(--flip-timing-up, ease-out) forwards;
}

.flip-card__back::after,
.flip-card__front::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
}

.flip-card__back.flip-down::after {
  animation: flipDownShadow var(--flip-duration)
    var(--flip-timing-down, ease-in) forwards;
}

.flip-card__front.flip-up::after {
  animation: flipUpShadow var(--flip-duration) calc(var(--flip-duration) * 0.5)
    var(--flip-timing-up, ease-out) forwards;
}

.flip-card__top span,
.flip-card__back span {
  position: absolute;
  top: 100%;
  transform: translateY(-50%);
}

.flip-card__bottom span,
.flip-card__front span {
  position: absolute;
  bottom: 100%;
  transform: translateY(50%);
}

@keyframes flipDown {
  0% {
    transform: rotateX(0deg);
  }
  100% {
    transform: rotateX(-90deg);
  }
}

@keyframes flipUp {
  0% {
    transform: rotateX(90deg);
  }
  100% {
    transform: rotateX(0deg);
  }
}

@keyframes flipDownShadow {
  0% {
    background: var(--sd-theme-itab-live-flip-card-surface-02);
  }
  100% {
    background: var(--sd-theme-itab-live-flip-card-surface-03);
  }
}

@keyframes flipUpShadow {
  0% {
    background: var(--sd-theme-itab-live-flip-card-surface-04);
  }
  100% {
    background: var(--sd-theme-itab-live-flip-card-surface-05);
  }
}
</style>
