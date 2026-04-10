<template>
  <div
    class="min-h-screen bg-[#F2F2F7] dark:bg-[#1C1C1E] text-[#1C1C1E] dark:text-[#F2F2F7] p-4 md:p-8 font-sans transition-colors duration-300 relative overflow-hidden flex flex-col antialiased selection:bg-cyan-500/30"
    @mousemove="updateMousePosition"
  >
    <!-- Header -->
    <header class="flex flex-wrap justify-between items-center gap-6 mb-8 relative z-10 shrink-0 max-w-[1400px] mx-auto w-full">
      <div class="flex flex-col">
        <h1 class="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white">
          {{ catalogData?.catalogName || 'Course Catalog' }}
        </h1>
        <p class="text-[#8E8E93] dark:text-[#98989D] mt-1 font-medium text-sm flex items-center gap-2">
          <span>v{{ catalogData?.version || '1.0' }}</span>
          <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
          <span>last update on {{ catalogData?.lastUpdated || 'unknown' }}</span>
        </p>
      </div>

      <div class="flex items-center gap-3 flex-grow justify-end">
        <div class="relative w-full max-w-xs group">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search courses..."
            class="w-full pl-9 pr-4 py-2 rounded-full border-none bg-black/5 dark:bg-white/10 backdrop-blur-md focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#2C2C2E] outline-none transition-all shadow-sm placeholder-gray-500 text-sm font-medium"
          />
        </div>
        <button @click="toggleDarkMode" class="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-all active:scale-90">
          {{ isDarkMode ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <!-- Loading Skeleton -->
    <div v-if="!catalogData" class="w-full max-w-[1400px] mx-auto flex-grow relative z-10 animate-pulse">
      <div class="w-full bg-white/50 dark:bg-[#2C2C2E]/50 rounded-[2rem] p-6 space-y-6 shadow-sm border border-black/5 dark:border-white/5">
        <div class="h-8 bg-black/5 dark:bg-white/5 rounded-lg w-1/4 mb-8"></div>
        <div v-for="row in 4" :key="row" class="grid grid-cols-[180px_1fr_1fr_1fr_1fr] gap-4">
          <div class="h-5 bg-black/5 dark:bg-white/5 rounded w-1/2 mt-4"></div>
          <div v-for="col in 4" :key="col" class="h-20 bg-black/5 dark:bg-white/5 rounded-2xl"></div>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div v-else class="w-full max-w-[1400px] mx-auto overflow-x-auto pb-10 relative z-10 animate-fade-in-up flex-grow custom-scrollbar">
      <div ref="matrixRef" class="min-w-[1000px] border border-black/5 dark:border-white/10 rounded-[2rem] bg-white/70 dark:bg-[#1C1C1E]/50 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/8 dark:shadow-black/40">
        <!-- Sticky Header -->
        <div class="grid grid-cols-[180px_1fr_1fr_1fr_1fr] bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
          <div class="p-5 font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase text-xs tracking-wider flex items-center">
            Department
          </div>
          <div v-for="grade in grades" :key="grade" class="p-5 font-bold text-center text-lg">
            Grade {{ grade }}
          </div>
        </div>

        <div v-if="activeDepartments.length === 0" class="py-32 text-center flex flex-col items-center justify-center">
          <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200">No Results</h3>
        </div>

        <div
          v-for="dept in activeDepartments"
          v-else
          :key="dept"
          :ref="el => setDeptRowRef(dept, el as Element | null)"
          class="relative grid grid-cols-[180px_1fr_1fr_1fr_1fr] border-b border-black/5 dark:border-white/5 hover:bg-white/20 dark:hover:bg-white/[0.02] transition-colors duration-300"
        >
          <!-- SVG CONNECTION LAYER -->
          <svg
            v-if="(deptArrowPaths[dept] || []).length > 0"
            class="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-[1]"
            aria-hidden="true"
          >
            <path
              v-for="path in deptArrowPaths[dept]"
              :key="path.key"
              :d="path.d"
              fill="none"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
              :stroke-dasharray="path.variant === 'dashed' ? '7 7' : undefined"
              :class="path.variant === 'dashed'
                ? 'stroke-[2.5] stroke-orange-500 dark:stroke-orange-500'
                : 'stroke-[2.25] stroke-[#3B82F6]/70 dark:stroke-[#60A5FA]/65'"
            />
          </svg>

          <!-- Dept Title -->
          <div
            @click="toggleDept(dept)"
            class="p-5 flex items-start justify-between gap-3 border-r border-black/5 dark:border-white/5 cursor-pointer group z-[10]"
          >
            <h2 class="font-semibold text-sm group-hover:text-blue-500 transition-colors capitalize leading-snug pt-0.5">
              {{ dept }}
            </h2>
            <svg class="w-4 h-4 text-gray-400 transition-transform duration-300 mt-0.5 shrink-0" :class="{ 'rotate-180': collapsedDepts.has(dept) }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>

          <!-- Grade Slots -->
          <div v-for="grade in grades" :key="grade" class="p-3.5 flex flex-col gap-2 border-r border-black/5 dark:border-white/5 relative z-[10]">
            <!-- Collapsed Content -->
            <div v-if="collapsedDepts.has(dept)" :ref="el => setCollapsedSummaryRef(dept, grade, el as Element | null)" class="h-full flex">
              <button
                v-if="getCollapsedSummary(dept, grade)"
                type="button"
                @click="openCourseInfo(getCollapsedSummary(dept, grade)!.id)"
                :class="[uiConfig.summaryBase, getSummaryStyles(getCollapsedSummary(dept, grade)!.id)]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h3 class="font-bold text-[13px] leading-snug break-words">
                      {{ viewState[getCollapsedSummary(dept, grade)!.id]?.name || getCollapsedSummary(dept, grade)!.raw.name }}
                    </h3>
                  </div>
                  <div class="pt-0.5 shrink-0">
                    <svg v-if="viewState[getCollapsedSummary(dept, grade)!.id]?.status === 'locked'" class="h-4 w-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    <svg v-else-if="viewState[getCollapsedSummary(dept, grade)!.id]?.status === 'moveUpTarget'" class="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17L17 7m0 0H9m8 0v8"></path></svg>
                    <svg v-else class="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                </div>
              </button>
              <div v-else class="w-full min-h-[74px] rounded-2xl border border-dashed border-black/15 dark:border-white/15 text-[#8E8E93] dark:text-[#98989D] flex items-center justify-center px-3 text-sm font-semibold bg-white/35 dark:bg-white/[0.03]">
                Ready to select
              </div>
            </div>

            <!-- Expanded Content -->
            <div v-else class="flex flex-col gap-2.5 h-full">
              <div v-for="course in getCourses(dept, grade)" :key="course.id" class="relative group"
                   @mouseenter="showTooltip(viewState[course.id]?.status === 'locked' && viewState[course.id]?.lockReason ? viewState[course.id]?.lockReason || '' : '')"
                   @mouseleave="hideTooltip"
              >
                <button
                  :ref="el => setCourseCardRef(course.id, el as Element | null)"
                  type="button"
                  @click="handleCourseClick(course.id)"
                  :class="[
                    uiConfig.cardBase,
                    getCardStyles(course.id)
                  ]"
                >
                  <div class="pr-2">
                    <h3 class="font-bold text-[13px] leading-snug">{{ viewState[course.id]?.name || course.raw.name }}</h3>
                  </div>

                  <!-- Rating Bar (Monochrome) -->
                  <div class="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden" v-if="course.raw.crowdRating">
                    <div class="h-full bg-black/25 dark:bg-white/30 rounded-full transition-all duration-300" :style="{ width: `${(course.raw.crowdRating / 10) * 100}%` }"></div>
                  </div>
                </button>

                <!-- Floating Info & MoveUp Action Center -->
                <div class="absolute right-2.5 top-0 bottom-0 flex flex-col justify-center gap-1.5 z-20">
                  <button
                    type="button"
                    @click.stop="openCourseInfo(course.id)"
                    :class="[
                      uiConfig.iconBtn,
                      viewState[course.id]?.isSelected
                        ? 'bg-white border-transparent text-blue-600 hover:bg-blue-50'
                        : 'border-black/10 dark:border-white/10 bg-white/92 dark:bg-white/10 text-slate-700 dark:text-white/85 hover:bg-white dark:hover:bg-white/20'
                    ]"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8h.01M11 12h1v4h1m-1 5a9 9 0 110-18 9 9 0 010 18z" /></svg>
                  </button>

                  <button
                    v-if="moveUpState.active && moveUpState.sourceId === course.id"
                    type="button"
                    @click.stop="cancelMoveUpMode"
                    @mouseenter="showTooltip('Cancel move-up selection')"
                    @mouseleave="hideTooltip"
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors bg-red-500 border-red-500 text-white hover:bg-red-600 opacity-100"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                  <button
                    v-else-if="!moveUpState.active && viewState[course.id]?.isSelected && viewState[course.id]?.moveUpAvailable && !viewState[course.id]?.isMoveUpSource"
                    type="button"
                    @click.stop="startMoveUp(course.id)"
                    @mouseenter="showTooltip('Select a course to move up to')"
                    @mouseleave="hideTooltip"
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors bg-white dark:bg-white/10 border-orange-500/40 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 17L17 7m0 0H9m8 0v8"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Side Sheet -->
    <Transition name="slide-sheet">
      <div v-if="viewingCourseId" class="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white/85 dark:bg-[#1C1C1E]/80 backdrop-blur-xl shadow-2xl shadow-black/20 border-l border-white/70 dark:border-white/10 z-[60] p-8 overflow-y-auto custom-scrollbar flex flex-col">
        <div class="flex justify-between items-start mb-6">
          <div class="px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[10px] uppercase tracking-wider rounded-full">
            {{ activeRaw?.dept }} • Grade {{ activeVm?.grade || activeRaw?.grade }}
          </div>
          <button @click="viewingCourseId = null" class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:bg-black/10 dark:hover:bg-white/20 active:scale-90"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>

        <div class="flex items-start gap-4 mb-8">
          <h2 class="flex-1 text-3xl font-bold tracking-tight text-black dark:text-white">{{ activeVm?.name || activeRaw?.raw.name }}</h2>
          <button
            v-if="viewingCourseId && activeVm"
            @click="handleCourseClick(viewingCourseId)"
            :disabled="activeVm.isMoveUpTarget"
            :class="[
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all duration-200 active:scale-95',
              activeVm.isMoveUpTarget ? 'bg-orange-500 border-orange-500 text-white cursor-not-allowed opacity-80' : 
              activeVm.isSelected ? 'bg-blue-500 border-blue-500 text-white' : 
              activeVm.status === 'available' ? 'bg-white/70 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-500 hover:bg-white dark:hover:bg-white/20 hover:text-black dark:hover:text-white' :
              'bg-white/70 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-400 cursor-not-allowed'
            ]"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>

        <!-- Rating Section -->
        <div class="mb-6 rounded-[1.5rem] border border-black/5 dark:border-white/5 p-5 bg-white/50 dark:bg-white/5">
          <div class="flex justify-between items-end mb-4">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">Crowdsourced rating</div>
              <div class="text-3xl font-black text-black dark:text-white">
                {{ formatRating(activeRaw?.raw.crowdRating) }}<span class="text-sm font-medium opacity-30 ml-1">/ 10</span>
              </div>
            </div>
          </div>
          <div class="h-2.5 w-full bg-gray-200 dark:bg-black/40 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 transition-all duration-300" :style="{ width: `${((activeRaw?.raw.crowdRating || 0) / 10) * 100}%` }"></div>
          </div>
        </div>

        <!-- Move-up Banner (If this is the target of a move-up) -->
        <div v-if="activeVm?.isMoveUpTarget" class="mb-8">
          <div class="w-full py-4 px-6 rounded-2xl border flex items-center justify-between transition-all duration-200 bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400">
            <div class="text-left">
              <div class="text-[10px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
              <div class="font-bold text-sm">Moved up from {{ getCourseName(activeVm.moveUpSourceId) }}</div>
            </div>
            <svg class="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 17L17 7m0 0H9m8 0v8" />
            </svg>
          </div>
        </div>

        <!-- Move-up Action Center (If this course has been moved up from) -->
        <div v-else-if="activeVm?.isMoveUpSource" class="mb-8">
          <div class="w-full py-4 px-6 rounded-2xl border flex items-center justify-between transition-all duration-200 bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30 text-orange-700 dark:text-orange-400">
            <div class="text-left">
              <div class="text-[10px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
              <div class="font-bold text-sm">Moved up to {{ getCourseName(activeVm.moveUpTargetId) }}</div>
            </div>
            <button
              @click="removeMoveUp(viewingCourseId!)"
              class="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Descriptions -->
        <div class="space-y-6">
          <div>
            <h4 class="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest mb-2 ml-1">Catalog description</h4>
            <p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-white/50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">{{ activeRaw?.raw.description || 'No description available.' }}</p>
          </div>
          <div v-if="activeRaw?.raw.crowdReview">
            <h4 class="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest mb-2 ml-1">Crowdsourced notes</h4>
            <p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-orange-50/50 dark:bg-orange-500/5 p-4 rounded-2xl border border-orange-100 dark:border-orange-500/10">"{{ activeRaw?.raw.crowdReview }}"</p>
          </div>
        </div>
      </div>
    </Transition>

    <footer class="mt-8 pt-8 pb-4 border-t border-slate-200/60 dark:border-slate-800/60 relative z-10 shrink-0 text-center flex flex-col items-center max-w-4xl mx-auto space-y-5">
      <div class="px-5 py-2.5 bg-[#FF3B30]/10 dark:bg-[#FF453A]/20 text-[#FF3B30] dark:text-[#FF453A] backdrop-blur-md rounded-xl text-[10px] font-bold uppercase tracking-widest border border-[#FF3B30]/20 shadow-sm">⚠️ Unofficial tool: derived from course data, for reference only</div>
      <p class="text-sm font-medium text-[#8E8E93] dark:text-[#98989D]">Frontend made by <a href="https://github.com/Ziqian-Huang0607" target="_blank" class="text-black dark:text-white font-bold hover:text-blue-500 transition-colors">Ziqian Huang</a>, backend built by <a href="https://github.com/WillUHD" target="_blank" class="text-black dark:text-white font-bold hover:text-blue-500 transition-colors">Will Chen</a></p>
    </footer>

    <Transition name="fade"><div v-if="viewingCourseId" @click="viewingCourseId = null" class="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-[55] cursor-pointer"></div></Transition>
    
    <!-- Unified Tooltip Renderer -->
    <Transition name="tooltip-pop">
      <div 
        v-if="activeTooltip.visible" 
        class="fixed z-[100] pointer-events-none text-xs" 
        :class="tooltipThemeClass" 
        :style="tooltipStyle"
      >
        {{ activeTooltip.text }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { inject } from '@vercel/analytics';

import { CourseSelectionController } from './backend/Controller';
import { Updater } from './backend/Updater';
import type { CourseModel, CourseNode } from './backend/CourseModel';
import type { CourseViewModel } from './backend/ViewModel';

interface CourseMeta {
  id: string; dept: string; grade: string; raw: CourseNode; searchText: string;
}

interface ArrowPath {
  key: string; d: string; variant: 'solid' | 'dashed';
}

interface TooltipState {
  visible: boolean;
  text: string;
  theme?: 'default' | 'move-up';
}

const uiConfig = {
  cardBase: 'w-full min-h-[78px] text-left px-3 py-3 pr-11 rounded-2xl relative overflow-hidden border transition-all duration-200 flex flex-col justify-between gap-2',
  summaryBase: 'w-full min-h-[74px] rounded-2xl border px-3 py-3 text-left transition-colors shadow-sm',
  iconBtn: 'inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-all duration-200 opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100'
};

const catalogData = ref<CourseModel | null>(null);
const viewState = ref<Record<string, CourseViewModel>>({});
const controller = ref<CourseSelectionController | null>(null);

const viewingCourseId = ref<string | null>(null);
const isDarkMode = ref<boolean>(false);
const searchQuery = ref<string>('');
const collapsedDepts = ref<Set<string>>(new Set());
const tooltip = ref<TooltipState>({ visible: false, text: '', theme: 'default' });
const deptArrowPaths = ref<Record<string, ArrowPath[]>>({});

const mouseX = ref(0);
const mouseY = ref(0);
const moveUpState = ref<{
  active: boolean;
  sourceId: string | null;
  validTargets: string[];
}>({ active: false, sourceId: null, validTargets: [] });

const matrixRef = ref<HTMLElement | null>(null);
const deptRowRefs = new Map<string, HTMLElement>();
const courseCardRefs = new Map<string, HTMLElement>();
const collapsedSummaryRefs = new Map<string, HTMLElement>();

let arrowFrame = 0;
let resizeObserver: ResizeObserver | null = null;

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (moveUpState.value.active) cancelMoveUpMode();
    else if (viewingCourseId.value) viewingCourseId.value = null;
  }
};

const updateMousePosition = (e: MouseEvent) => {
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
};

const grades = computed<string[]>(() => catalogData.value?.grades || []);

const allCourses = computed<CourseMeta[]>(() => {
  if (!catalogData.value) return [];
  const list: CourseMeta[] = [];
  for (const [dept, gradesObj] of Object.entries(catalogData.value.departments)) {
    const typedGradesObj = gradesObj as Record<string, CourseNode[]>;
    for (const [gradeLevel, courseArray] of Object.entries(typedGradesObj)) {
      if (!courseArray) continue;
      for (const course of courseArray) {
        list.push({ id: course.id, dept, grade: gradeLevel, raw: course, searchText: `${course.id} ${course.name || ''} ${course.track || ''}`.toLowerCase() });
      }
    }
  }
  return list;
});

const courseMetaById = computed(() => {
  const map = new Map<string, CourseMeta>();
  allCourses.value.forEach(course => map.set(course.id, course));
  return map;
});

const allCoursesByBucket = computed(() => {
  const buckets = new Map<string, CourseMeta[]>();
  allCourses.value.forEach(course => {
    const key = `${course.dept}::${course.grade}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(course);
    buckets.set(key, bucket);
  });
  return buckets;
});

const visibleCoursesByBucket = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const buckets = new Map<string, CourseMeta[]>();
  allCourses.value.forEach(course => {
    if (query && !course.searchText.includes(query)) return;
    const key = `${course.dept}::${course.grade}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(course);
    buckets.set(key, bucket);
  });
  return buckets;
});

const activeDepartments = computed(() => Array.from(new Set([...visibleCoursesByBucket.value.values()].flatMap(courses => courses.map(course => course.dept)))));
const activeVm = computed(() => viewingCourseId.value ? viewState.value[viewingCourseId.value] : null);
const activeRaw = computed(() => viewingCourseId.value ? courseMetaById.value.get(viewingCourseId.value) || null : null);

const getCourses = (dept: string, grade: string) => visibleCoursesByBucket.value.get(`${dept}::${grade}`) || [];
const getAllBucketCourses = (dept: string, grade: string) => allCoursesByBucket.value.get(`${dept}::${grade}`) || [];

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark', isDarkMode.value);
};

const toggleDept = (dept: string) => {
  const next = new Set(collapsedDepts.value);
  if (next.has(dept)) next.delete(dept); else next.add(dept);
  collapsedDepts.value = next;
};

const openCourseInfo = (courseId: string) => viewingCourseId.value = courseId;

// Move Up UI Logic
const startMoveUp = (courseId: string) => {
  if (!controller.value) return;
  const targets = controller.value.getValidMoveUpTargets(courseId);
  if (targets.length > 0) {
    moveUpState.value = { active: true, sourceId: courseId, validTargets: targets };
  }
};

const cancelMoveUpMode = () => {
  moveUpState.value = { active: false, sourceId: null, validTargets: [] };
};

const executeMoveUp = (targetId: string) => {
  if (moveUpState.value.sourceId) {
    controller.value?.setExplicitMoveUp(moveUpState.value.sourceId, targetId);
    cancelMoveUpMode();
  }
};

const removeMoveUp = (sourceId: string) => {
  controller.value?.removeExplicitMoveUp(sourceId);
};

const handleCourseClick = (courseId: string) => {
  if (moveUpState.value.active) {
    if (moveUpState.value.validTargets.includes(courseId)) {
      executeMoveUp(courseId);
    } else if (courseId === moveUpState.value.sourceId) {
      cancelMoveUpMode();
    }
    return;
  }

  const vm = viewState.value[courseId];
  if (vm?.isMoveUpTarget) {
    openCourseInfo(courseId);
    return;
  }

  controller.value?.handleTap(courseId);
};

const getCourseName = (courseId?: string): string => {
  if (!courseId) return 'Unknown';
  return viewState.value[courseId]?.name || courseMetaById.value.get(courseId)?.raw.name || courseId;
};

// --- Unified Tooltip Logic (Refactored) ---
const activeTooltip = computed<TooltipState>(() => {
  // Prioritize the move-up cursor tooltip
  if (moveUpState.value.active && moveUpState.value.sourceId) {
    const sourceName = courseMetaById.value.get(moveUpState.value.sourceId)?.raw.name || '';
    return {
      visible: true,
      text: `Select course to move-up to from ${sourceName}`,
      theme: 'move-up',
    };
  }
  // Fall back to the standard hover tooltip
  return {
    ...tooltip.value,
    theme: 'default',
  };
});

const showTooltip = (text: string) => {
  if (!text) return; // Don't show tooltips for empty text
  tooltip.value = { visible: true, text };
};

const hideTooltip = () => { tooltip.value.visible = false; };

const tooltipStyle = computed(() => {
  const gap = 15;
  const tooltipElWidth = activeTooltip.value.theme === 'move-up' ? 350 : 280;
  const tooltipElHeight = 96; // Generous height for positioning calculation
  const margin = 16;
  
  const x = mouseX.value;
  const y = mouseY.value;

  const placeLeft = x + gap + tooltipElWidth > window.innerWidth - margin;
  const placeAbove = y + gap + tooltipElHeight > window.innerHeight - margin;

  const left = placeLeft ? x - tooltipElWidth - gap : x + gap;
  const top = placeAbove ? y - tooltipElHeight - gap : y + gap;

  return { left: `${left}px`, top: `${top}px` };
});

const tooltipThemeClass = computed(() => {
  if (activeTooltip.value.theme === 'move-up') {
    return 'bg-orange-500/90 backdrop-blur-md text-white font-bold rounded-full shadow-xl border border-white/20 dark:border-black/20 px-3.5 py-2';
  }
  
  // Default theme
  const baseClasses = 'font-medium shadow-xl max-w-[280px] rounded-xl px-3 py-2';
  return isDarkMode.value 
    ? `${baseClasses} bg-[#2C2C2E]/90 text-white border border-white/10 shadow-2xl` 
    : `${baseClasses} bg-white text-slate-900 border border-black/10 shadow-xl`;
});


const formatRating = (val: number | undefined) => {
  if (val === undefined) return '0.00';
  return val.toFixed(2);
};

const getCardStyles = (courseId: string): string => {
  const isViewing = viewingCourseId.value === courseId;
  const baseRing = isViewing ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-[#1C1C1E] ' : '';

  if (moveUpState.value.active) {
    if (courseId === moveUpState.value.sourceId) {
      return baseRing + 'bg-red-50/80 border-2 border-red-500 text-red-700 dark:bg-red-500/20 dark:text-red-300 transition-all cursor-pointer';
    }
    if (moveUpState.value.validTargets.includes(courseId)) {
      return baseRing + 'bg-orange-50 border-2 border-dashed border-orange-500 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 cursor-pointer animate-[pulse_2s_ease-in-out_infinite] hover:scale-[1.02] hover:bg-orange-100 dark:hover:bg-orange-500/30 transition-all';
    }
    return baseRing + 'bg-transparent border-black/5 dark:border-white/5 opacity-30 grayscale cursor-not-allowed pointer-events-none';
  }
  
  const vm = viewState.value[courseId];
  if (!vm || vm.status === 'locked') return baseRing + 'bg-transparent border border-black/10 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-60';
  
  if (vm.isMoveUpSource) return baseRing + 'bg-transparent border-2 border-solid border-orange-400 text-gray-600 dark:text-gray-300 font-medium opacity-85 active:scale-[0.985]';
  if (vm.isMoveUpTarget) return baseRing + 'bg-orange-500 border-orange-500 text-white shadow-md font-semibold dark:bg-orange-600 active:scale-[0.985]';
  if (vm.status === 'selected') return baseRing + 'bg-blue-500 border-blue-500 text-white shadow-sm hover:bg-blue-600 active:scale-[0.985]';
  if (vm.status === 'available') return baseRing + 'bg-white/75 dark:bg-[#2C2C2E]/75 border-black/5 dark:border-white/10 text-black dark:text-white hover:bg-white dark:hover:bg-[#3A3A3C] shadow-sm active:scale-[0.985]';
  
  return baseRing + 'bg-transparent border border-black/10 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-60';
};

const getSummaryStyles = (courseId: string): string => {
  const vm = viewState.value[courseId];
  if (!vm || vm.status === 'locked') return 'bg-transparent border border-black/10 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-60';
  if (vm.isMoveUpSource) return 'bg-transparent border-2 border-solid border-orange-400 text-gray-600 dark:text-gray-300 font-medium opacity-85';
  if (vm.isMoveUpTarget) return 'bg-orange-500 border-orange-500 text-white shadow-sm font-semibold dark:bg-orange-600';
  if (vm.status === 'selected') return 'bg-blue-500 border-blue-500 text-white';
  return 'bg-white/80 dark:bg-[#2C2C2E]/75 border-black/5 text-black dark:text-white';
};

const getGradeEntryPoint = (dept: string, grade: string): string | null => {
  const bucket = getAllBucketCourses(dept, grade);
  const activeCourses = bucket.filter(c => {
    const st = viewState.value[c.id]?.status;
    return st === 'selected' || st === 'moveUpTarget';
  });
  if (!activeCourses.length) return null;

  const entry = activeCourses.find(c => {
    const sourceId = viewState.value[c.id]?.moveUpSourceId;
    if (!sourceId) return true;
    return courseMetaById.value.get(sourceId)?.grade !== grade;
  });
  return entry ? entry.id : activeCourses[0]!.id;
};

const getGradeExitPoint = (dept: string, grade: string): string | null => {
  const bucket = getAllBucketCourses(dept, grade);
  const activeCourses = bucket.filter(c => {
    const st = viewState.value[c.id]?.status;
    return st === 'selected' || st === 'moveUpTarget';
  });
  if (!activeCourses.length) return null;

  const exit = activeCourses.find(c => {
    if (!viewState.value[c.id]?.isMoveUpSource) return true;
    const targetId = viewState.value[c.id]?.moveUpTargetId;
    if (!targetId) return true;
    return courseMetaById.value.get(targetId)?.grade !== grade;
  });
  return exit ? exit.id : activeCourses[activeCourses.length - 1]!.id;
};

const getCollapsedSummary = (dept: string, grade: string) => {
  const id = getGradeExitPoint(dept, grade);
  return id ? courseMetaById.value.get(id) || null : null;
};

const setDeptRowRef = (dept: string, el: Element | null) => { if (el instanceof HTMLElement) deptRowRefs.set(dept, el); else deptRowRefs.delete(dept); scheduleArrowRefresh(); };
const setCourseCardRef = (courseId: string, el: Element | null) => { if (el instanceof HTMLElement) courseCardRefs.set(courseId, el); else courseCardRefs.delete(courseId); scheduleArrowRefresh(); };
const setCollapsedSummaryRef = (dept: string, grade: string, el: Element | null) => { const key = `${dept}::${grade}`; if (el instanceof HTMLElement) collapsedSummaryRefs.set(key, el); else collapsedSummaryRefs.delete(key); scheduleArrowRefresh(); };

const getArrowAnchorEl = (id: string | null, dept: string, grade: string): HTMLElement | null => {
  if (!id) return null;
  return collapsedDepts.value.has(dept) ? collapsedSummaryRefs.get(`${dept}::${grade}`) || null : courseCardRefs.get(id) || null;
};

const makeLanePath = (rowEl: HTMLElement, startEl: HTMLElement, endEl: HTMLElement) => {
  const rowRect = rowEl.getBoundingClientRect();
  const s = startEl.getBoundingClientRect();
  const e = endEl.getBoundingClientRect();

  const sx = s.right - rowRect.left;
  const sy = (s.top + s.bottom) / 2 - rowRect.top;
  const ex = e.left - rowRect.left;
  const ey = (e.top + e.bottom) / 2 - rowRect.top;

  const mx = sx + (ex - sx) / 2;
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
};

const makeMoveUpPath = (rowEl: HTMLElement, startEl: HTMLElement, endEl: HTMLElement) => {
  const rowRect = rowEl.getBoundingClientRect();
  const s = startEl.getBoundingClientRect();
  const e = endEl.getBoundingClientRect();
  
  const isSameCol = Math.abs(s.left - e.left) < 50;

  if (isSameCol) {
    const startIsAbove = s.top < e.top;
    const sx = (s.left + s.right) / 2 - rowRect.left;
    const sy = (startIsAbove ? s.bottom : s.top) - rowRect.top;
    const ex = (e.left + e.right) / 2 - rowRect.left;
    const ey = (startIsAbove ? e.top : e.bottom) - rowRect.top;
    
    const ctrlOffsetY = (ey - sy) * 0.55; 
    return `M ${sx},${sy} C ${sx},${sy + ctrlOffsetY} ${ex},${ey - ctrlOffsetY} ${ex},${ey}`;
  } else {
    const sx = s.right - rowRect.left;
    const sy = (s.top + s.bottom) / 2 - rowRect.top;
    const ex = e.left - rowRect.left;
    const ey = (e.top + e.bottom) / 2 - rowRect.top;
    const mx = sx + (ex - sx) / 2;
    return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
  }
};

const recomputeArrowPaths = () => {
  const nextPaths: Record<string, ArrowPath[]> = {};
  const currentGrades = grades.value;
  activeDepartments.value.forEach(dept => {
    const rowEl = deptRowRefs.get(dept); if (!rowEl) return;
    const paths: ArrowPath[] = [];
    
    if (!collapsedDepts.value.has(dept)) {
      const explicitSources = Object.values(viewState.value).filter(v => v.isMoveUpSource && courseMetaById.value.get(v.id)?.dept === dept);
      explicitSources.forEach(vm => {
        if (!vm.moveUpTargetId) return;
        const sEl = courseCardRefs.get(vm.id);
        const tEl = courseCardRefs.get(vm.moveUpTargetId);
        if (sEl && tEl) {
          paths.push({ key: `moveup:${vm.id}:${vm.moveUpTargetId}`, d: makeMoveUpPath(rowEl, sEl, tEl), variant: 'dashed' });
        }
      });

      for (let i = 0; i < currentGrades.length - 1; i++) {
        const outId = getGradeExitPoint(dept, currentGrades[i]!);
        const inId = getGradeEntryPoint(dept, currentGrades[i+1]!);
        
        if (outId && inId) {
          const outVm = viewState.value[outId];
          if (outVm?.isMoveUpSource && outVm.moveUpTargetId === inId) continue;

          const startEl = getArrowAnchorEl(outId, dept, currentGrades[i]!);
          const endEl = getArrowAnchorEl(inId, dept, currentGrades[i+1]!);
          if (startEl && endEl) {
            paths.push({ key: `lane:${dept}:${currentGrades[i]}:${currentGrades[i+1]}`, d: makeLanePath(rowEl, startEl, endEl), variant: 'solid' });
          }
        }
      }
    } else {
      for (let i = 0; i < currentGrades.length - 1; i++) {
        const startEl = getArrowAnchorEl(getGradeExitPoint(dept, currentGrades[i]!), dept, currentGrades[i]!);
        const endEl = getArrowAnchorEl(getGradeEntryPoint(dept, currentGrades[i+1]!), dept, currentGrades[i+1]!);
        if (startEl && endEl) paths.push({ key: `col:${dept}:${currentGrades[i]}:${currentGrades[i+1]}`, d: makeLanePath(rowEl, startEl, endEl), variant: 'solid' });
      }
    }
    nextPaths[dept] = paths;
  });
  deptArrowPaths.value = nextPaths;
};

const scheduleArrowRefresh = () => { cancelAnimationFrame(arrowFrame); arrowFrame = window.requestAnimationFrame(() => nextTick(recomputeArrowPaths)); };

watch(viewState, scheduleArrowRefresh, { deep: true, immediate: true });
watch([visibleCoursesByBucket, collapsedDepts, grades], scheduleArrowRefresh, { deep: true });

onMounted(async () => {
  // Initialize Vercel Analytics
  inject();

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  isDarkMode.value = prefersDark;
  document.documentElement.classList.toggle('dark', prefersDark);

  window.addEventListener('keydown', handleEscape); window.addEventListener('resize', scheduleArrowRefresh);
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(scheduleArrowRefresh);
  try {
    const data = await (new Updater()).initialize();
    if (data) {
      catalogData.value = data; controller.value = new CourseSelectionController(data);
      controller.value.connectView(v => viewState.value = v);
      collapsedDepts.value = new Set(Object.keys(data.departments));
      await nextTick();
      if (matrixRef.value && resizeObserver) resizeObserver.observe(matrixRef.value);
      scheduleArrowRefresh();
    }
  } catch (e) { console.error(e); }
});
onBeforeUnmount(() => { cancelAnimationFrame(arrowFrame); resizeObserver?.disconnect(); window.removeEventListener('keydown', handleEscape); window.removeEventListener('resize', scheduleArrowRefresh); });
</script>

<style scoped>
.slide-sheet-enter-active, .slide-sheet-leave-active { transition: all 0.6s cubic-bezier(0.32, 0.72, 0, 1); }
.slide-sheet-enter-from, .slide-sheet-leave-to { transform: translateX(110%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.tooltip-pop-enter-active, .tooltip-pop-leave-active { transition: all 0.2s ease; }
.tooltip-pop-enter-from, .tooltip-pop-leave-to { opacity: 0; transform: scale(0.9); }
.animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(142, 142, 147, 0.3); border-radius: 10px; }
</style>
