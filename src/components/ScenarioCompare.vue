<template>
  <Teleport to="body">
    <Transition name="sheet-backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[250] flex items-end sm:items-center justify-center"
        @click.self="emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />

        <!-- Sheet -->
        <div
          class="relative z-10 w-full sm:w-[680px] sm:max-w-[90vw] max-h-[85vh] flex flex-col bg-white dark:bg-[#1C1C1E] rounded-t-[24px] sm:rounded-[24px] shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
        >
          <!-- Drag handle (mobile) -->
          <div class="sm:hidden w-full flex justify-center pt-2 pb-1">
            <div class="w-9 h-1 rounded-full bg-black/20 dark:bg-white/20" />
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5">
            <div class="flex items-center gap-2">
              <Symbol name="arrow-left-right" :size="20" class="text-[#007AFF]" />
              <h2 class="text-[17px] font-bold text-black dark:text-white">Compare scenarios</h2>
            </div>
            <button
              type="button"
              @click="emit('close')"
              class="h-8 w-8 inline-flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93] hover:bg-black/10 dark:hover:bg-white/20 active:bg-black/15 transition-colors"
              aria-label="Close"
            >
              <Symbol name="xmark" :size="14" />
            </button>
          </div>

          <!-- Scenario selectors -->
          <div class="px-5 py-4 grid grid-cols-2 gap-3 border-b border-black/5 dark:border-white/5">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Plan A</label>
              <select
                v-model="selectedA"
                class="w-full h-9 px-3 rounded-xl bg-black/5 dark:bg-white/10 text-[13px] font-medium text-black dark:text-white border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
              >
                <option value="__current__">Current plan</option>
                <option v-for="s in scenarios" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Plan B</label>
              <select
                v-model="selectedB"
                class="w-full h-9 px-3 rounded-xl bg-black/5 dark:bg-white/10 text-[13px] font-medium text-black dark:text-white border-none outline-none focus:ring-2 focus:ring-[#007AFF]"
              >
                <option value="__current__">Current plan</option>
                <option v-for="s in scenarios" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
          </div>

          <!-- Stats -->
          <div class="px-5 py-3 grid grid-cols-3 gap-2 bg-[#F2F2F7] dark:bg-[#282829]">
            <div class="text-center">
              <div class="text-[17px] font-bold text-black dark:text-white tabular-nums">{{ planAIds.size }}</div>
              <div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Plan A</div>
            </div>
            <div class="text-center border-x border-black/5 dark:border-white/5">
              <div class="text-[17px] font-bold text-[#007AFF] dark:text-[#0A84FF] tabular-nums">{{ common.size }}</div>
              <div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">In both</div>
            </div>
            <div class="text-center">
              <div class="text-[17px] font-bold text-black dark:text-white tabular-nums">{{ planBIds.size }}</div>
              <div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Plan B</div>
            </div>
          </div>

          <!-- Comparison lists -->
          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            <!-- In both -->
            <section v-if="commonList.length > 0">
              <h3 class="text-[10px] font-bold uppercase tracking-wider text-[#007AFF] dark:text-[#0A84FF] mb-2">In both plans</h3>
              <ul class="space-y-1.5">
                <li
                  v-for="entry in commonList"
                  :key="entry.id"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#007AFF]/5 dark:bg-[#007AFF]/10 border border-[#007AFF]/10 dark:border-[#007AFF]/20"
                >
                  <Symbol name="checkmark" :size="12" class="text-[#007AFF] shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div class="text-[12px] font-semibold text-black dark:text-white truncate">{{ entry.name }}</div>
                    <div class="text-[10px] text-[#8E8E93]">{{ entry.dept }} · Grade {{ entry.grade }}</div>
                  </div>
                </li>
              </ul>
            </section>

            <!-- Only A -->
            <section v-if="onlyAList.length > 0">
              <h3 class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] mb-2">Only in Plan A</h3>
              <ul class="space-y-1.5">
                <li
                  v-for="entry in onlyAList"
                  :key="entry.id"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10"
                >
                  <div class="min-w-0 flex-1">
                    <div class="text-[12px] font-semibold text-black dark:text-white truncate">{{ entry.name }}</div>
                    <div class="text-[10px] text-[#8E8E93]">{{ entry.dept }} · Grade {{ entry.grade }}</div>
                  </div>
                </li>
              </ul>
            </section>

            <!-- Only B -->
            <section v-if="onlyBList.length > 0">
              <h3 class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] mb-2">Only in Plan B</h3>
              <ul class="space-y-1.5">
                <li
                  v-for="entry in onlyBList"
                  :key="entry.id"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10"
                >
                  <div class="min-w-0 flex-1">
                    <div class="text-[12px] font-semibold text-black dark:text-white truncate">{{ entry.name }}</div>
                    <div class="text-[10px] text-[#8E8E93]">{{ entry.dept }} · Grade {{ entry.grade }}</div>
                  </div>
                </li>
              </ul>
            </section>

            <p v-if="commonList.length === 0 && onlyAList.length === 0 && onlyBList.length === 0" class="text-center text-[13px] text-[#8E8E93] py-6">
              Both plans are empty.
            </p>
          </div>

          <!-- Footer -->
          <div class="px-5 py-4 border-t border-black/5 dark:border-white/5 flex justify-end gap-2">
            <button
              type="button"
              @click="emit('close')"
              class="h-9 px-4 rounded-full bg-black/5 dark:bg-white/10 text-[13px] font-semibold text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/20 active:bg-black/15 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Symbol from './Symbol.vue';
import type { CourseModel } from '@/backend/CourseModel';
import type { PlanSnapshot } from '@/backend/PlanCodec';
import { loadScenario, type ScenarioListItem } from '@/backend/ScenarioStore';

const props = defineProps<{
  isOpen: boolean;
  scenarios: ScenarioListItem[];
  currentSnapshot: PlanSnapshot | null;
  catalog: CourseModel;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedA = ref<string>('__current__');
const selectedB = ref<string>(props.scenarios[0]?.id ?? '__current__');

watch(() => props.isOpen, (open) => {
  if (open) {
    if (selectedA.value === selectedB.value) {
      selectedB.value = props.scenarios.find(s => s.id !== selectedA.value)?.id ?? '__current__';
    }
  }
});

function resolveIds(selection: string): Set<string> {
  if (selection === '__current__') {
    if (!props.currentSnapshot) return new Set();
    return new Set([
      ...props.currentSnapshot.selected,
      ...props.currentSnapshot.moveUps.map(p => p[1])
    ]);
  }
  const { scenario } = loadScenario(selection, props.catalog);
  if (!scenario) return new Set();
  return new Set([
    ...scenario.snapshot.selected,
    ...scenario.snapshot.moveUps.map(p => p[1])
  ]);
}

const planAIds = computed(() => resolveIds(selectedA.value));
const planBIds = computed(() => resolveIds(selectedB.value));

const common = computed(() => {
  const set = new Set<string>();
  for (const id of planAIds.value) {
    if (planBIds.value.has(id)) set.add(id);
  }
  return set;
});

const onlyA = computed(() => {
  const set = new Set<string>();
  for (const id of planAIds.value) {
    if (!planBIds.value.has(id)) set.add(id);
  }
  return set;
});

const onlyB = computed(() => {
  const set = new Set<string>();
  for (const id of planBIds.value) {
    if (!planAIds.value.has(id)) set.add(id);
  }
  return set;
});

interface Entry { id: string; name: string; dept: string; grade: string; }

function entriesFromIds(ids: Set<string>): Entry[] {
  const list: Entry[] = [];
  const depts = props.catalog.departments || {};
  for (const [deptName, deptData] of Object.entries(depts)) {
    if (Array.isArray(deptData)) {
      for (const course of deptData) {
        if (course?.id && ids.has(course.id)) {
          list.push({ id: course.id, name: course.name || course.id, dept: deptName, grade: 'Residual' });
        }
      }
    } else if (deptData && typeof deptData === 'object') {
      for (const [grade, courses] of Object.entries(deptData as Record<string, { id: string; name?: string }[]>)) {
        if (!Array.isArray(courses)) continue;
        for (const course of courses) {
          if (course?.id && ids.has(course.id)) {
            list.push({ id: course.id, name: course.name || course.id, dept: deptName, grade });
          }
        }
      }
    }
  }
  return list.sort((a, b) => a.grade.localeCompare(b.grade) || a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name));
}

const commonList = computed(() => entriesFromIds(common.value));
const onlyAList = computed(() => entriesFromIds(onlyA.value));
const onlyBList = computed(() => entriesFromIds(onlyB.value));
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
