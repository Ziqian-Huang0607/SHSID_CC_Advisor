<template>
  <button
    type="button"
    :aria-pressed="isSelected"
    :aria-label="ariaLabel"
    class="course-node group absolute flex flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2"
    :class="[cardClasses, { 'scale-[0.98]': isPressed }]"
    :style="cardStyle"
    @click="handleClick"
    @dblclick="handleDblClick"
    @mousedown="isPressed = true"
    @mouseup="isPressed = false"
    @mouseleave="isPressed = false"
    @touchstart="isPressed = true"
    @touchend="isPressed = false"
  >
    <!-- Department stripe -->
    <div
      class="absolute left-0 top-0 bottom-0 w-1"
      :style="{ backgroundColor: isDark ? node.darkColor : node.color }"
    />

    <!-- Top row: name + lock/move-up badges -->
    <div class="flex-1 min-h-0 flex items-start justify-between gap-1.5 pl-3 pr-2 pt-2">
      <h3
        class="text-[13px] font-semibold leading-[1.25] line-clamp-2"
        :class="titleClasses"
      >
        {{ node.name }}
      </h3>
      <div class="flex shrink-0 gap-1 mt-0.5">
        <span
          v-if="vm?.isMoveUpSource || vm?.isMoveUpTarget"
          class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#FF9500] text-white"
        >
          <Symbol name="arrow-up-forward" :size="10" />
        </span>
        <span
          v-else-if="isLocked"
          class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/10 dark:bg-white/15 text-[#8E8E93] dark:text-[#98989D]"
        >
          <Symbol name="lock" :size="10" />
        </span>
      </div>
    </div>

    <!-- Bottom row: rating + track -->
    <div class="flex items-end justify-between gap-2 pl-3 pr-2 pb-2">
      <div class="flex-1 min-w-0">
        <div class="h-1 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-150"
            :class="ratingBarClass"
            :style="{ width: `${((effectiveRating ?? 0) / 10) * 100}%` }"
          />
        </div>
        <div class="mt-1 text-[9px] font-medium tabular-nums" :class="metaClasses">
          {{ ratingText }}
        </div>
      </div>
      <span
        v-if="node.track"
        class="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight"
        :class="trackPillClasses"
      >
        {{ node.track }}
      </span>
    </div>

    <!-- Info button (visible on hover/focus or when inspected) -->
    <button
      type="button"
      class="absolute right-2 top-7 h-5 w-5 inline-flex items-center justify-center rounded-full border transition-all duration-150"
      :class="infoBtnClasses"
      @click.stop="emit('inspect', node.id)"
      :aria-label="`Details for ${node.name}`"
    >
      <Symbol name="info-circle" :size="12" />
    </button>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Symbol from './Symbol.vue';
import type { GraphNode } from '@/backend/GraphBuilder';
import type { CourseViewModel } from '@/backend/ViewModel';

const props = defineProps<{
  node: GraphNode;
  vm?: CourseViewModel;
  isInspected?: boolean;
  isDark?: boolean;
  effectiveRating?: number;
  voteCount?: number;
}>();

const emit = defineEmits<{
  (e: 'toggle', id: string): void;
  (e: 'inspect', id: string): void;
  (e: 'move-up', id: string): void;
}>();

const isPressed = ref(false);

const isSelected = computed(() => props.vm?.isSelected || props.vm?.isMoveUpTarget || false);
const isLocked = computed(() => props.vm?.status === 'locked');
const isMoveUpSource = computed(() => props.vm?.isMoveUpSource);

const cardStyle = computed(() => ({
  left: `${props.node.x}px`,
  top: `${props.node.y}px`,
  width: `${props.node.width}px`,
  height: `${props.node.height}px`
}));

const cardClasses = computed(() => {
  if (isMoveUpSource.value) {
    return 'bg-orange-50 dark:bg-orange-900/30 border-[#FF9500] text-orange-900 dark:text-orange-200';
  }
  if (props.vm?.isMoveUpTarget) {
    return 'bg-[#FF9500] border-[#FF9500] text-white shadow-md';
  }
  if (isSelected.value) {
    return 'bg-[#007AFF] border-[#007AFF] text-white shadow-md';
  }
  if (isLocked.value) {
    return 'bg-[#E5E5EA] dark:bg-[#2C2C2E] border-transparent text-[#8E8E93] dark:text-[#636366] grayscale';
  }
  return 'bg-white dark:bg-[#1C1C1E] border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]';
});

const titleClasses = computed(() => {
  if (props.vm?.isMoveUpTarget || isSelected.value) return 'text-white';
  if (isLocked.value) return 'text-[#8E8E93] dark:text-[#636366]';
  return 'text-black dark:text-white';
});

const metaClasses = computed(() => {
  if (props.vm?.isMoveUpTarget || isSelected.value) return 'text-white/70';
  if (isLocked.value) return 'text-[#8E8E93] dark:text-[#636366]';
  return 'text-[#8E8E93] dark:text-[#98989D]';
});

const trackPillClasses = computed(() => {
  if (props.vm?.isMoveUpTarget || isSelected.value) return 'bg-white/20 text-white';
  if (isLocked.value) return 'bg-black/5 dark:bg-white/5 text-[#8E8E93] dark:text-[#636366]';
  return 'bg-black/5 dark:bg-white/10 text-[#3C3C43] dark:text-[#EBEBF5]';
});

const ratingBarClass = computed(() => {
  if (props.vm?.isMoveUpTarget || isSelected.value) return 'bg-white/50';
  return 'bg-[#34C759]';
});

const infoBtnClasses = computed(() => {
  const base = 'opacity-0 group-focus-visible:opacity-100';
  if (props.isInspected) return 'opacity-100 bg-black/10 dark:bg-white/20 border-transparent text-[#007AFF] dark:text-[#0A84FF]';
  if (props.vm?.isMoveUpTarget || isSelected.value) {
    return `${base} group-hover:opacity-100 bg-white/20 border-transparent text-white hover:bg-white/30`;
  }
  if (isLocked.value) {
    return `${base} group-hover:opacity-100 bg-black/5 dark:bg-white/10 border-transparent text-[#8E8E93]`;
  }
  return `${base} group-hover:opacity-100 bg-white dark:bg-[#2C2C2E] border-black/10 dark:border-white/10 text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C]`;
});

const ratingText = computed(() => {
  const rating = props.effectiveRating ?? 0;
  const count = props.voteCount ?? 0;
  if (rating === 0) return 'No ratings';
  return `${rating.toFixed(1)} · ${count} vote${count === 1 ? '' : 's'}`;
});

const ariaLabel = computed(() => {
  const parts = [props.node.name, `${props.node.dept}, grade ${props.node.grade}`];
  if (props.vm?.isMoveUpTarget) parts.push('moved up');
  else if (isSelected.value) parts.push('in your plan');
  else if (isLocked.value) parts.push(props.vm?.lockReason || 'unavailable');
  else parts.push('available');
  return parts.join(', ');
});

function handleClick() {
  // Info button has its own handler; this only fires when the card body is clicked.
  emit('toggle', props.node.id);
}

function handleDblClick() {
  // Double-click inspects for faster navigation.
  emit('inspect', props.node.id);
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
