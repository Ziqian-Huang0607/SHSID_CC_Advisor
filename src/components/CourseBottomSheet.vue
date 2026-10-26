<template>
  <Teleport to="body">
    <Transition name="sheet-backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[250] flex items-end justify-center"
        @click.self="emit('close')"
      >
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

        <div
          ref="sheetRef"
          class="relative z-10 w-full max-h-[85vh] flex flex-col bg-white dark:bg-[#1C1C1E] rounded-t-[24px] shadow-2xl border-t border-black/5 dark:border-white/10 overflow-hidden"
          :style="sheetStyle"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <!-- Drag handle -->
          <div class="w-full flex justify-center pt-2.5 pb-1">
            <div class="w-9 h-1 rounded-full bg-black/20 dark:bg-white/20" />
          </div>

          <!-- Header -->
          <div class="flex items-start justify-between gap-3 px-5 pt-2 pb-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-1.5 py-0.5 rounded-md bg-[#007AFF]/10 text-[#007AFF] dark:text-[#0A84FF] text-[9px] font-bold uppercase tracking-wider">
                  {{ dept }} · G{{ grade }}
                </span>
                <span v-if="track" class="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[#8E8E93] text-[9px] font-bold uppercase tracking-wider">
                  {{ track }}
                </span>
              </div>
              <h2 class="text-[20px] font-bold text-black dark:text-white leading-tight">{{ name }}</h2>
            </div>
            <button
              type="button"
              @click="emit('close')"
              class="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93] hover:bg-black/10 dark:hover:bg-white/20 active:bg-black/15 transition-colors shrink-0"
              aria-label="Close"
            >
              <Symbol name="xmark" :size="14" />
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto px-5 pb-8 space-y-5">
            <!-- Rating -->
            <div class="rounded-[16px] border border-black/5 dark:border-white/5 p-4 bg-[#F2F2F7] dark:bg-[#282829]">
              <div class="flex justify-between items-end mb-2">
                <div>
                  <div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Crowd Rating</div>
                  <div class="text-[26px] font-bold text-black dark:text-white">{{ formatRating(ratingValue) }}<span class="text-[11px] font-medium opacity-40 ml-0.5">/ 10</span></div>
                </div>
                <div class="text-[10px] font-medium text-[#8E8E93] pb-1">{{ voteCount === 1 ? '1 vote' : `${voteCount} votes` }}</div>
              </div>
              <div class="h-2 w-full bg-black/5 dark:bg-black/40 rounded-full overflow-hidden">
                <div class="h-full bg-[#34C759] rounded-full transition-[width] duration-300" :style="{ width: `${(ratingValue / 10) * 100}%` }" />
              </div>

              <!-- Voting -->
              <div class="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
                <div v-if="myVote !== null && !isEditingVote" class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 text-[12px] font-semibold text-[#34C759]">
                    <Symbol name="checkmark" :size="12" />
                    You rated this {{ myVote }} / 10
                  </div>
                  <button type="button" @click="emit('start-editing-vote')" class="text-[10px] font-bold uppercase tracking-wider text-[#007AFF] dark:text-[#0A84FF] hover:opacity-70 transition-opacity">Change</button>
                </div>
                <div v-else>
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <div class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">{{ isEditingVote ? 'Change your rating' : 'Rate this course' }}</div>
                    <button v-if="isEditingVote" type="button" @click="emit('cancel-editing-vote')" class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] hover:opacity-70 transition-opacity">Cancel</button>
                  </div>
                  <div class="grid grid-cols-10 gap-1">
                    <button
                      v-for="n in 10"
                      :key="n"
                      type="button"
                      :disabled="isSubmittingVote"
                      @click="emit('vote', n)"
                      @mouseenter="sheetHoveredVote = n"
                      @mouseleave="sheetHoveredVote = 0"
                      @focus="sheetHoveredVote = n"
                      @blur="sheetHoveredVote = 0"
                      class="h-8 rounded-[6px] text-[10px] font-bold transition-colors duration-0 disabled:opacity-40"
                      :class="voteButtonClass(n)"
                    >{{ n }}</button>
                  </div>
                </div>
                <div v-if="voteError" class="text-[10px] text-[#FF3B30] mt-2 font-medium">{{ voteError }}</div>
              </div>
            </div>

            <!-- Move-up -->
            <div v-if="isMoveUpTarget" class="py-2 px-3 rounded-xl border bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500] dark:text-[#FF9F0A]">
              <div class="text-[9px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
              <div class="font-medium text-[12px] mt-0.5 leading-tight">Moved up from {{ moveUpSourceName }}</div>
            </div>
            <div v-else-if="isMoveUpSource" class="p-1 rounded-[12px] border bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-500/50 text-orange-700 dark:text-orange-400">
              <div class="px-2 py-1.5">
                <div class="text-[9px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
                <div class="font-medium text-[12px] mt-0.5 leading-tight">Moved up to {{ moveUpTargetName }}</div>
              </div>
              <button v-if="!isLockedMoveUpSource" @click="emit('remove-move-up')" class="w-full py-2.5 rounded-[9px] bg-[#FF9500] text-white text-[11px] font-bold hover:bg-[#FF9F0A] active:bg-[#E68600] shadow-sm transition-colors">Cancel Move-Up</button>
              <div v-else class="w-full py-2.5 rounded-[9px] bg-orange-200/50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-[11px] font-bold text-center opacity-70 cursor-not-allowed">Locked by dependencies</div>
            </div>

            <!-- Description -->
            <div>
              <h4 class="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1.5 ml-0.5">Description</h4>
              <p class="whitespace-pre-line text-[13px] leading-relaxed bg-[#F2F2F7] dark:bg-[#282829] p-3 rounded-xl border border-black/5 dark:border-white/5 text-black dark:text-white">{{ description || 'No description available' }}</p>
            </div>

            <div v-if="crowdReview">
              <h4 class="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1.5 ml-0.5">Notes</h4>
              <p class="text-[13px] leading-relaxed bg-[#FF9500]/5 dark:bg-[#FF9500]/10 p-3 rounded-xl border border-[#FF9500]/10 dark:border-[#FF9500]/20 text-black dark:text-white">{{ crowdReview }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Symbol from './Symbol.vue';

const props = defineProps<{
  isOpen: boolean;
  name: string;
  dept: string;
  grade: string;
  track?: string;
  description: string;
  crowdReview?: string;
  ratingValue: number;
  voteCount: number;
  myVote: number | null;
  isEditingVote: boolean;
  isSubmittingVote: boolean;
  voteError: string | null;
  isMoveUpTarget?: boolean;
  isMoveUpSource?: boolean;
  isLockedMoveUpSource?: boolean;
  moveUpSourceName?: string;
  moveUpTargetName?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'vote', value: number): void;
  (e: 'start-editing-vote'): void;
  (e: 'cancel-editing-vote'): void;
  (e: 'remove-move-up'): void;
}>();

const sheetRef = ref<HTMLElement | null>(null);
const sheetHoveredVote = ref(0);
const translateY = ref(0);
const startY = ref(0);
const dragging = ref(false);

const sheetStyle = computed(() => ({
  transform: `translateY(${translateY.value}px)`
}));

watch(() => props.isOpen, (open) => {
  if (open) translateY.value = 0;
});

function onTouchStart(event: TouchEvent) {
  if (!sheetRef.value) return;
  startY.value = event.touches[0]!.clientY;
  dragging.value = true;
}

function onTouchMove(event: TouchEvent) {
  if (!dragging.value) return;
  const y = event.touches[0]!.clientY;
  const delta = y - startY.value;
  if (delta > 0) {
    translateY.value = delta;
  }
}

function onTouchEnd() {
  if (!dragging.value) return;
  dragging.value = false;
  if (translateY.value > 120) {
    emit('close');
  } else {
    translateY.value = 0;
  }
}

const formatRating = (val: number) => val.toFixed(2);

const voteButtonClass = (n: number): string => {
  const reference = sheetHoveredVote.value || (props.isEditingVote ? props.myVote ?? 0 : 0);
  return n <= reference
    ? 'bg-[#34C759] text-white'
    : 'bg-black/5 dark:bg-white/10 text-[#8E8E93] hover:bg-black/10 dark:hover:bg-white/20';
};
</script>

<style scoped>
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}
</style>
