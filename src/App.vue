<template>
  <div 
    class="min-h-screen bg-[#F2F2F7] dark:bg-black text-[#1C1C1E] dark:text-[#F2F2F7] p-4 md:p-8 font-sans transition-colors duration-300 relative overflow-hidden flex flex-col antialiased selection:bg-cyan-500/30"
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
          <span>Build your 4-year plan</span>
        </p>
      </div>
      
      <div class="flex items-center gap-3 flex-grow justify-end">
        <div class="relative w-full max-w-xs group">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search courses..." 
            class="w-full pl-9 pr-4 py-2 rounded-full border-none bg-black/5 dark:bg-white/10 backdrop-blur-md focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#1C1C1E] outline-none transition-all shadow-sm placeholder-gray-500 text-sm font-medium"
          />
        </div>
        <button @click="toggleDarkMode" class="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-all active:scale-90">
          {{ isDarkMode ? '☀️' : '🌙' }}
        </button>
      </div>
    </header>

    <!-- Skeleton Loaders -->
    <div v-if="!catalogData" class="w-full max-w-[1400px] mx-auto flex-grow relative z-10 animate-pulse">
      <div class="w-full bg-white/50 dark:bg-[#1C1C1E]/50 rounded-[2rem] p-6 space-y-6 shadow-sm border border-black/5 dark:border-white/5">
        <div class="h-8 bg-black/5 dark:bg-white/5 rounded-lg w-1/4 mb-8"></div>
        <div v-for="row in 4" :key="row" class="grid grid-cols-[180px_1fr_1fr_1fr_1fr] gap-4">
          <div class="h-5 bg-black/5 dark:bg-white/5 rounded w-1/2 mt-4"></div>
          <div v-for="col in 4" :key="col" class="h-24 bg-black/5 dark:bg-white/5 rounded-2xl"></div>
        </div>
      </div>
    </div>

    <!-- The Swimlane Matrix -->
    <div v-else class="w-full max-w-[1400px] mx-auto overflow-x-auto pb-10 relative z-10 animate-fade-in-up flex-grow custom-scrollbar">
      <!-- 🌟 ENHANCED GLASSMORPHISM: Heavier blur, more translucency, and inner shadow 🌟 -->
      <div class="min-w-[1000px] border border-black/5 dark:border-white/10 rounded-[2rem] bg-white/70 dark:bg-black/35 backdrop-blur-xl overflow-hidden shadow-xl shadow-black/8 dark:shadow-black/20">
        
        <div class="grid grid-cols-[180px_1fr_1fr_1fr_1fr] bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
          <div class="p-5 font-semibold text-[#8E8E93] dark:text-[#98989D] uppercase text-xs tracking-wider flex items-center">
            Department
          </div>
          <div v-for="grade in ['9', '10', '11', '12']" :key="grade" class="p-5 font-bold text-center text-lg">
            Grade {{ grade }}
          </div>
        </div>

        <div v-if="activeDepartments.length === 0" class="py-32 text-center flex flex-col items-center justify-center">
          <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200">No Results</h3>
        </div>

        <div 
          v-else
          v-for="dept in activeDepartments" 
          :key="dept" 
          class="grid grid-cols-[180px_1fr_1fr_1fr_1fr] border-b border-black/5 dark:border-white/5 hover:bg-white/20 dark:hover:bg-white/[0.02] transition-colors duration-300"
        >
          <div 
            @click="toggleDept(dept)"
            class="p-5 flex items-center justify-between border-r border-black/5 dark:border-white/5 cursor-pointer group"
          >
            <h2 class="font-semibold text-sm group-hover:text-blue-500 transition-colors capitalize">{{ dept }}</h2>
            <svg class="w-4 h-4 text-gray-400 transition-transform duration-300" :class="{ 'rotate-180': collapsedDepts.has(dept) }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>

          <div v-for="grade in ['9', '10', '11', '12']" :key="grade" class="p-4 flex flex-col gap-3 border-r border-black/5 dark:border-white/5">
            <div v-show="!collapsedDepts.has(dept)" class="flex flex-col gap-3 h-full">
              
              <div 
                v-for="course in getCourses(dept, grade)" 
                :key="course.id"
                class="relative"
              >
                <button
                  type="button"
                  @click="toggleCourseSelection(course.id)"
                  :disabled="!canToggleCourse(course.id)"
                  :aria-pressed="isCourseSelected(course.id)"
                  :class="[
                    'w-full min-h-[104px] text-left p-4 pr-14 rounded-2xl relative overflow-hidden border transition-transform duration-150 active:scale-[0.97] disabled:active:scale-100',
                    getCardStyles(course.id)
                  ]"
                >
                  <h3 class="font-bold text-[14px] leading-snug">{{ viewState[course.id]?.name || course.raw.name }}</h3>
                </button>

                <button
                  type="button"
                  @click.stop="openCourseInfo(course.id)"
                  class="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-white/85 dark:bg-black/45 text-black/65 dark:text-white/75 transition-colors hover:text-black hover:bg-white dark:hover:text-white dark:hover:bg-black/60"
                  aria-label="Open course information"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8h.01M11 12h1v4h1m-1 5a9 9 0 110-18 9 9 0 010 18z" />
                  </svg>
                </button>

                <div
                  v-if="getWarningMessage(course.id)"
                  :title="getWarningMessage(course.id) || undefined"
                  class="absolute bottom-3 right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFD60A]/15 text-[#C47F00] dark:text-[#FFD60A]"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 3.75a1.5 1.5 0 011.299.75l7.5 13A1.5 1.5 0 0119.5 19.75h-15a1.5 1.5 0 01-1.299-2.25l7.5-13A1.5 1.5 0 0112 3.75zm0 4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0V9a.75.75 0 00-.75-.75zm0 8a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="mt-8 pt-8 pb-4 border-t border-slate-200/60 dark:border-slate-800/60 relative z-10 shrink-0 text-center flex flex-col items-center max-w-4xl mx-auto space-y-5">
      <div class="px-5 py-2.5 bg-[#FF3B30]/10 dark:bg-[#FF453A]/20 text-[#FF3B30] dark:text-[#FF453A] backdrop-blur-md rounded-xl text-[10px] font-bold uppercase tracking-widest border border-[#FF3B30]/20 shadow-sm">
        ⚠️ Unofficial Tool: Not official SHSID material. Based on SHSID Catalog only.
      </div>
      <p class="text-sm font-medium text-[#8E8E93] dark:text-[#98989D]">
        Built by <a href="https://github.com/Ziqian-Huang0607" target="_blank" class="text-black dark:text-white font-bold hover:text-blue-500 transition-colors">Ziqian Huang</a> (Frontend) & 
        <a href="https://github.com/WillUHD" target="_blank" class="text-black dark:text-white font-bold hover:text-blue-500 transition-colors">Will Chen</a> (Backend)
      </p>
      <p class="text-xs text-[#8E8E93]/80 dark:text-[#98989D]/80 leading-relaxed">
        Maintained by <span class="font-bold text-gray-700 dark:text-gray-300">Indexademics IT Team</span>.<br />
        Report bugs or give suggestions: <a href="mailto:mlfusion@outlook.com" class="hover:text-blue-500 font-medium transition-colors text-black dark:text-white">mlfusion@outlook.com</a> or <span class="font-medium text-black dark:text-white">IDX on WeChat</span>.
      </p>
    </footer>

    <!-- Cinematic Backdrop -->
    <Transition name="fade">
      <div 
        v-if="viewingCourseId" 
        @click="viewingCourseId = null"
        class="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-[55] cursor-pointer"
      ></div>
    </Transition>

    <!-- Side Panel -->
    <Transition name="slide-sheet">
      <!-- 🌟 ENHANCED GLASSMORPHISM: Extreme blur, new colors, deeper shadows 🌟 -->
      <div v-if="viewingCourseId" class="fixed inset-y-4 inset-x-4 md:left-auto md:right-4 md:w-[420px] bg-white/80 dark:bg-black/65 backdrop-blur-xl shadow-2xl shadow-black/20 border border-white/80 dark:border-white/10 rounded-[2rem] z-[60] p-8 overflow-y-auto custom-scrollbar flex flex-col">
        
        <div class="flex justify-between items-start mb-6">
          <div class="px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[10px] uppercase tracking-wider rounded-full">
            {{ activeRaw?.dept }} • Grade {{ activeVm?.grade || activeRaw?.grade }}
          </div>
          <button @click="viewingCourseId = null" class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:bg-black/10 dark:hover:bg-white/20 transition-all active:scale-90">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <h2 class="text-3xl font-bold leading-tight tracking-tight text-black dark:text-white">{{ activeVm?.name || activeRaw?.raw.name }}</h2>
        <p class="text-[#8E8E93] text-sm font-medium mt-2 mb-8">{{ viewingCourseId ? getCardStatusText(viewingCourseId) : '' }}</p>

        <!-- Action Buttons -->
        <div class="mb-8 space-y-3">
          <button
            v-if="viewingCourseId && activeVm && ['selected', 'bypassed', 'available'].includes(activeVm.status)"
            type="button"
            @click="toggleCourseSelection(viewingCourseId)"
            class="w-full inline-flex items-center justify-between gap-4 rounded-[1.5rem] px-4 py-4 border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/10 transition-all hover:bg-white dark:hover:bg-white/15 active:scale-[0.99]"
          >
            <div class="flex flex-col items-start text-left">
              <span class="text-sm font-semibold text-black dark:text-white">{{ getPanelActionLabel(viewingCourseId) }}</span>
              <span class="text-xs text-[#8E8E93] dark:text-[#98989D]">{{ getCardStatusText(viewingCourseId) }}</span>
            </div>
            <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[#8E8E93] dark:text-[#98989D]">
              {{ isCourseSelected(viewingCourseId) ? 'On' : 'Off' }}
            </span>
          </button>

          <div v-else-if="activeVm?.status === 'locked'" class="w-full p-4 bg-gray-100 dark:bg-white/5 rounded-2xl text-gray-600 dark:text-gray-300 text-sm font-medium flex flex-col gap-1 border border-black/5 dark:border-white/5">
            <span class="flex items-center gap-2 text-gray-800 dark:text-gray-100 font-semibold">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              Locked
            </span>
            <span class="opacity-80 text-xs">{{ activeVm?.lockReason || 'Prerequisites not met.' }}</span>
          </div>

          <button 
            v-if="activeVm?.status === 'locked' && activeVm?.moveUpNote"
            @click="controller?.handleMoveUpTap(viewingCourseId!)"
            class="w-full py-3 mt-2 rounded-2xl font-semibold bg-[#FF9500] hover:bg-[#FF9F0A] text-white shadow-sm transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
          >
            <span>Force Bypass</span>
            <span class="text-[10px] font-normal opacity-90">{{ activeVm?.moveUpNote }}</span>
          </button>
        </div>
        
        <div class="bg-white dark:bg-[#2C2C2E] rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm mb-8">
          <div class="p-4 border-b border-black/5 dark:border-white/5">
            <div class="flex justify-between text-xs font-semibold mb-2 text-gray-500">
              <span>Popularity</span>
              <span class="text-black dark:text-white">{{ animatedPopularity.toFixed(1) }} / 10</span>
            </div>
            <div class="h-1.5 w-full bg-gray-100 dark:bg-black/50 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full transition-all" :style="{ width: `${(animatedPopularity / 10) * 100}%` }"></div>
            </div>
          </div>
          <div class="p-4">
            <div class="flex justify-between text-xs font-semibold mb-2 text-gray-500">
              <span>Student Rating</span>
              <span class="text-black dark:text-white">{{ animatedRating.toFixed(1) }} / 10</span>
            </div>
            <div class="h-1.5 w-full bg-gray-100 dark:bg-black/50 rounded-full overflow-hidden">
              <div class="h-full bg-orange-500 rounded-full transition-all" :style="{ width: `${(animatedRating / 10) * 100}%` }"></div>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h4 class="text-xs font-bold text-[#8E8E93] uppercase tracking-wider mb-2 ml-1">Official Description</h4>
          <p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-white/50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
            {{ activeRaw?.raw.description || 'No description available.' }}
          </p>
        </div>

        <div class="mb-6">
          <h4 class="text-xs font-bold text-[#8E8E93] uppercase tracking-wider mb-2 ml-1">Student Notes</h4>
          <p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-orange-50 dark:bg-orange-500/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-500/20">
            {{ activeRaw?.raw.crowdReview || 'No notes available.' }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import gsap from 'gsap';

import { CourseSelectionController } from './backend/Controller';
import { Updater } from './backend/Updater';
import type { CourseModel, CourseNode } from './backend/CourseModel';
import type { CourseViewModel } from './backend/ViewModel';

// --- All script logic remains identical to the previous version ---
const catalogData = ref<CourseModel | null>(null);
const viewState = ref<Record<string, CourseViewModel>>({});
const controller = ref<CourseSelectionController | null>(null);

const viewingCourseId = ref<string | null>(null);
const isDarkMode = ref<boolean>(true);
const searchQuery = ref<string>('');
const collapsedDepts = ref<Set<string>>(new Set());

onMounted(async () => {
  if (isDarkMode.value) document.documentElement.classList.add('dark');
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewingCourseId.value) viewingCourseId.value = null;
  });

  try {
    const updater = new Updater();
    const data = await updater.initialize();
    
    if (data) {
      catalogData.value = data;
      controller.value = new CourseSelectionController(data);
      controller.value.connectView((newViewModels) => {
        viewState.value = newViewModels;
      });
    }
  } catch (error) {
    console.error("Failed to load backend systems.", error);
  }
});

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark', isDarkMode.value);
};

const toggleDept = (dept: string) => {
  if (collapsedDepts.value.has(dept)) collapsedDepts.value.delete(dept);
  else collapsedDepts.value.add(dept);
};

const allCourses = computed(() => {
  if (!catalogData.value) return [];
  const list: Array<{ id: string; dept: string; grade: string; raw: CourseNode; searchText: string }> = [];
  
  for (const [dept, gradesObj] of Object.entries(catalogData.value.departments)) {
    if (dept === 'residuals') continue; 
    
    const typedGradesObj = gradesObj as Record<string, CourseNode[]>;
    
    for (const [gradeLevel, courseArray] of Object.entries(typedGradesObj)) {
      if (courseArray) {
        for (const course of courseArray) {
          list.push({
            id: course.id,
            dept,
            grade: gradeLevel,
            raw: course,
            searchText: `${course.id} ${course.name || ''}`.toLowerCase()
          });
        }
      }
    }
  }
  return list;
});

const visibleCoursesByBucket = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const buckets = new Map<string, Array<{ id: string; dept: string; grade: string; raw: CourseNode }>>();

  allCourses.value.forEach(course => {
    if (query && !course.searchText.includes(query)) return;

    const key = `${course.dept}::${course.grade}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push({
      id: course.id,
      dept: course.dept,
      grade: course.grade,
      raw: course.raw
    });
    buckets.set(key, bucket);
  });

  return buckets;
});

const activeDepartments = computed(() =>
  Array.from(
    new Set(
      [...visibleCoursesByBucket.value.values()].flatMap(courses => courses.map(course => course.dept))
    )
  )
);

const getCourses = (dept: string, grade: string) =>
  visibleCoursesByBucket.value.get(`${dept}::${grade}`) || [];

const openCourseInfo = (courseId: string) => {
  viewingCourseId.value = courseId;
};

const canToggleCourse = (courseId: string): boolean => {
  const status = viewState.value[courseId]?.status;
  return status === 'available' || status === 'selected' || status === 'bypassed';
};

const isCourseSelected = (courseId: string): boolean => {
  const status = viewState.value[courseId]?.status;
  return status === 'selected' || status === 'bypassed';
};

const toggleCourseSelection = (courseId: string) => {
  if (!canToggleCourse(courseId)) return;
  controller.value?.handleTap(courseId);
};

const getWarningMessage = (courseId: string): string | undefined => {
  const vm = viewState.value[courseId];
  return vm?.status === 'locked' ? vm.lockReason : undefined;
};

const getCardStatusText = (courseId: string): string => {
  const vm = viewState.value[courseId];
  if (!vm) return 'Checking.';

  switch (vm.status) {
    case 'selected':
      return 'Selected.';
    case 'bypassed':
      return 'Bypassed.';
    case 'available':
      return 'Available.';
    case 'locked':
    default:
      return vm.lockReason || 'Unavailable.';
  }
};

const getPanelActionLabel = (courseId: string): string => {
  const vm = viewState.value[courseId];
  if (!vm) return 'Select';

  switch (vm.status) {
    case 'selected':
      return 'Remove from plan';
    case 'bypassed':
      return 'Remove from plan';
    case 'available':
      return 'Add to plan';
    case 'locked':
    default:
      return 'Unavailable';
  }
};

const activeVm = computed(() => viewingCourseId.value ? viewState.value[viewingCourseId.value] : null);
const activeRaw = computed(() => allCourses.value.find(c => c.id === viewingCourseId.value) || null);

const animatedPopularity = ref(0);
const animatedRating = ref(0);

watch(viewingCourseId, (newId) => {
  if (newId && activeRaw.value) {
    const targetPop = activeRaw.value.raw.crowdPopularity || 0;
    const targetRate = activeRaw.value.raw.crowdRating || 0;
    gsap.to(animatedPopularity, { value: targetPop, duration: 1, ease: "expo.out" });
    gsap.to(animatedRating, { value: targetRate, duration: 1, ease: "expo.out" });
  } else {
    animatedPopularity.value = 0;
    animatedRating.value = 0;
  }
});

const getCardStyles = (courseId: string): string => {
  const vm = viewState.value[courseId];
  const isViewing = viewingCourseId.value === courseId;
  const viewingRing = isViewing ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-black ' : '';

  if (!vm) return viewingRing + 'bg-white/50 dark:bg-[#2C2C2E]/50 border-black/5 dark:border-white/5 text-gray-500';

  switch (vm.status) {
    case 'selected':
      return viewingRing + 'bg-blue-500 border-blue-500 text-white shadow-sm hover:bg-blue-600';
    case 'bypassed':
      return viewingRing + 'bg-orange-500 border-orange-500 text-white shadow-sm hover:bg-orange-600';
    case 'available':
      return viewingRing + 'bg-white/75 dark:bg-[#2C2C2E]/75 border-black/5 dark:border-white/10 text-black dark:text-white hover:bg-white dark:hover:bg-[#3A3A3C] shadow-sm';
    case 'locked':
    default:
      return viewingRing + 'bg-gray-100/65 dark:bg-white/5 border-black/5 dark:border-white/5 text-gray-500 dark:text-gray-400';
  }
};
</script>

<style scoped>
.slide-sheet-enter-active, .slide-sheet-leave-active { transition: all 0.6s cubic-bezier(0.32, 0.72, 0, 1); }
.slide-sheet-enter-from, .slide-sheet-leave-to { transform: translateX(110%); opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(142, 142, 147, 0.3); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(142, 142, 147, 0.6); }
</style>
