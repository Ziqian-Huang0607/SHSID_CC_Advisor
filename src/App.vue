<template>
  <div
    class="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] p-2 sm:p-4 md:p-6 font-sans relative overflow-x-hidden overflow-y-clip md:overflow-clip flex flex-col antialiased selection:bg-[#007AFF]/30 select-none"
    @mousemove="updateMousePosition"
  >
    <!-- Header -->
    <header class="flex justify-between items-center gap-2 mb-4 relative z-50 shrink-0 max-w-[1400px] mx-auto w-full px-2">
      <div class="flex items-center min-w-0">
        <img src="/cc-icon.png" class="w-9 h-9 md:w-14 md:h-14 object-contain mr-2.5 md:mr-4 pointer-events-none shrink-0" alt="CC Logo" draggable="false" />
        <div class="flex flex-col justify-center min-w-0">
          <h1 class="text-[17px] sm:text-2xl md:text-[28px] font-semibold tracking-tight text-black dark:text-white leading-tight truncate">
            {{ catalogData?.catalogName || 'Course Catalog Interactive' }}
          </h1>
          <p class="text-[#8E8E93] dark:text-[#98989D] mt-0.5 font-medium tracking-tight text-[11px] flex items-center gap-2 min-w-0">
            <span class="truncate">{{ catalogData?.version || 'unknown version' }}</span>
            <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0 hidden sm:block"></span>
            <span class="truncate hidden sm:inline">Updated {{ catalogData?.lastUpdated || 'unknown' }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          v-if="planCount > 0"
          @click="showPlanPanel ? closeRightPanel() : openPlanPanel()"
          :aria-pressed="showPlanPanel"
          class="h-8 px-3 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#007AFF] font-medium text-[13px] flex items-center gap-1.5 active:bg-black/20 dark:active:bg-white/30 transition-colors duration-0 focus-visible:ring-2 focus-visible:ring-[#007AFF] outline-none"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path></svg>
          <span class="hidden sm:inline">My plan</span>
          <span class="tabular-nums">{{ planCount }}</span>
        </button>

        <div class="hidden sm:flex items-center rounded-full bg-black/5 dark:bg-white/10 overflow-hidden" v-if="canUndo || canRedo">
          <button @click="undo" :disabled="!canUndo" title="Undo (Ctrl+Z)" aria-label="Undo the last plan change" class="h-8 w-8 flex items-center justify-center text-[#007AFF] disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/15 transition-colors duration-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007AFF] outline-none">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"></path><path d="M4 9h11a5 5 0 010 10h-4"></path></svg>
          </button>
          <button @click="redo" :disabled="!canRedo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo the last undone plan change" class="h-8 w-8 flex items-center justify-center text-[#007AFF] disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/15 transition-colors duration-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007AFF] outline-none">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"></path><path d="M20 9H9a5 5 0 000 10h4"></path></svg>
          </button>
        </div>

        <div class="relative export-menu-container z-[200]" v-if="hasSelectedCourses">
          <button
            @click="showExportDropdown = !showExportDropdown"
            :aria-expanded="showExportDropdown"
            aria-haspopup="menu"
            aria-label="Export or share your plan"
            class="h-8 px-4 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#007AFF] font-medium text-[13px] flex items-center gap-1.5 active:bg-black/20 dark:active:bg-white/30 transition-colors duration-0"
            :disabled="isExporting"
          >
            <svg v-if="isExporting" class="animate-spin h-3.5 w-3.5 text-[#007AFF]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            {{ isExporting ? 'Exporting...' : 'Export' }}
          </button>

          <Transition name="tooltip-pop">
            <div v-if="showExportDropdown" role="menu" class="absolute right-0 mt-2 w-48 bg-[#e5e5ea]/95 dark:bg-[#2C2C2E]/95 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-xl shadow-md flex flex-col p-1 z-[200]">
              <button role="menuitem" @click="triggerExport('png')" :class="uiConfig.menuItem">Export as PNG</button>
              <button role="menuitem" @click="triggerExport('pdf')" :class="uiConfig.menuItem">Export as PDF</button>
              <button role="menuitem" @click="exportCsv" :class="uiConfig.menuItem">Export as CSV</button>
              <button role="menuitem" @click="exportJson" :class="uiConfig.menuItem">Export as JSON</button>
              <div class="h-px bg-black/10 dark:bg-white/10 my-1 mx-2"></div>
              <button role="menuitem" @click="copyShareLink" :class="uiConfig.menuItem">Copy share link</button>
            </div>
          </Transition>
        </div>
        
        <button @click="toggleDarkMode" :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'" class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white active:bg-black/20 dark:active:bg-white/30 transition-colors duration-0 focus-visible:ring-2 focus-visible:ring-[#007AFF] outline-none">
          <svg v-if="!isDarkMode" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
      </div>
    </header>

    <!-- Offline / stale catalog notice -->
    <div v-if="catalogNotice" class="max-w-[1400px] mx-auto w-full px-2 mb-2 shrink-0">
      <div class="flex items-start gap-2 rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10 px-3 py-2 text-[11px] font-medium leading-snug text-[#8A5300] dark:text-[#FF9F0A]">
        <svg class="w-3.5 h-3.5 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><circle cx="12" cy="12" r="10"></circle></svg>
        <span class="flex-1">{{ catalogNotice }}</span>
        <button @click="loadCatalog" class="shrink-0 font-semibold underline underline-offset-2 hover:opacity-70">Retry</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && !catalogData" class="flex-1 min-h-0 max-w-[1400px] mx-auto w-full flex items-center justify-center" role="status" aria-live="polite">
      <div class="flex flex-col items-center gap-3">
        <svg class="animate-spin h-6 w-6 text-[#007AFF]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
        <p class="text-[12px] font-medium text-[#8E8E93]">Loading the course catalog...</p>
      </div>
    </div>

    <!-- Catalog load failure -->
    <div v-else-if="loadError" class="flex-1 min-h-0 max-w-[1400px] mx-auto w-full flex items-center justify-center animate-fade-in-up">
      <div class="max-w-[420px] w-full bg-white dark:bg-[#1C1C1E] rounded-[16px] shadow-2xl border border-black/10 dark:border-white/10 p-6 text-center">
        <h2 class="text-[15px] font-semibold tracking-tight text-black dark:text-white mb-1.5">Couldn't load the course catalog</h2>
        <p class="text-[12px] leading-relaxed text-[#8E8E93] dark:text-[#98989D] mb-4">{{ loadError }}</p>
        <button @click="loadCatalog" class="px-4 h-8 rounded-full bg-[#007AFF] text-white text-[13px] font-medium hover:bg-[#0070EB] active:bg-[#0062D1] transition-colors duration-0">Try again</button>
      </div>
    </div>

    <!-- Main Container -->
    <div v-else-if="catalogData" ref="appContainer" class="flex-1 min-h-0 max-w-[1400px] mx-auto w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-[16px] sm:rounded-[20px] overflow-clip shadow-2xl border border-black/10 dark:border-white/10 relative z-10 flex animate-fade-in-up">
      
      <!-- Left Sidebar -->
      <!-- Drawer backdrop (narrow screens only) -->
      <div v-if="isNarrow && isSidebarOpen" class="absolute inset-0 z-30 bg-black/30" @click="isSidebarOpen = false" aria-hidden="true"></div>

      <div
        class="shrink-0 flex flex-col bg-[#F2F2F7] dark:bg-[#282829] z-20 border-r border-black/10 dark:border-white/10"
        :style="sidebarStyle"
        :class="sidebarClass"
      >
        <div class="h-14 px-4 flex items-center border-b border-black/5 dark:border-white/5 bg-[#F2F2F7]/95 dark:bg-[#282829]/95 backdrop-blur-xl sticky top-0 z-10 shrink-0">
          <div class="relative w-full group">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#007AFF] z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input ref="searchInputRef" v-model="searchQuery" type="search" aria-label="Search courses" placeholder="Search courses  /" class="w-full pl-8 pr-7 py-1.5 rounded-xl border-none bg-black/5 dark:bg-black/20 focus:ring-2 focus:ring-[#007AFF] outline-none placeholder-gray-500 text-[13px] font-medium text-black dark:text-white [&::-webkit-search-cancel-button]:appearance-none" />
            <button v-if="searchQuery" @click="searchQuery = ''" aria-label="Clear search" class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-black/15 dark:bg-white/25 text-white hover:bg-black/30 dark:hover:bg-white/40 transition-colors duration-0">
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="px-3 pt-2.5 pb-2 border-b border-black/5 dark:border-white/5 shrink-0">
          <div class="flex flex-wrap gap-1" role="group" aria-label="Filter by track">
            <button
              v-for="track in availableTracks" :key="track"
              @click="toggleTrack(track)"
              :aria-pressed="activeTracks.has(track)"
              :class="['px-2 h-[22px] rounded-full text-[10px] font-semibold tracking-tight transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]', activeTracks.has(track) ? 'bg-[#007AFF] text-white' : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20']"
            >{{ track }}</button>
            <button
              @click="showSelectedOnly = !showSelectedOnly; scheduleArrowRefresh()"
              :aria-pressed="showSelectedOnly"
              :class="['px-2 h-[22px] rounded-full text-[10px] font-semibold tracking-tight transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]', showSelectedOnly ? 'bg-[#34C759] text-white' : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20']"
            >In my plan</button>
          </div>
          <div class="flex items-center justify-between mt-2 text-[10px] font-medium text-[#8E8E93]">
            <span>{{ matchedCourses.length }} of {{ allCourses.length }} courses</span>
            <button v-if="hasActiveFilters" @click="clearFilters" class="font-semibold text-[#007AFF] hover:underline underline-offset-2 outline-none focus-visible:underline">Reset</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto" :class="{ 'hide-scrollbar': !selectedDept }" ref="leftScrollRef">
          <div class="pt-2 pb-[100px] pl-2 pr-3.5 space-y-0.5">
            <p v-if="activeDepartments.length === 0" class="px-3 py-6 text-center text-[11px] font-medium leading-relaxed text-[#8E8E93]">
              No courses match these filters.
            </p>
            <button 
              v-for="dept in activeDepartments" 
              :key="dept" 
              :aria-pressed="selectedDept === dept" 
              @mousedown="pressingDept = dept"
              @mouseup="if (pressingDept === dept) { handleToggleDept(dept); pressingDept = null; }"
              @mouseleave="pressingDept = null"
              @touchstart="pressingDept = dept"
              @touchend="if (pressingDept === dept) { handleToggleDept(dept); pressingDept = null; }"
              @touchcancel="pressingDept = null"
              :class="['w-full text-left px-3 min-h-[36px] py-2 rounded-lg text-[13px] font-medium flex items-center shrink-0 transition-colors duration-0', (pressingDept !== null ? pressingDept === dept : selectedDept === dept) ? 'bg-[#007AFF] text-white shadow-sm' : 'text-gray-800 dark:text-gray-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]']"
            >
              <span class="line-clamp-1 leading-normal">{{ dept }}</span>
            </button>
          </div>
        </div>

        <div class="h-14 px-4 flex items-center border-t border-black/5 dark:border-white/5 bg-[#F2F2F7]/95 dark:bg-[#282829]/95 backdrop-blur-xl sticky bottom-0 z-10 shrink-0">
          <button @click="openAboutPanel" class="relative w-full group text-left outline-none cursor-default active:bg-black/5 dark:active:bg-white/5 rounded-xl transition-colors duration-0">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-hover:text-[#007AFF] group-focus:text-[#007AFF] z-10 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
            <div class="w-full pl-8 pr-3 py-1.5 rounded-xl border-none bg-black/5 dark:bg-black/20 group-hover:bg-black/10 dark:group-hover:bg-white/10 group-focus:ring-2 group-focus:ring-[#007AFF] outline-none text-[13px] font-medium text-gray-500 cursor-pointer">About...</div>
          </button>
        </div>
        <div v-if="!isNarrow" class="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30" @mousedown="startLeftResize"></div>
      </div>

      <!-- Center Area -->
      <div class="flex-1 min-w-0 flex flex-col relative bg-white dark:bg-[#1C1C1E] z-10 transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
        <div class="h-14 flex items-center border-b border-black/5 dark:border-white/5 sticky top-0 z-30 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shrink-0">
          <button v-if="isNarrow" @click="isSidebarOpen = true" aria-label="Browse departments" class="ml-2 shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 active:bg-black/10 transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button v-if="selectedDept && !isNarrow" @click="handleToggleDept(selectedDept)" aria-label="Back to all departments" class="absolute left-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 z-40 active:bg-black/10 transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>

          <!-- On a phone the grade columns scroll with the content, so the fixed
               header shows where you are instead of the column titles. -->
          <div v-if="isNarrow" class="flex-1 min-w-0 flex items-center gap-2 px-2">
            <button v-if="selectedDept" @click="handleToggleDept(selectedDept)" aria-label="Back to all departments" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 active:bg-black/10 transition-colors duration-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span class="truncate font-semibold text-[14px] text-black dark:text-white">{{ selectedDept || 'All departments' }}</span>
          </div>

          <div v-else class="grid w-full h-full" :style="gradeGridStyle">
            <div v-for="grade in grades" :key="grade" class="flex items-center justify-center font-medium text-[13px] text-[#8E8E93] dark:text-[#98989D]">Grade {{ grade }}</div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto relative" :class="isNarrow ? 'overflow-x-auto' : 'overflow-x-clip'" ref="rightScrollRef" @click="handleContentAreaClick">
          <!-- Grade titles ride along with the horizontally scrolling grid on phones. -->
          <div v-if="isNarrow" class="sticky top-0 z-20 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-b border-black/5 dark:border-white/5" :style="gridWrapperStyle">
            <div class="grid h-9" :style="[gradeGridStyle, selectedDept ? { marginLeft: '24px', marginRight: '24px' } : { marginLeft: '8px', marginRight: '8px' }]">
              <div v-for="grade in grades" :key="grade" class="flex items-center justify-center font-medium text-[11px] text-[#8E8E93] dark:text-[#98989D]">Grade {{ grade }}</div>
            </div>
          </div>
          <!-- Main Grid (Specific) -->
          <p v-if="selectedDept && visibleDeptHasNoMatches" class="px-6 py-10 text-center text-[12px] font-medium text-[#8E8E93]">
            No courses in {{ selectedDept }} match these filters.
            <button @click="clearFilters" class="ml-1 font-semibold text-[#007AFF] hover:underline underline-offset-2">Reset filters</button>
          </p>
          <div v-else-if="selectedDept" class="p-6 pt-2 relative min-h-full pb-[156px]" :style="gridWrapperStyle">
            <div v-for="dept in visibleDepts" :key="dept" :ref="el => setDeptRowRef(dept, el as Element | null)" class="relative grid gap-5 h-full" :style="gradeGridStyle">
              <svg v-if="(deptArrowPaths[dept] || []).length > 0" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-[1]" aria-hidden="true">
                <path v-for="path in deptArrowPaths[dept]" :key="path.key" :data-key="path.key" :d="path.d" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" :stroke-dasharray="path.variant === 'dashed' ? '5 5' : undefined" :class="path.variant === 'dashed' ? 'stroke-[2] stroke-[#FF9500] dark:stroke-[#FF9F0A]' : (moveUpState.active ? 'stroke-[1.5] stroke-black/10 dark:stroke-white/10' : 'stroke-[1.5] stroke-[#007AFF] dark:stroke-[#0A84FF]')" />
              </svg>
              <div v-for="grade in grades" :key="grade" class="relative z-10 flex flex-col gap-3">
                <div v-for="course in getCourses(dept, grade)" :key="course.id" class="relative group" @mouseenter="hoveredCourseId = course.id; checkTooltipOnEnter(course.id)" @mouseleave="hoveredCourseId = null; hideTooltip()">
                  <button
                    :ref="el => setCourseCardRef(course.id, el as Element | null)"
                    type="button"
                    @click="handleCourseClick(course.id)"
                    @focus="hoveredCourseId = course.id; checkTooltipOnEnter(course.id)"
                    @blur="hoveredCourseId = null; hideTooltip()"
                    :aria-pressed="!!viewState[course.id]?.isSelected"
                    :aria-label="cardAriaLabel(course.id)"
                    :class="[uiConfig.cardBase, getCardStyles(course.id)]"
                  >
                    <div class="pr-1 flex-1 flex items-center"><h3 class="font-semibold tracking-tight text-[13px] leading-snug">{{ viewState[course.id]?.name || course.raw.name }}</h3></div>
                    <div v-if="ratingOf(course.id).value" class="w-full h-[3px] bg-black/5 dark:bg-white/10 rounded-full overflow-hidden mt-1"><div class="h-full transition-all duration-0" :class="viewState[course.id]?.status === 'selected' ? 'bg-white/40' : 'bg-black/20 dark:bg-white/30'" :style="{ width: `${(ratingOf(course.id).value / 10) * 100}%` }"></div></div>
                  </button>
                  <div class="absolute right-[6px] top-[6px] flex flex-col gap-[6px] z-20">
                    <button type="button" @click.stop="openCourseInfo(course.id)" :aria-label="`Details for ${viewState[course.id]?.name || course.raw.name}`" :class="[uiConfig.iconBtn, getInfoBtnStyles(course.id)]">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                      </svg>
                    </button>
                    <button v-if="moveUpState.active && moveUpState.sourceId === course.id" type="button" @click.stop="cancelMoveUpMode" class="inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm bg-[#FF3B30] border-[#FF3B30] text-white hover:bg-[#FF453A] opacity-100 active:bg-[#D70015] transition-colors duration-0">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <button v-else-if="!moveUpState.active && viewState[course.id]?.isSelected && viewState[course.id]?.moveUpAvailable && !viewState[course.id]?.isMoveUpSource" 
                      type="button" 
                      @click.stop="viewState[course.id]?.validMoveUpTargets?.length ? startMoveUp(course.id) : null" 
                      @mouseenter.stop="viewState[course.id]?.validMoveUpTargets?.length ? showTooltip('Select a course to move-up to from ' + (viewState[course.id]?.name || course.raw.name), 'move-up-btn') : showTooltip('No move-ups are available for this course in the current configuration', 'cancel')" 
                      @mouseleave.stop="hideTooltip(); checkTooltipOnEnter(course.id)" 
                      :class="[
                        'inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200',
                        viewState[course.id]?.validMoveUpTargets?.length 
                          ? 'bg-white dark:bg-white border-[#FF9500]/40 text-[#FF9500] dark:text-[#FF9500] hover:bg-orange-50 dark:hover:bg-orange-50 active:bg-orange-100 dark:active:bg-orange-100 cursor-pointer' 
                          : 'bg-gray-100 dark:bg-white border-black/10 dark:border-black/10 text-gray-400 dark:text-gray-400 cursor-not-allowed'
                      ]">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 17L17 7m0 0H9m8 0v8"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Summary View -->
          <div v-else class="pt-2 px-2 space-y-0.5 relative min-h-full pb-[156px]" :style="gridWrapperStyle">
            <template v-for="dept in visibleDepts" :key="dept">
            <p v-if="isNarrow" class="pt-2 pb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-[#8E8E93] sticky left-0">{{ dept }}</p>
            <div :ref="el => setDeptRowRef(dept, el as Element | null)" class="relative min-h-[36px] grid gap-4 px-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg" :style="gradeGridStyle">
              <svg v-if="(deptArrowPaths[dept] || []).length > 0" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-[1]" aria-hidden="true">
                <path v-for="path in deptArrowPaths[dept]" :key="path.key" :data-key="path.key" :d="path.d" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" :stroke-dasharray="path.variant === 'dashed' ? '4 4' : undefined" :class="path.variant === 'dashed' ? 'stroke-[2] stroke-[#FF9500] dark:stroke-[#FF9F0A]' : (moveUpState.active ? 'stroke-[1.5] stroke-black/10 dark:stroke-white/10' : 'stroke-[1.5] stroke-[#007AFF] dark:stroke-[#0A84FF]')" />
              </svg>
              <div v-for="grade in grades" :key="grade" class="relative z-10 flex items-center justify-center min-h-[36px]">
                <button 
                  v-if="getCollapsedSummary(dept, grade)" 
                  type="button" 
                  @click="handleCollapsedClick(getCollapsedSummary(dept, grade)!.id)" 
                  @mouseenter="hoveredCourseId = getCollapsedSummary(dept, grade)!.id; checkTooltipOnEnter(getCollapsedSummary(dept, grade)!.id)"
                  @mouseleave="hoveredCourseId = null; hideTooltip()"
                  :aria-label="cardAriaLabel(getCollapsedSummary(dept, grade)!.id)"
                  class="w-full min-h-[28px] py-1 px-2 rounded-[6px] border text-left text-[11px] font-medium flex items-center justify-between gap-1 shadow-sm transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]" 
                  :class="getSummaryStyles(getCollapsedSummary(dept, grade)!.id)" 
                  :ref="el => setCollapsedSummaryRef(dept, grade, el as Element | null)"
                >
                  <span class="truncate block flex-1 leading-normal">{{ viewState[getCollapsedSummary(dept, grade)!.id]?.name || getCollapsedSummary(dept, grade)!.raw.name }}</span>
                  <div v-if="moveUpState.active && moveUpState.sourceId === getCollapsedSummary(dept, grade)!.id" class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF3B30] text-white hover:bg-[#FF453A] transition-colors" @click.stop="cancelMoveUpMode">
                    <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </div>
                  <svg v-else-if="viewingCourseId === getCollapsedSummary(dept, grade)!.id" class="w-3 h-3 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                </button>
                <div v-else class="w-full h-7 rounded-[6px] border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-[10px] font-medium text-[#8E8E93]/50 bg-black/[0.01] dark:bg-white/[0.01]" :ref="el => setCollapsedSummaryRef(dept, grade, el as Element | null)">-</div>
              </div>
            </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div
        class="shrink-0 bg-[#F2F2F7] dark:bg-[#282829] z-20 flex flex-col border-l border-black/10 dark:border-white/10"
        :style="rightPanelStyle"
        :class="rightPanelClass"
      >
        <div v-if="!isNarrow" class="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30" @mousedown="startRightResize"></div>
        <button v-if="isRightPanelOpen" @click="closeRightPanel" aria-label="Close panel" class="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:bg-black/10 active:bg-black/20 transition-colors duration-0 z-50">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <Transition name="panel-content-fade" mode="out-in">
          <div v-if="viewingCourseId" :key="`course:${viewingCourseId}`" class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col h-full relative select-text">
            <div class="flex justify-between items-start mb-4 gap-2">
              <div class="px-2 py-0.5 bg-blue-100 dark:bg-[#007AFF]/20 text-[#007AFF] dark:text-[#0A84FF] font-semibold text-[9px] uppercase tracking-wider rounded-md truncate">{{ activeRaw?.dept }} • G{{ activeVm?.grade || activeRaw?.grade }}</div>
            </div>
            <h2 class="text-lg font-semibold tracking-tight text-black dark:text-white leading-tight mb-5 pr-8">{{ activeVm?.name || activeRaw?.raw.name }}</h2>
            <div class="mb-5 rounded-[12px] border border-black/5 dark:border-white/5 p-3 bg-white/50 dark:bg-white/5 shadow-sm">
              <div class="flex justify-between items-end mb-2">
                <div><div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Crowd Rating</div><div class="text-xl font-bold text-black dark:text-white">{{ formatRating(activeRating.value) }}<span class="text-[10px] font-medium opacity-40 ml-0.5">/ 10</span></div></div>
                <div class="text-[9px] font-medium text-[#8E8E93] pb-1">{{ activeRating.voteCount === 1 ? '1 student vote' : `${activeRating.voteCount} student votes` }}</div>
              </div>
              <div class="h-1.5 w-full bg-black/5 dark:bg-black/40 rounded-full overflow-hidden"><div class="h-full bg-[#34C759] transition-[width] duration-300" :style="{ width: `${(activeRating.value / 10) * 100}%` }"></div></div>

              <!-- Voting: one vote per course, per person. Locks once cast. -->
              <div class="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
                <div v-if="activeRating.myVote !== null" class="flex items-center gap-1.5 text-[10px] font-semibold text-[#34C759]">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                  You rated this {{ activeRating.myVote }} / 10
                </div>
                <div v-else>
                  <div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5">Rate this course</div>
                  <div class="grid grid-cols-10 gap-[3px]">
                    <button
                      v-for="n in 10" :key="n" type="button"
                      :disabled="isSubmittingVote"
                      @click.stop="submitVote(viewingCourseId!, n)"
                      @mouseenter="hoveredVote = n" @mouseleave="hoveredVote = 0"
                      @focus="hoveredVote = n" @blur="hoveredVote = 0"
                      :aria-label="`Rate this course ${n} out of 10`"
                      class="h-6 rounded-[5px] text-[9px] font-bold transition-colors duration-0 disabled:opacity-40"
                      :class="n <= hoveredVote ? 'bg-[#34C759] text-white' : 'bg-black/5 dark:bg-white/10 text-[#8E8E93] hover:bg-black/10 dark:hover:bg-white/20'"
                    >{{ n }}</button>
                  </div>
                  <div class="text-[9px] text-[#8E8E93] mt-1.5 leading-tight">Anonymous, and you can only vote once per course.</div>
                </div>
                <div v-if="voteError" class="text-[9px] text-[#FF3B30] mt-1.5 font-medium">{{ voteError }}</div>
              </div>
            </div>
            <div v-if="activeVm?.isMoveUpTarget" class="mb-5 py-2 px-3 rounded-lg border bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500] dark:text-[#FF9F0A]"><div class="text-[9px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div><div class="font-medium text-[11px] mt-0.5 leading-tight">Moved up from {{ getCourseName(activeVm.moveUpSourceId) }}</div></div>
            <div v-else-if="activeVm?.isMoveUpSource" class="mb-5 p-1 rounded-[12px] border bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-500/50 text-orange-700 dark:text-orange-400">
              <div class="px-2 py-1.5">
                <div class="text-[9px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
                <div class="font-medium text-[11px] mt-0.5 leading-tight">Moved up to {{ getCourseName(activeVm.moveUpTargetId) }}</div>
              </div>
              <button v-if="!activeVm?.isLockedMoveUpSource" @click="removeMoveUp(viewingCourseId!)" class="w-full py-2 rounded-[9px] bg-[#FF9500] text-white text-[10px] font-bold hover:bg-[#FF9F0A] active:bg-[#E68600] shadow-sm transition-colors duration-0">Cancel Move-Up</button>
              <div v-else class="w-full py-2 rounded-[9px] bg-orange-200/50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-[10px] font-bold text-center opacity-70 cursor-not-allowed">Locked by dependencies</div>
            </div>
            <div class="space-y-4">
              <div><h4 class="text-[9px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1 ml-0.5">Description</h4><p class="whitespace-pre-line text-[12px] leading-relaxed bg-white/50 dark:bg-white/5 p-2.5 rounded-lg border border-black/5 dark:border-white/5">{{ activeRaw?.raw.description || 'No description available' }}</p></div>
              <div v-if="activeRaw?.raw.crowdReview"><h4 class="text-[9px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1 ml-0.5">Notes</h4><p class="text-[12px] leading-relaxed bg-[#FF9500]/5 dark:bg-[#FF9500]/10 p-2.5 rounded-lg border border-[#FF9500]/10 dark:border-[#FF9500]/20">{{ activeRaw?.raw.crowdReview }}</p></div>
            </div>
          </div>
          <div v-else-if="showPlanPanel" key="plan" class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col h-full relative">
            <div class="flex items-baseline justify-between gap-2 mb-4 pr-8">
              <h2 class="text-lg font-semibold tracking-tight text-black dark:text-white leading-tight">My 4-year plan</h2>
              <span class="text-[11px] font-medium text-[#8E8E93] shrink-0 tabular-nums">{{ planCount }} course{{ planCount === 1 ? '' : 's' }}</span>
            </div>

            <p v-if="planCount === 0" class="text-[12px] leading-relaxed text-[#8E8E93] bg-white/50 dark:bg-white/5 p-3 rounded-lg border border-black/5 dark:border-white/5">
              Nothing selected yet. Pick any course in the grid and the prerequisites it implies are filled in for you.
            </p>

            <div v-else class="space-y-4">
              <div v-for="group in planByGrade" :key="group.grade">
                <h4 class="text-[9px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1 ml-0.5">Grade {{ group.grade }}</h4>
                <p v-if="group.courses.length === 0" class="text-[11px] text-[#8E8E93]/70 italic px-2.5 py-1.5 rounded-lg border border-dashed border-black/10 dark:border-white/10">Nothing planned</p>
                <ul v-else class="space-y-1">
                  <li v-for="entry in group.courses" :key="entry.id" class="flex items-center gap-1.5 bg-white/60 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 pl-2.5 pr-1 py-1.5">
                    <button type="button" @click="revealCourse(entry.id)" class="flex-1 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] rounded">
                      <div class="text-[12px] font-medium text-black dark:text-white leading-tight truncate">{{ entry.name }}</div>
                      <div class="text-[9px] font-medium text-[#8E8E93] truncate">
                        {{ entry.dept }}<template v-if="entry.movedUpFrom"> • moved up from {{ entry.movedUpFrom }}</template>
                      </div>
                    </button>
                    <button type="button" @click="removeFromPlan(entry.id)" :aria-label="`Remove ${entry.name} from the plan`" class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[#8E8E93] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30]">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="planCount > 0" class="mt-5 pt-4 border-t border-black/5 dark:border-white/10 flex flex-col gap-2">
              <button @click="copyShareLink" class="w-full py-2 rounded-[9px] bg-[#007AFF] text-white text-[11px] font-bold hover:bg-[#0070EB] active:bg-[#0062D1] shadow-sm transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2">Copy share link</button>
              <button @click="clearPlan" class="w-full py-2 rounded-[9px] bg-[#FF3B30]/10 text-[#FF3B30] text-[11px] font-bold hover:bg-[#FF3B30]/20 active:bg-[#FF3B30]/30 transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30]">Clear plan</button>
              <p class="text-[9px] leading-relaxed text-[#8E8E93] text-center mt-1">Your plan is saved on this device automatically.</p>
            </div>
          </div>
          <div v-else-if="showAboutPanel" key="about" class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col h-full relative select-text">
            <div class="flex flex-col items-center flex-1 pb-6 mt-8">
              <img src="/cc-icon.png" class="w-32 h-32 shrink-0 object-contain mx-auto drop-shadow-sm mb-6 pointer-events-none" draggable="false" alt="Icon" />
              <h2 class="text-[20px] font-bold tracking-tight text-center text-black dark:text-white leading-tight mb-1.5">SHSID Interactive Course Catalog</h2>
              <p class="text-center text-[#8E8E93] dark:text-[#98989D] font-medium text-[13px] mb-6">Frontend version {{ APP_VERSION }}</p>
              <div class="w-full bg-[#007AFF]/5 border border-[#007AFF]/20 dark:bg-[#007AFF]/10 dark:border-[#007AFF]/30 p-4 rounded-xl text-black dark:text-white text-[13px] space-y-3 shadow-sm leading-relaxed my-4">Maintainer, prototypes, concepts: <a href="https://github.com/ziqian-huang0607" target="_blank" class="font-semibold text-[#007AFF] hover:underline underline-offset-2">Ziqian Huang</a><br>Backend, UI designs, course content: <a href="https://github.com/willuhd" target="_blank" class="font-semibold text-[#007AFF] hover:underline underline-offset-2">Will Chen</a></div>
              <div class="w-full bg-[#FF9500]/5 border border-[#FF9500]/20 dark:bg-[#FF9500]/10 dark:border-[#FF9500]/30 p-4 rounded-xl text-black dark:text-white text-[13px] shadow-sm leading-relaxed my-4"><strong>⚠️ Disclaimer:</strong> {{ DISCLAIMER }}</div>
              <p class="text-center font-semibold text-black dark:text-white text-[13px] mt-6 mb-5">Built by Ziqian Huang and Will Chen — Indexademics team and Data Science club</p>
              <div class="flex justify-center items-center gap-6 mt-2"><img src="/idx-icon.png" class="w-16 h-16 shrink-0 object-contain drop-shadow-sm pointer-events-none" draggable="false" /><img src="/ds-icon.png" class="w-16 h-16 shrink-0 object-contain drop-shadow-sm pointer-events-none" draggable="false" /></div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- INVISIBLE EXPORT TARGET -->
    <div class="fixed top-0 left-[300vw] w-[1200px] pointer-events-none z-[-10]">
      <div ref="exportRef" class="w-full bg-white text-black p-12 flex flex-col font-sans">
        <div class="flex justify-between items-center mb-6 pb-6 border-b-2 border-gray-100 h-24">
          <div class="flex items-center h-full">
            <img src="/cc-icon.png" class="w-20 h-20 object-contain mr-6" />
            <div class="flex flex-col justify-center h-full">
              <h1 class="text-[36px] font-bold tracking-tight text-black leading-none">4-Year Academic Plan</h1>
              <p class="text-[#8E8E93] font-semibold text-[17px] mt-2 tracking-tight leading-none">{{ catalogData?.catalogName }}</p>
            </div>
          </div>
          <div class="text-right flex flex-col gap-0.5 text-[11px] font-normal text-gray-500 tracking-normal">
            <div>Frontend: {{ APP_VERSION }}</div>
            <div>Backend: {{ catalogData?.version }}</div>
            <div>Updated on: {{ catalogData?.lastUpdated }}</div>
            <div>Generated: {{ new Date().toLocaleDateString() }}</div>
          </div>
        </div>
        <div class="flex flex-col rounded-[16px] overflow-hidden border border-gray-200 shadow-sm bg-gray-50/20">
          <div class="grid bg-[#F2F2F7] border-b border-gray-200" :style="exportGridStyle">
            <div class="h-10 flex items-center px-8 text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Department</div>
            <div v-for="grade in grades" :key="grade" class="h-10 flex items-center justify-center font-bold text-gray-600 text-[12px]">Grade {{ grade }}</div>
          </div>
          <div v-for="(gradeMap, dept) in exportPlan" :key="dept" class="grid border-b border-gray-100 last:border-b-0 bg-white" :style="exportGridStyle">
            <div class="bg-[#F2F2F7]/40 px-8 py-2 flex items-center border-r border-gray-200"><span class="text-[12px] font-bold text-gray-800 leading-tight">{{ String(dept).trim() }}</span></div>
            <div v-for="grade in grades" :key="grade" class="relative flex flex-col items-center justify-center p-1.5 border-r border-gray-50 last:border-r-0 min-h-[54px]">
              <template v-if="getGradeExitPoint(String(dept), grade)">
                <div class="w-full h-full flex flex-col items-center justify-center px-3 py-2 rounded-md border-2 font-bold text-[11px] shadow-sm" :class="viewState[getGradeExitPoint(String(dept), grade)!]?.isMoveUpTarget ? 'bg-[#FF9500]/5 border-[#FF9500] text-[#FF9500]' : 'bg-[#007AFF]/5 border-[#007AFF] text-[#007AFF]'">
                  <template v-if="viewState[getGradeExitPoint(String(dept), grade)!]?.isMoveUpTarget">
                    <div class="flex items-center gap-1.5 whitespace-nowrap leading-tight">
                      <span class="opacity-50 font-medium normal-case">{{ getCourseName(viewState[getGradeExitPoint(String(dept), grade)!]?.moveUpSourceId) }}</span>
                      <span class="text-[#FF9500] text-[13px]">&rarr;</span>
                      <span>{{ getCourseName(getGradeExitPoint(String(dept), grade)!) }}</span>
                    </div>
                  </template>
                  <template v-else><div class="text-center leading-tight">{{ getCourseName(getGradeExitPoint(String(dept), grade)!) }}</div></template>
                </div>
              </template>
              <div v-else class="text-gray-200 font-black text-lg leading-tight">-</div>
            </div>
          </div>
        </div>
        <div class="mt-8 flex flex-col items-center gap-2">
          <p class="text-[11px] text-gray-400 font-medium text-center leading-relaxed max-w-[900px]"><span class="font-bold text-gray-500 tracking-tighter mr-2">DISCLAIMER:</span> {{ DISCLAIMER }}</p>
          <p class="text-[11px] text-gray-400 font-medium text-center">Built by Ziqian Huang and Will Chen — Indexademics team and Data Science club</p>
        </div>
      </div>
    </div>

    <!-- Status line: doubles as the screen-reader announcement channel -->
    <div class="sr-only" role="status" aria-live="polite">{{ statusMessage }}</div>
    <Transition name="tooltip-pop">
      <div v-if="statusMessage" class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] max-w-[90vw] rounded-full bg-[#1C1C1E]/95 dark:bg-white/95 px-4 py-2 text-[12px] font-medium text-white dark:text-black shadow-lg pointer-events-none">
        {{ statusMessage }}
      </div>
    </Transition>

    <!-- Tooltip -->
    <div v-if="activeTooltip.visible" class="fixed pointer-events-none" :class="tooltipThemeClass" :style="tooltipStyle">{{ activeTooltip.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { inject } from '@vercel/analytics';
import { CourseSelectionController } from './backend/Controller';
import { Updater } from './backend/Updater';
import { RatingStore } from './backend/RatingStore';
import type { EffectiveRating } from './backend/RatingStore';
import type { CourseModel, CourseNode } from './backend/CourseModel';
import type { CourseViewModel } from './backend/ViewModel';
import { decodePlan, encodePlan, isEmptyPlan, plansEqual, type PlanSnapshot } from './backend/PlanCodec';
import { clearSavedPlan, loadPlan, loadPreferences, savePlan, savePreferences, type Preferences } from './backend/Persistence';

const APP_VERSION = "v0.3, revision 24";
const DISCLAIMER = "This is an unofficial tool and isn't affiliated with SHSID. All content derived from the Course Catalog and is for internal reference purposes only. Course availability and policies are subject to change by the school administration. Please schedule a meeting with your homeroom teacher for accurate results!";

interface CourseMeta { id: string; dept: string; grade: string; raw: CourseNode; searchText: string; }
interface ArrowPath { key: string; d: string; variant: 'solid' | 'dashed'; }
interface TooltipState { visible: boolean; text: string; theme?: 'default' | 'move-up-btn' | 'move-up-ready' | 'cancel'; }

const uiConfig = {
  cardBase: 'w-full min-h-[58px] text-left px-2.5 py-2 pr-6 rounded-xl relative overflow-hidden border flex flex-col justify-between gap-1 shadow-sm transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#007AFF] dark:focus-visible:ring-offset-[#1C1C1E]',
  iconBtn: 'inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors duration-0 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
  menuItem: 'text-left px-3 py-1.5 text-[13px] font-medium hover:bg-[#007AFF] hover:text-white rounded-lg text-black dark:text-white active:bg-[#0062D1] transition-colors duration-0 outline-none focus-visible:bg-[#007AFF] focus-visible:text-white'
};

const appContainer = ref<HTMLElement | null>(null);
const catalogData = ref<CourseModel | null>(null);
const loadError = ref<string | null>(null);
const viewState = ref<Record<string, CourseViewModel>>({});
const controller = ref<CourseSelectionController | null>(null);
const viewingCourseId = ref<string | null>(null);
const showAboutPanel = ref<boolean>(false);
const showPlanPanel = ref<boolean>(false);
const isRightPanelOpen = computed(() => !!viewingCourseId.value || showAboutPanel.value || showPlanPanel.value);
const isLoading = ref<boolean>(true);
// Set when the catalog came from the local cache rather than the network, so the
// student is told the data may be behind instead of quietly trusting it.
const catalogNotice = ref<string | null>(null);

const isDarkMode = ref<boolean>(false);
const searchQuery = ref<string>('');
const selectedDept = ref<string | null>(null);
const pressingDept = ref<string | null>(null);
const hoveredCourseId = ref<string | null>(null);
const tooltip = ref<TooltipState>({ visible: false, text: '', theme: 'default' });
const deptArrowPaths = ref<Record<string, ArrowPath[]>>({});
const showExportDropdown = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// --- Responsive layout ---
// Below `md` the two resizable panels stop being panels: a 280px sidebar plus a
// four-column grid leaves a phone with about 25px per grade. They become overlays
// instead, and the grid scrolls sideways at a legible column width.
const NARROW_QUERY = '(max-width: 767px)';
const isNarrow = ref(false);
const isSidebarOpen = ref(false);
let narrowQuery: MediaQueryList | null = null;
const onNarrowChange = (event: MediaQueryListEvent | MediaQueryList) => {
  isNarrow.value = event.matches;
  if (!event.matches) isSidebarOpen.value = false;
  scheduleArrowRefresh();
};
const MIN_GRADE_COLUMN_PX = 150;

// --- Filters ---
const activeTracks = ref<Set<string>>(new Set());
const showSelectedOnly = ref(false);

// --- Transient status line, also used as the screen-reader announcement ---
const statusMessage = ref<string>('');
let statusTimer: ReturnType<typeof setTimeout> | null = null;
const announce = (message: string) => {
  statusMessage.value = message;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusMessage.value = ''; }, 4000);
};

// --- Undo / redo ---
// Plan snapshots are small and cheap to diff, so the whole history is just a list
// of them; every mutation records the state it replaced.
const undoStack = ref<PlanSnapshot[]>([]);
const redoStack = ref<PlanSnapshot[]>([]);
const HISTORY_LIMIT = 100;
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

// --- Crowd rating / voting ---
const ratingStore = new RatingStore();
const ratingsVersion = ref(0); // bumped by the store so computed ratings re-run
const hoveredVote = ref(0);
const isSubmittingVote = ref(false);
const voteError = ref<string | null>(null);

const isExporting = ref(false);
const exportRef = ref<HTMLElement | null>(null);
const mouseX = ref(0);
const mouseY = ref(0);
const moveUpState = ref<{ active: boolean; sourceId: string | null; targetIds: string[]; }>({ active: false, sourceId: null, targetIds: [] });

const preferences = loadPreferences();
const leftPanelWidth = ref(preferences.leftPanelWidth);
const rightPanelWidth = ref(preferences.rightPanelWidth);
const isResizingLeft = ref(false);
const isResizingRight = ref(false);

const persistPreferences = () => {
  const next: Preferences = {
    darkMode: isDarkMode.value,
    leftPanelWidth: leftPanelWidth.value,
    rightPanelWidth: rightPanelWidth.value
  };
  savePreferences(next);
};

const startLeftResize = (event: MouseEvent) => { isResizingLeft.value = true; window.addEventListener('mousemove', doLeftResize); window.addEventListener('mouseup', stopLeftResize); event.preventDefault(); };
const doLeftResize = (event: MouseEvent) => { if (!isResizingLeft.value || !appContainer.value) return; const rect = appContainer.value.getBoundingClientRect(); leftPanelWidth.value = Math.max(180, Math.min(event.clientX - rect.left, 400)); };
const stopLeftResize = () => { if (isResizingLeft.value) persistPreferences(); isResizingLeft.value = false; window.removeEventListener('mousemove', doLeftResize); window.removeEventListener('mouseup', stopLeftResize); };
const startRightResize = (event: MouseEvent) => { isResizingRight.value = true; window.addEventListener('mousemove', doRightResize); window.addEventListener('mouseup', stopRightResize); event.preventDefault(); };
const doRightResize = (event: MouseEvent) => { if (!isResizingRight.value || !appContainer.value) return; const rect = appContainer.value.getBoundingClientRect(); rightPanelWidth.value = Math.max(220, Math.min(rect.right - event.clientX, 450)); };
const stopRightResize = () => { if (isResizingRight.value) persistPreferences(); isResizingRight.value = false; window.removeEventListener('mousemove', doRightResize); window.removeEventListener('mouseup', stopRightResize); };

const leftScrollRef = ref<HTMLElement | null>(null);
const rightScrollRef = ref<HTMLElement | null>(null);
let isSyncingLeft = false;
let isSyncingRight = false;
const deptRowRefs = new Map<string, HTMLElement>();
const courseCardRefs = new Map<string, HTMLElement>();
const collapsedSummaryRefs = new Map<string, HTMLElement>();
let arrowFrame = 0;
let resizeObserver: ResizeObserver | null = null;
let panelAnimationRaf: number | null = null;

const handlePanelTransition = () => {
    const startTime = performance.now();
    const animate = (now: number) => {
        recomputeArrowPaths();
        if (now - startTime < 500) { panelAnimationRaf = requestAnimationFrame(animate); }
    };
    if (panelAnimationRaf) cancelAnimationFrame(panelAnimationRaf);
    panelAnimationRaf = requestAnimationFrame(animate);
};

// Keyboard is a first-class way to drive this: Escape backs out of whatever is
// open, "/" jumps to search, and the usual undo/redo chords edit the plan.
const handleKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  const isTypingField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

  if (event.key === 'Escape') {
    if (showExportDropdown.value) showExportDropdown.value = false;
    else if (moveUpState.value.active) cancelMoveUpMode();
    else if (isTypingField && searchQuery.value) { searchQuery.value = ''; }
    else if (isRightPanelOpen.value) closeRightPanel();
    else if (isSidebarOpen.value) isSidebarOpen.value = false;
    else if (hasActiveFilters.value) clearFilters();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
    return;
  }

  if (isTypingField) return;

  if (event.key === '/') {
    event.preventDefault();
    searchInputRef.value?.focus();
    searchInputRef.value?.select();
  }
};
const closeDropdown = (e: Event) => { if (!(e.target as Element).closest('.export-menu-container')) showExportDropdown.value = false; };
const updateMousePosition = (e: MouseEvent) => { mouseX.value = e.clientX; mouseY.value = e.clientY; };
const setupScrollSync = (enable: boolean) => { const leftEl = leftScrollRef.value; const rightEl = rightScrollRef.value; if (!leftEl || !rightEl) return; leftEl.removeEventListener('scroll', onLeftScroll); rightEl.removeEventListener('scroll', onRightScroll); if (enable) { leftEl.addEventListener('scroll', onLeftScroll); rightEl.addEventListener('scroll', onRightScroll); } };
const onLeftScroll = (e: Event) => { if (isSyncingLeft) { isSyncingLeft = false; return; } if (rightScrollRef.value) { isSyncingRight = true; rightScrollRef.value.scrollTop = (e.target as HTMLElement).scrollTop; } };
const onRightScroll = (e: Event) => { if (isSyncingRight) { isSyncingRight = false; return; } if (leftScrollRef.value) { isSyncingLeft = true; leftScrollRef.value.scrollTop = (e.target as HTMLElement).scrollTop; } };

const grades = computed<string[]>(() => catalogData.value?.grades || []);
// The grid used to hardcode four columns; drive it off the catalog so a catalog
// shipping a different number of grades still lines up with its column headers.
const gradeGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(1, grades.value.length)}, minmax(0, 1fr))`,
  minWidth: isNarrow.value ? `${Math.max(1, grades.value.length) * MIN_GRADE_COLUMN_PX}px` : undefined
}));
// The scrolling wrapper has to clear its own padding on top of the grid width, or
// the last grade column ends up under the edge of the viewport.
const gridWrapperStyle = computed(() => (isNarrow.value
  ? { minWidth: `${Math.max(1, grades.value.length) * MIN_GRADE_COLUMN_PX + 48}px` }
  : {}));

const sidebarStyle = computed(() => (isNarrow.value
  ? { width: 'min(300px, 85vw)', transform: isSidebarOpen.value ? 'translateX(0)' : 'translateX(-100%)' }
  : { width: leftPanelWidth.value + 'px', marginLeft: isRightPanelOpen.value ? -leftPanelWidth.value + 'px' : '0px' }));

const sidebarClass = computed(() => (isNarrow.value
  ? ['absolute inset-y-0 left-0 z-40 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]', isSidebarOpen.value ? '' : 'pointer-events-none']
  : ['relative transition-[margin-left] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]', isRightPanelOpen.value ? 'pointer-events-none' : '', isResizingLeft.value ? 'no-transition' : '']));

const rightPanelStyle = computed(() => (isNarrow.value
  ? { width: '100%', transform: isRightPanelOpen.value ? 'translateX(0)' : 'translateX(100%)' }
  : { width: rightPanelWidth.value + 'px', marginRight: isRightPanelOpen.value ? '0px' : -rightPanelWidth.value + 'px' }));

const rightPanelClass = computed(() => (isNarrow.value
  ? ['absolute inset-y-0 right-0 z-40 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]', isRightPanelOpen.value ? '' : 'pointer-events-none']
  : ['relative transition-[margin-right] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]', isRightPanelOpen.value ? '' : 'pointer-events-none', isResizingRight.value ? 'no-transition' : '']));
const exportGridStyle = computed(() => ({ gridTemplateColumns: `240px repeat(${Math.max(1, grades.value.length)}, minmax(0, 1fr))` }));
const makeCourseMeta = (course: CourseNode, dept: string, grade: string): CourseMeta => ({
  id: course.id,
  dept,
  grade,
  raw: course,
  searchText: `${course.id} ${course.name || ''} ${course.track || ''} ${course.level || ''} ${dept} ${course.description || ''}`.toLowerCase()
});

const allCourses = computed<CourseMeta[]>(() => {
  if (!catalogData.value) return [];
  const list: CourseMeta[] = [];
  for (const [dept, deptData] of Object.entries(catalogData.value.departments)) {
    // `residuals` is a flat CourseNode[] rather than a { grade: CourseNode[] } map.
    // Iterating it like a grade map yields CourseNode values and throws on `for...of`.
    if (Array.isArray(deptData)) {
      for (const course of deptData as CourseNode[]) {
        if (course?.id) list.push(makeCourseMeta(course, dept, 'Residual'));
      }
      continue;
    }
    if (!deptData || typeof deptData !== 'object') continue;
    for (const [gradeLevel, courseArray] of Object.entries(deptData as Record<string, CourseNode[]>)) {
      if (!Array.isArray(courseArray)) continue;
      for (const course of courseArray) {
        if (course?.id) list.push(makeCourseMeta(course, dept, gradeLevel));
      }
    }
  }
  return list;
});

const courseMetaById = computed(() => { const map = new Map<string, CourseMeta>(); allCourses.value.forEach(course => map.set(course.id, course)); return map; });
const allCoursesByBucket = computed(() => { const buckets = new Map<string, CourseMeta[]>(); allCourses.value.forEach(course => { const key = `${course.dept}::${course.grade}`; const bucket = buckets.get(key) ?? []; bucket.push(course); buckets.set(key, bucket); }); return buckets; });
// Every filter the sidebar can apply, in one predicate so the department list, the
// grid and the "no results" state can never disagree about what is visible.
const matchesFilters = (course: CourseMeta): boolean => {
  const query = searchQuery.value.trim().toLowerCase();
  if (query && !course.searchText.includes(query)) return false;
  if (activeTracks.value.size > 0 && !activeTracks.value.has(course.raw.track)) return false;
  if (showSelectedOnly.value) {
    const vm = viewState.value[course.id];
    if (!vm?.isSelected && !vm?.isMoveUpTarget) return false;
  }
  return true;
};

const availableTracks = computed<string[]>(() => {
  const seen = new Set<string>();
  allCourses.value.forEach(course => { if (course.raw.track) seen.add(course.raw.track); });
  // Catalog order first (it is meaningful: school, AP, IB, ...), then any stragglers.
  const ordered = (catalogData.value?.tracks || []).filter(track => seen.has(track));
  seen.forEach(track => { if (!ordered.includes(track)) ordered.push(track); });
  return ordered;
});

const matchedCourses = computed<CourseMeta[]>(() => allCourses.value.filter(matchesFilters));
const visibleDeptHasNoMatches = computed(() => !!selectedDept.value && !matchedCourses.value.some(course => course.dept === selectedDept.value));
const hasActiveFilters = computed(() => !!searchQuery.value.trim() || activeTracks.value.size > 0 || showSelectedOnly.value);

const clearFilters = () => {
  searchQuery.value = '';
  activeTracks.value = new Set();
  showSelectedOnly.value = false;
};

const toggleTrack = (track: string) => {
  const next = new Set(activeTracks.value);
  if (next.has(track)) next.delete(track); else next.add(track);
  activeTracks.value = next;
  scheduleArrowRefresh();
};

const activeDepartments = computed(() => {
  const matchedDepts = new Set<string>();
  matchedCourses.value.forEach(course => matchedDepts.add(course.dept));
  return Array.from(matchedDepts);
});
const visibleDepts = computed(() => selectedDept.value ? [selectedDept.value] : activeDepartments.value);
const collapsedDepts = computed(() => { if (selectedDept.value === null) return new Set(activeDepartments.value); const s = new Set(activeDepartments.value); s.delete(selectedDept.value); return s; });
const activeVm = computed(() => viewingCourseId.value ? viewState.value[viewingCourseId.value] : null);
const activeRaw = computed(() => viewingCourseId.value ? courseMetaById.value.get(viewingCourseId.value) || null : null);

const exportPlan = computed(() => {
  const plan: Record<string, Record<string, CourseMeta[]>> = {};
  for (const course of allCourses.value) {
    const vm = viewState.value[course.id];
    if (vm && vm.isSelected) {
      let deptPlan = plan[course.dept];
      if (!deptPlan) {
        deptPlan = {};
        plan[course.dept] = deptPlan;
      }
      
      let gradePlan = deptPlan[course.grade];
      if (!gradePlan) {
        gradePlan = [];
        deptPlan[course.grade] = gradePlan;
      }
      
      gradePlan.push(course);
    }
  }
  return plan;
});

const hasSelectedCourses = computed(() => Object.keys(exportPlan.value).length > 0);

// html2canvas and jsPDF together are most of the JavaScript this app ships, and
// they are only needed once a student actually exports, so they are fetched on
// demand rather than on every page load.
const triggerExport = async (type: 'png' | 'pdf') => {
  if (!exportRef.value) return;
  isExporting.value = true; showExportDropdown.value = false;
  await nextTick(); await new Promise(r => setTimeout(r, 200));
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(exportRef.value, { scale: 3, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1200 });
    if (type === 'png') { canvas.toBlob(blob => { if(!blob) return; const url = URL.createObjectURL(blob); const newTab = window.open(url, '_blank'); if (!newTab) Object.assign(document.createElement('a'), { href: url, download: 'Plan.png' }).click(); }, 'image/png'); }
    else { const { jsPDF } = await import('jspdf'); const imgData = canvas.toDataURL('image/png'); const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] }); pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height); const blob = pdf.output('blob'); const url = URL.createObjectURL(blob); const newTab = window.open(url, '_blank'); if (!newTab) Object.assign(document.createElement('a'), { href: url, download: 'Plan.pdf' }).click(); }
  } catch (error) { console.error(error); announce('Export failed. Please try again.'); } finally { isExporting.value = false; }
};

const getCourses = (dept: string, grade: string) => (allCoursesByBucket.value.get(`${dept}::${grade}`) || []).filter(matchesFilters);
const getAllBucketCourses = (dept: string, grade: string) => allCoursesByBucket.value.get(`${dept}::${grade}`) || [];

const toggleDarkMode = () => { 
  document.documentElement.classList.add('theme-transition');
  isDarkMode.value = !isDarkMode.value; 
  document.documentElement.classList.toggle('dark', isDarkMode.value); 
  persistPreferences();
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transition');
  }, 500);
};

const executeMorph = async (oldDept: string | null, newDept: string | null) => {
  const isMorphing = (oldDept === null && newDept !== null) || (oldDept !== null && newDept === null);
  if (!isMorphing) {
    selectedDept.value = newDept;
    setupScrollSync(newDept === null);
    return;
  }

  const targetDept = oldDept || newDept!;
  const isExpanding = newDept !== null;
  const duration = 500;
  const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';

  const oldRects = new Map<string, DOMRect>();
  const oldPaths = new Map<string, string>();
  const columnBgs = new Map<string, string>();
  const rightScrollEl = rightScrollRef.value;
  
  if (!rightScrollEl) {
    selectedDept.value = newDept;
    setupScrollSync(newDept === null);
    return;
  }

  const bucketMap = allCoursesByBucket.value;
  if (isExpanding) {
    grades.value.forEach(g => {
      const el = collapsedSummaryRefs.get(`${targetDept}::${g}`);
      if (el) {
        oldRects.set(`summary-${g}`, el.getBoundingClientRect());
        columnBgs.set(`summary-${g}`, window.getComputedStyle(el).backgroundColor);
      }
    });
  } else {
    grades.value.forEach(g => {
      const exitId = getGradeExitPoint(targetDept, g);
      if (exitId) {
        const el = courseCardRefs.get(exitId);
        if (el) {
          oldRects.set(`summary-${g}`, el.getBoundingClientRect());
          columnBgs.set(`summary-${g}`, window.getComputedStyle(el).backgroundColor);
        }
      } else {
        const bucket = bucketMap.get(`${targetDept}::${g}`) || [];
        if (bucket.length > 0) {
          let minT = Infinity, minL = Infinity, maxB = -Infinity, maxR = -Infinity;
          let bg = '';
          bucket.forEach(c => {
            const cardEl = courseCardRefs.get(c.id);
            if (cardEl) {
              const r = cardEl.getBoundingClientRect();
              minT = Math.min(minT, r.top); minL = Math.min(minL, r.left);
              maxB = Math.max(maxB, r.bottom); maxR = Math.max(maxR, r.right);
              if (!bg) bg = window.getComputedStyle(cardEl).backgroundColor;
            }
          });
          if (minT !== Infinity) {
            oldRects.set(`summary-${g}`, { left: minL, top: minT, width: maxR - minL, height: maxB - minT } as DOMRect);
            columnBgs.set(`summary-${g}`, bg);
          }
        }
      }
    });
  }

  deptArrowPaths.value[targetDept]?.forEach(p => oldPaths.set(p.key, p.d));

  if (isExpanding) {
    selectedDept.value = newDept;
    setupScrollSync(false);
    await nextTick();
    if (rightScrollRef.value) rightScrollRef.value.scrollTop = 0;
  } else {
    const savedScroll = leftScrollRef.value?.scrollTop || 0;
    selectedDept.value = newDept;
    setupScrollSync(true);
    await nextTick();
    if (rightScrollRef.value) rightScrollRef.value.scrollTop = savedScroll;
  }

  recomputeArrowPaths();
  await nextTick();

  if (isExpanding) {
    grades.value.forEach(g => {
      const oldSummaryRect = oldRects.get(`summary-${g}`);
      const sourceBg = columnBgs.get(`summary-${g}`) || 'transparent';
      const bucket = bucketMap.get(`${targetDept}::${g}`) || [];
      const hasSelected = bucket.some(c => viewState.value[c.id]?.isSelected || viewState.value[c.id]?.isMoveUpTarget);

      bucket.forEach(c => {
        const el = courseCardRefs.get(c.id);
        if (!el) return;
        const vm = viewState.value[c.id];
        const isSelected = vm?.isSelected || vm?.isMoveUpTarget;

        if (oldSummaryRect && (isSelected || !hasSelected)) {
          const newRect = el.getBoundingClientRect();
          const dx = oldSummaryRect.left - newRect.left;
          const dy = oldSummaryRect.top - newRect.top;
          const sx = oldSummaryRect.width / newRect.width;
          const sy = oldSummaryRect.height / newRect.height;
          const destBg = window.getComputedStyle(el).backgroundColor;
          el.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'top left', backgroundColor: sourceBg, borderRadius: '6px' },
            { transform: `translate(0, 0) scale(1, 1)`, transformOrigin: 'top left', backgroundColor: destBg, borderRadius: '12px' }
          ], { duration, easing });
        } else {
          el.animate([
            { opacity: 0, transform: 'scale(0.95)' },
            { opacity: 1, transform: 'scale(1)' }
          ], { duration: 300, easing, delay: 50, fill: 'both' });
        }
      });
    });
  } else {
    grades.value.forEach(g => {
      const el = collapsedSummaryRefs.get(`${targetDept}::${g}`);
      const oldCardRect = oldRects.get(`summary-${g}`);
      if (!el) return;

      if (!oldCardRect) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: 'both' });
        return;
      }

      const newRect = el.getBoundingClientRect();
      const dx = oldCardRect.left - newRect.left;
      const dy = oldCardRect.top - newRect.top;
      const sx = oldCardRect.width / newRect.width;
      const sy = oldCardRect.height / newRect.height;
      
      const sourceBg = columnBgs.get(`summary-${g}`) || 'transparent';
      const destBg = window.getComputedStyle(el).backgroundColor;

      el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'top left', backgroundColor: sourceBg, borderRadius: '12px' },
        { transform: `translate(0, 0) scale(1, 1)`, transformOrigin: 'top left', backgroundColor: destBg, borderRadius: '6px' }
      ], { duration, easing });
    });

    activeDepartments.value.forEach(dept => {
        if (dept === targetDept) return;
        const rowEl = deptRowRefs.get(dept);
        if (rowEl) {
            rowEl.animate([
                { opacity: 0 },
                { opacity: 1 }
            ], { duration, easing, fill: 'both' });
        }
    });
  }

  const pathEls = rightScrollEl.querySelectorAll('svg.z-\\[1\\] path');
  pathEls.forEach(pathEl => {
    const key = pathEl.getAttribute('data-key');
    if (key && oldPaths.has(key)) {
      const oldD = oldPaths.get(key)!;
      const newD = pathEl.getAttribute('d')!;
      try {
        pathEl.animate([ { d: `path("${oldD}")` }, { d: `path("${newD}")` } ], { duration, easing });
      } catch (e) {
        pathEl.animate([{opacity:0}, {opacity:1}], {duration, easing});
      }
    } else {
      pathEl.animate([{opacity:0}, {opacity:1}], {duration, easing});
    }
  });
};

const handleToggleDept = (dept: string) => {
  const newDept = selectedDept.value === dept ? null : dept;
  if (isNarrow.value) isSidebarOpen.value = false;
  executeMorph(selectedDept.value, newDept);
};

const openCourseInfo = (courseId: string) => { showAboutPanel.value = false; showPlanPanel.value = false; viewingCourseId.value = courseId; hoveredVote.value = 0; voteError.value = null; };
const openAboutPanel = () => { viewingCourseId.value = null; showPlanPanel.value = false; showAboutPanel.value = true; };

const startMoveUp = (courseId: string) => { 
  if (!controller.value) return; 
  const vm = viewState.value[courseId];
  if (!vm || !vm.validMoveUpTargets?.length) return;
  
  const allTargets = [...vm.validMoveUpTargets, ...Object.keys(vm.invalidMoveUpTargets || {})];
  if (allTargets.length > 0) {
    moveUpState.value = { active: true, sourceId: courseId, targetIds: allTargets }; 
    hideTooltip();
  }
};

const cancelMoveUpMode = () => { 
  moveUpState.value = { active: false, sourceId: null, targetIds: [] }; 
  hideTooltip();
};

const executeMoveUp = (targetId: string) => { if (moveUpState.value.sourceId) { const sourceId = moveUpState.value.sourceId; withHistory(() => controller.value?.setExplicitMoveUp(sourceId, targetId)); cancelMoveUpMode(); hideTooltip(); } };
const removeMoveUp = (sourceId: string) => { withHistory(() => controller.value?.removeExplicitMoveUp(sourceId)); };

const handleCourseClick = (courseId: string) => {
  if (moveUpState.value.active) {
    const sourceVm = viewState.value[moveUpState.value.sourceId!];
    const isInvalid = sourceVm?.invalidMoveUpTargets && courseId in sourceVm.invalidMoveUpTargets;
    
    if (moveUpState.value.targetIds.includes(courseId) && !isInvalid) executeMoveUp(courseId);
    else if (courseId === moveUpState.value.sourceId) cancelMoveUpMode();
    else openCourseInfo(courseId);
    return;
  }
  
  const vm = viewState.value[courseId];
  if (vm?.status === 'locked') { openCourseInfo(courseId); return; }
  
  if (vm?.isMoveUpTarget) {
      if (vm.moveUpSourceId) removeMoveUp(vm.moveUpSourceId);
      return;
  }
  
  if (vm?.isMoveUpSource) {
      if (vm.isLockedMoveUpSource) {
          openCourseInfo(courseId);
      } else {
          removeMoveUp(courseId);
      }
      return;
  }
  
  withHistory(() => controller.value?.handleTap(courseId));
};

const handleCollapsedClick = (courseId: string) => {
  if (moveUpState.value.active) {
    const sourceVm = viewState.value[moveUpState.value.sourceId!];
    const isInvalid = sourceVm?.invalidMoveUpTargets && courseId in sourceVm.invalidMoveUpTargets;

    if (moveUpState.value.targetIds.includes(courseId) && !isInvalid) executeMoveUp(courseId);
    else if (courseId === moveUpState.value.sourceId) cancelMoveUpMode();
    else openCourseInfo(courseId);
    return;
  }
  
  const vm = viewState.value[courseId];
  if (vm?.isMoveUpTarget) {
      if (vm.moveUpSourceId) removeMoveUp(vm.moveUpSourceId);
      return;
  }
  
  if (vm?.isMoveUpSource) {
      if (vm.isLockedMoveUpSource) {
          openCourseInfo(courseId);
      } else {
          removeMoveUp(courseId);
      }
      return;
  }
  
  openCourseInfo(courseId);
};

const handleContentAreaClick = (e: MouseEvent) => { if (!isRightPanelOpen.value) return; if ((e.target as HTMLElement).closest('button')) return; closeRightPanel(); };
const getCourseName = (courseId?: string): string => { if (!courseId) return 'Unknown'; return viewState.value[courseId]?.name || courseMetaById.value.get(courseId)?.raw.name || courseId; };

// The card's colour carries its state for sighted users; the label has to carry the
// same information for anyone reading it with a screen reader.
const cardAriaLabel = (courseId: string): string => {
  const vm = viewState.value[courseId];
  const meta = courseMetaById.value.get(courseId);
  const name = vm?.name || meta?.raw.name || courseId;
  const where = meta ? `${meta.dept}, grade ${meta.grade}` : '';
  const parts = [name, where].filter(Boolean);

  if (vm?.isMoveUpTarget) parts.push(`moved up from ${getCourseName(vm.moveUpSourceId)}`);
  else if (vm?.isSelected) parts.push('in your plan');
  else if (vm?.status === 'locked') parts.push(vm.lockReason ? `unavailable: ${vm.lockReason}` : 'unavailable with your current plan');
  else parts.push('available');

  return parts.join(', ');
};

const checkTooltipOnEnter = (id: string) => {
  const vm = viewState.value[id];
  if (moveUpState.value.active && id === moveUpState.value.sourceId) {
      showTooltip('Cancel move-up selection', 'cancel');
  } else if (!moveUpState.value.active && vm?.isMoveUpSource && vm?.isLockedMoveUpSource) {
      showTooltip("Can't deselect due to a conflict in the current configuration", 'cancel');
  } else if (vm?.status === 'locked' && vm?.lockReason) {
      showTooltip(vm.lockReason);
  }
};
const showTooltip = (text: string, theme: 'default' | 'move-up-btn' | 'move-up-ready' | 'cancel' = 'default') => { if (!text) return; tooltip.value = { visible: true, text, theme }; };
const hideTooltip = () => { tooltip.value.visible = false; tooltip.value.theme = 'default'; };

const activeTooltip = computed<TooltipState>(() => { 
  if (moveUpState.value.active && moveUpState.value.sourceId) {
    if (hoveredCourseId.value === moveUpState.value.sourceId) return { visible: true, text: 'Cancel move-up selection', theme: 'cancel' };
    
    if (hoveredCourseId.value && moveUpState.value.targetIds.includes(hoveredCourseId.value)) {
      const sourceVm = viewState.value[moveUpState.value.sourceId];
      if (sourceVm?.invalidMoveUpTargets && hoveredCourseId.value in sourceVm.invalidMoveUpTargets) {
        return { visible: true, text: sourceVm.invalidMoveUpTargets[hoveredCourseId.value] || 'Current configuration does not allow move-up to this course', theme: 'cancel' }; 
      }
      return { visible: true, text: `Select a course to move-up to from ${getCourseName(moveUpState.value.sourceId)}`, theme: 'move-up-ready' }; 
    }
    
    return { visible: true, text: `Select a course to move-up to from ${getCourseName(moveUpState.value.sourceId)}`, theme: 'move-up-btn' };
  }
  return { ...tooltip.value }; 
});

const tooltipStyle = computed(() => { 
  const gap = 12; 
  let x = mouseX.value + gap; let y = mouseY.value + gap; 
  if (x + 220 >= window.innerWidth) x = mouseX.value - 220 - gap;
  if (y + 40 >= window.innerHeight) y = mouseY.value - 40 - gap;
  return { left: `${Math.max(0, x)}px`, top: `${Math.max(0, y)}px` }; 
});

const tooltipThemeClass = computed(() => { 
  const base = 'flex items-center justify-start text-left p-1.5 px-2.5 rounded-md shadow-md text-[11px] border leading-tight font-medium transition-colors duration-0 w-max max-w-[220px] z-[100] whitespace-pre-wrap'; 
  const isDark = isDarkMode.value;
  const theme = activeTooltip.value.theme;
  
  if (theme === 'cancel') return isDark ? `${base} bg-[#1C1C1E] text-[#FF453A] border-[#FF453A]` : `${base} bg-white text-[#FF3B30] border-[#FF3B30]`;
  if (theme === 'move-up-ready') return isDark ? `${base} bg-[#FF9F0A] text-white border-[#1C1C1E]` : `${base} bg-[#FF9500] text-white border-white`;
  if (theme === 'move-up-btn') return isDark ? `${base} bg-[#1C1C1E] text-[#FF9F0A] border-[#FF9F0A]` : `${base} bg-white text-[#FF9500] border-[#FF9500]`; 
  
  return isDark ? `${base} bg-[#2C2C2E]/95 text-white border-white/10` : `${base} bg-white/95 text-gray-900 border-black/10`; 
});

const getInfoBtnStyles = (courseId: string): string => {
  const vm = viewState.value[courseId];
  const isInspected = viewingCourseId.value === courseId;
  const base = 'border shadow-sm';
  const visibility = isInspected ? 'opacity-100 bg-black/10 dark:bg-white/20' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100';
  if (vm?.isMoveUpSource) return `${base} ${visibility} bg-orange-50 dark:bg-orange-950/40 border-transparent text-[#FF9500] hover:bg-orange-100 active:bg-orange-200`;
  if (vm?.isSelected) return `${base} ${visibility} bg-white border-transparent text-[#007AFF] hover:bg-gray-50 active:bg-gray-200`;
  return `${base} ${visibility} border-black/10 dark:border-white/10 bg-white/95 dark:bg-white/10 text-gray-500 dark:text-white/85 hover:bg-black/5 dark:hover:bg-white/20 active:bg-black/10 dark:active:bg-white/30`;
};

const getCardStyles = (courseId: string): string => { 
  const vm = viewState.value[courseId]; 
  const lightBorder = 'border-black/10 dark:border-white/10';
  let base = '';
  
  if (!vm || vm.status === 'locked') base = `bg-[#D1D1D6] dark:bg-[#2C2C2E] border-transparent text-gray-500 dark:text-gray-600 grayscale active:bg-black/10 dark:active:bg-white/20`; 
  else if (vm.isMoveUpSource) {
      if (vm.isLockedMoveUpSource) {
          base = `bg-orange-50 border-2 border-[#FF9500] text-orange-900 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500 opacity-60 cursor-not-allowed`;
      } else {
          base = `bg-orange-50 border-2 border-[#FF9500] text-orange-900 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500 hover:bg-orange-100/50 active:bg-orange-100`;
      }
  } 
  else if (vm.isMoveUpTarget) base = `bg-[#FF9500] border-[#FF9500] text-white shadow-sm hover:bg-[#FF9F0A] active:bg-[#E68600]`; 
  else if (vm.status === 'selected') base = `bg-[#007AFF] border-[#007AFF] text-white shadow-sm hover:bg-[#0070EB] active:bg-[#0062D1]`; 
  else if (vm.status === 'available') base = `bg-white ${lightBorder} text-black dark:bg-[#3A3A3C] dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-[#48484A] active:bg-gray-100 dark:active:bg-white/10`; 
  else base = `bg-[#D1D1D6] dark:bg-[#2C2C2E] border-transparent text-gray-400`; 

  if (moveUpState.value.active) { 
    if (courseId === moveUpState.value.sourceId) return 'bg-[#FF3B30]/10 border-[#FF3B30] text-[#FF3B30] transition-none'; 
    if (moveUpState.value.targetIds.includes(courseId)) {
        const sourceVm = viewState.value[moveUpState.value.sourceId!];
        const isInvalid = sourceVm?.invalidMoveUpTargets && courseId in sourceVm.invalidMoveUpTargets;
        
        const validBase = 'bg-white dark:bg-[#1C1C1E] border-2 border-dashed border-[#FF9500] text-[#FF9500] dark:border-[#FF9F0A] dark:text-[#FF9F0A] shadow-sm transition-none';
        
        if (isInvalid) {
            return `${validBase} opacity-40 cursor-not-allowed transition-opacity duration-300`;
        }
        
        const isHovered = hoveredCourseId.value === courseId;
        return isHovered 
            ? 'bg-[#FF9500] border-2 border-[#FF9500] text-white shadow-sm transition-none cursor-pointer'
            : `${validBase} cursor-pointer`;
    }
    return base + ' opacity-30 cursor-not-allowed transition-opacity duration-300'; 
  }
  return base;
};

const formatRating = (val?: number) => val === undefined ? '0.00' : val.toFixed(2);

const ratingOf = (courseId: string): EffectiveRating => {
  ratingsVersion.value; // reactivity hook: re-evaluates whenever a vote lands
  const baseline = courseMetaById.value.get(courseId)?.raw.crowdRating ?? 0;
  return ratingStore.getEffectiveRating(courseId, baseline);
};

const activeRating = computed<EffectiveRating>(() =>
  viewingCourseId.value
    ? ratingOf(viewingCourseId.value)
    : { value: 0, voteCount: 0, baseline: 0, myVote: null },
);

const submitVote = async (courseId: string, value: number) => {
  if (isSubmittingVote.value || ratingStore.hasVoted(courseId)) return;
  isSubmittingVote.value = true;
  voteError.value = null;
  try {
    const result = await ratingStore.vote(courseId, value);
    if (!result.ok) {
      voteError.value = result.reason === 'already-voted'
        ? 'You have already rated this course.'
        : 'That rating is out of range.';
    }
  } catch (e) {
    console.error(e);
    voteError.value = 'Could not record your vote. Please try again.';
  } finally {
    isSubmittingVote.value = false;
    hoveredVote.value = 0;
  }
};

const getSummaryStyles = (courseId: string): string => { 
  const vm = viewState.value[courseId]; 
  let baseStyle = '';

  if (!vm || vm.status === 'locked') baseStyle = `opacity-60 border-black/10`; 
  else if (vm.isMoveUpSource) {
      if (vm.isLockedMoveUpSource) {
          baseStyle = `border-[#FF9500] text-gray-600 opacity-60 cursor-not-allowed`;
      } else {
          baseStyle = `border-[#FF9500] text-gray-600 hover:bg-orange-50 active:bg-orange-100`;
      }
  } 
  else if (vm.isMoveUpTarget) baseStyle = `bg-[#FF9500] border-[#FF9500] text-white hover:bg-[#FF9F0A] active:bg-[#E68600]`; 
  else if (vm.status === 'selected') baseStyle = `bg-[#007AFF] border-[#007AFF] text-white hover:bg-[#0070EB] active:bg-[#0062D1]`; 
  else baseStyle = `bg-white dark:bg-[#2C2C2E] border-black/10 text-gray-800 dark:text-gray-200 hover:bg-black/5 active:bg-black/10`; 

  if (moveUpState.value.active) {
    if (courseId === moveUpState.value.sourceId) return 'bg-[#FF3B30]/10 border-[#FF3B30] text-[#FF3B30] transition-none';
    if (moveUpState.value.targetIds.includes(courseId)) {
        const sourceVm = viewState.value[moveUpState.value.sourceId!];
        const isInvalid = sourceVm?.invalidMoveUpTargets && courseId in sourceVm.invalidMoveUpTargets;
        
        const validBase = 'bg-white dark:bg-[#1C1C1E] border border-dashed border-[#FF9500] text-[#FF9500] transition-none';
        
        if (isInvalid) {
            return `${validBase} opacity-40 cursor-not-allowed transition-opacity duration-300`;
        }
        
        const isHovered = hoveredCourseId.value === courseId;
        return isHovered 
            ? 'bg-[#FF9500] border border-[#FF9500] text-white transition-none cursor-pointer'
            : `${validBase} cursor-pointer`;
    }
    return baseStyle + ' opacity-30 cursor-not-allowed transition-opacity duration-300';
  }

  const isInspected = viewingCourseId.value === courseId;
  const activeOverlay = isInspected ? 'ring-2 ring-inset ring-black/5 dark:ring-white/10' : '';
  return baseStyle + ' ' + activeOverlay;
};

const getGradeEntryPoint = (dept: string, grade: string): string | null => { const bucket = getAllBucketCourses(dept, grade); const active = bucket.filter(c => viewState.value[c.id]?.status === 'selected' || viewState.value[c.id]?.status === 'moveUpTarget'); if (!active.length) return null; const entry = active.find(c => { const src = viewState.value[c.id]?.moveUpSourceId; return !src || courseMetaById.value.get(src)?.grade !== grade; }); return entry ? entry.id : active[0]!.id; };
const getGradeExitPoint = (dept: string, grade: string): string | null => { const bucket = getAllBucketCourses(dept, grade); const active = bucket.filter(c => viewState.value[c.id]?.status === 'selected' || viewState.value[c.id]?.status === 'moveUpTarget'); if (!active.length) return null; const exit = active.find(c => { if (!viewState.value[c.id]?.isMoveUpSource) return true; const tgt = viewState.value[c.id]?.moveUpTargetId; return !tgt || courseMetaById.value.get(tgt)?.grade !== grade; }); return exit ? exit.id : active[active.length - 1]!.id; };
const getCollapsedSummary = (dept: string, grade: string) => { const id = getGradeExitPoint(dept, grade); return id ? courseMetaById.value.get(id) || null : null; };
const setDeptRowRef = (dept: string, el: Element | null) => { if (el instanceof HTMLElement) deptRowRefs.set(dept, el); else deptRowRefs.delete(dept); scheduleArrowRefresh(); };
const setCourseCardRef = (courseId: string, el: Element | null) => { if (el instanceof HTMLElement) courseCardRefs.set(courseId, el); else courseCardRefs.delete(courseId); scheduleArrowRefresh(); };
const setCollapsedSummaryRef = (dept: string, grade: string, el: Element | null) => { const key = `${dept}::${grade}`; if (el instanceof HTMLElement) collapsedSummaryRefs.set(key, el); else collapsedSummaryRefs.delete(key); scheduleArrowRefresh(); };
const getArrowAnchorEl = (id: string | null, dept: string, grade: string): HTMLElement | null => { if (!id) return null; return collapsedDepts.value.has(dept) ? collapsedSummaryRefs.get(`${dept}::${grade}`) || null : courseCardRefs.get(id) || null; };
const makeLanePath = (rowEl: HTMLElement, startEl: HTMLElement, endEl: HTMLElement) => { const rowRect = rowEl.getBoundingClientRect(); const s = startEl.getBoundingClientRect(); const e = endEl.getBoundingClientRect(); const sx = s.right - rowRect.left; const sy = (s.top + s.bottom) / 2 - rowRect.top; const ex = e.left - rowRect.left; const ey = (e.top + e.bottom) / 2 - rowRect.top; return `M ${sx} ${sy} C ${sx + (ex - sx) / 2} ${sy}, ${sx + (ex - sx) / 2} ${ey}, ${ex} ${ey}`; };
const makeMoveUpPath = (rowEl: HTMLElement, startEl: HTMLElement, endEl: HTMLElement) => { const rowRect = rowEl.getBoundingClientRect(); const s = startEl.getBoundingClientRect(); const e = endEl.getBoundingClientRect(); if (Math.abs(s.left - e.left) < 50) { const top = s.top < e.top; const sx = (s.left + s.right) / 2 - rowRect.left; const sy = (top ? s.bottom : s.top) - rowRect.top; const ex = (e.left + e.right) / 2 - rowRect.left; const ey = (top ? e.top : e.bottom) - rowRect.top; return `M ${sx},${sy} C ${sx},${sy + (ey - sy) * 0.5} ${ex},${ey - (ey - sy) * 0.5} ${ex},${ey}`; } return makeLanePath(rowEl, startEl, endEl); };

const recomputeArrowPaths = () => { 
    const nextPaths: Record<string, ArrowPath[]> = {}; const currentGrades = grades.value; 
    visibleDepts.value.forEach(dept => { 
        const rowEl = deptRowRefs.get(dept); if (!rowEl) return; const paths: ArrowPath[] = []; 
        if (!collapsedDepts.value.has(dept)) { 
            Object.values(viewState.value).filter(v => v.isMoveUpSource && courseMetaById.value.get(v.id)?.dept === dept).forEach(vm => { 
                if (!vm.moveUpTargetId) return; const sEl = courseCardRefs.get(vm.id); const tEl = courseCardRefs.get(vm.moveUpTargetId); 
                if (sEl && tEl) paths.push({ key: `mu:${vm.id}`, d: makeMoveUpPath(rowEl, sEl, tEl), variant: 'dashed' }); 
            }); 
            for (let i = 0; i < currentGrades.length - 1; i++) { 
                const outId = getGradeExitPoint(dept, currentGrades[i]!); const inId = getGradeEntryPoint(dept, currentGrades[i+1]!); 
                if (outId && inId) { if (viewState.value[outId]?.moveUpTargetId === inId) continue; const sEl = getArrowAnchorEl(outId, dept, currentGrades[i]!); const eEl = getArrowAnchorEl(inId, dept, currentGrades[i+1]!); if (sEl && eEl) paths.push({ key: `l:${dept}:${i}`, d: makeLanePath(rowEl, sEl, eEl), variant: 'solid' }); } 
            } 
        } else { 
            for (let i = 0; i < currentGrades.length - 1; i++) { 
                const sEl = getArrowAnchorEl(getGradeExitPoint(dept, currentGrades[i]!), dept, currentGrades[i]!); const eEl = getArrowAnchorEl(getGradeEntryPoint(dept, currentGrades[i+1]!), dept, currentGrades[i+1]!); 
                if (sEl && eEl) paths.push({ key: `c:${dept}:${i}`, d: makeLanePath(rowEl, sEl, eEl), variant: 'solid' }); 
            } 
        } 
        nextPaths[dept] = paths; 
    }); 
    deptArrowPaths.value = nextPaths; 
};
const scheduleArrowRefresh = () => { cancelAnimationFrame(arrowFrame); arrowFrame = window.requestAnimationFrame(() => nextTick(recomputeArrowPaths)); };

// ---------------------------------------------------------------- plan state --
// The plan is the whole point of the app, so it outlives the tab: every change is
// written to local storage and can be handed to someone else as a link. Only the
// explicit choices travel — prerequisites are re-derived on the other side, which
// keeps an old link valid against a newer catalog.

const currentSnapshot = (): PlanSnapshot | null => controller.value?.getPlanSnapshot() ?? null;

const persistPlan = (snapshot: PlanSnapshot) => savePlan(snapshot);

/**
 * Runs a plan mutation and records it, so it can be undone and so it survives a
 * reload. A mutation the solver rejected leaves the plan untouched and is not
 * pushed onto the history — undo should step back over real changes only.
 */
const withHistory = (mutate: () => void) => {
  const before = currentSnapshot();
  mutate();
  const after = currentSnapshot();
  if (!before || !after || plansEqual(before, after)) return;

  undoStack.value = [...undoStack.value, before].slice(-HISTORY_LIMIT);
  redoStack.value = [];
  persistPlan(after);
};

const applySnapshot = (snapshot: PlanSnapshot, options: { notifyDropped?: boolean } = {}) => {
  if (!controller.value) return;
  const { dropped } = controller.value.restorePlan(snapshot);
  if (options.notifyDropped && dropped.length > 0) {
    announce(`${dropped.length} course${dropped.length === 1 ? '' : 's'} from that plan no longer fit the catalog and were left out.`);
  }
  const restored = currentSnapshot();
  if (restored) persistPlan(restored);
  cancelMoveUpMode();
  scheduleArrowRefresh();
};

const undo = () => {
  const previous = undoStack.value[undoStack.value.length - 1];
  const present = currentSnapshot();
  if (!previous || !present) return;
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, present].slice(-HISTORY_LIMIT);
  applySnapshot(previous);
  announce('Undid the last change.');
};

const redo = () => {
  const next = redoStack.value[redoStack.value.length - 1];
  const present = currentSnapshot();
  if (!next || !present) return;
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, present].slice(-HISTORY_LIMIT);
  applySnapshot(next);
  announce('Redid the last change.');
};

const clearPlan = () => {
  if (!controller.value || planCourses.value.length === 0) return;
  withHistory(() => controller.value?.clearPlan());
  clearSavedPlan();
  cancelMoveUpMode();
  announce('Plan cleared.');
};

// ------------------------------------------------------------------ sharing --

const buildShareUrl = (): string | null => {
  const snapshot = currentSnapshot();
  if (!snapshot || isEmptyPlan(snapshot)) return null;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#plan=${encodePlan(snapshot)}`;
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path below */
  }
  // Clipboard API needs a secure context; a plain http:// preview would otherwise
  // leave the student with a button that silently does nothing.
  try {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(scratch);
    return ok;
  } catch {
    return false;
  }
};

const copyShareLink = async () => {
  showExportDropdown.value = false;
  const url = buildShareUrl();
  if (!url) { announce('Select a course first — there is nothing to share yet.'); return; }
  announce(await copyToClipboard(url) ? 'Share link copied to the clipboard.' : 'Could not copy the link automatically.');
};

const restorePlanFromUrl = (): boolean => {
  const match = /[#&]plan=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!match?.[1]) return false;
  const snapshot = decodePlan(match[1]);
  // The link has been consumed; leaving it in the address bar would re-apply the
  // shared plan over the student's own edits on the next reload.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!snapshot || isEmptyPlan(snapshot)) return false;
  applySnapshot(snapshot, { notifyDropped: true });
  announce('Opened a shared plan.');
  return true;
};

// -------------------------------------------------------------- plan panel ---

interface PlanEntry { id: string; name: string; dept: string; grade: string; movedUpFrom?: string; }

const planCourses = computed<PlanEntry[]>(() => {
  const entries: PlanEntry[] = [];
  for (const course of allCourses.value) {
    const vm = viewState.value[course.id];
    if (!vm?.isSelected && !vm?.isMoveUpTarget) continue;
    // A move-up source and its target are one course in the student's timetable;
    // the target is the one they actually sit, so only it is listed.
    if (vm?.isMoveUpSource && vm.moveUpTargetId) continue;
    entries.push({
      id: course.id,
      name: vm?.name || course.raw.name || course.id,
      dept: course.dept,
      grade: course.grade,
      movedUpFrom: vm?.isMoveUpTarget && vm.moveUpSourceId ? getCourseName(vm.moveUpSourceId) : undefined
    });
  }
  return entries;
});

const planByGrade = computed(() => grades.value.map(grade => ({
  grade,
  courses: planCourses.value.filter(entry => entry.grade === grade).sort((a, b) => a.dept.localeCompare(b.dept))
})));

const planCount = computed(() => planCourses.value.length);

/**
 * Takes a course out of the plan from the plan panel. A move-up target cannot be
 * tapped away directly — the course the student actually picked is its source —
 * so the removal is redirected there.
 */
const removeFromPlan = (courseId: string) => {
  const vm = viewState.value[courseId];
  const owner = vm?.isMoveUpTarget && vm.moveUpSourceId ? vm.moveUpSourceId : courseId;
  withHistory(() => controller.value?.handleTap(owner));
};

const openPlanPanel = () => { viewingCourseId.value = null; showAboutPanel.value = false; showPlanPanel.value = true; };
const closeRightPanel = () => { viewingCourseId.value = null; showAboutPanel.value = false; showPlanPanel.value = false; };

const revealCourse = (courseId: string) => {
  const meta = courseMetaById.value.get(courseId);
  if (!meta) return;
  closeRightPanel();
  if (selectedDept.value !== meta.dept) executeMorph(selectedDept.value, meta.dept);
  nextTick(() => courseCardRefs.get(courseId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
};

// ------------------------------------------------------------ data exports ---

const planRows = computed(() => {
  const rows: Array<{ department: string; grade: string; courseId: string; course: string; movedUpFrom: string }> = [];
  for (const entry of [...planCourses.value].sort((a, b) => a.dept.localeCompare(b.dept) || a.grade.localeCompare(b.grade))) {
    rows.push({ department: entry.dept, grade: entry.grade, courseId: entry.id, course: entry.name, movedUpFrom: entry.movedUpFrom || '' });
  }
  return rows;
});

const downloadFile = (filename: string, contents: string, mime: string) => {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can race the download in some browsers; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const exportCsv = () => {
  showExportDropdown.value = false;
  if (planRows.value.length === 0) return;
  const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
  const header = ['Department', 'Grade', 'Course ID', 'Course', 'Moved up from'];
  const lines = [header.map(escape).join(',')];
  planRows.value.forEach(row => lines.push([row.department, row.grade, row.courseId, row.course, row.movedUpFrom].map(escape).join(',')));
  downloadFile('4-year-plan.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  announce('Exported the plan as CSV.');
};

const exportJson = () => {
  showExportDropdown.value = false;
  const snapshot = currentSnapshot();
  if (!snapshot) return;
  const payload = {
    catalog: { name: catalogData.value?.catalogName, version: catalogData.value?.version, lastUpdated: catalogData.value?.lastUpdated },
    generatedAt: new Date().toISOString(),
    // The snapshot is what /api/validate takes, so an exported plan can be checked
    // against the solver without anyone reverse-engineering the file first.
    plan: snapshot,
    courses: planRows.value
  };
  downloadFile('4-year-plan.json', JSON.stringify(payload, null, 2), 'application/json');
  announce('Exported the plan as JSON.');
};

let unsubscribeRatings: (() => void) | null = null;

const loadCatalog = async () => {
  loadError.value = null;
  catalogNotice.value = null;
  isLoading.value = true;
  try {
    const result = await (new Updater()).load();
    if (!result) {
      loadError.value = 'The catalog could not be reached or could not be parsed. Check your connection and try again.';
      return;
    }

    catalogData.value = result.catalog;
    if (result.source === 'cache') {
      const savedOn = result.cachedAt ? new Date(result.cachedAt).toLocaleString() : 'an earlier visit';
      catalogNotice.value = `Offline — showing the catalog saved on ${savedOn}. Course rules may have changed since.`;
    }

    controller.value = new CourseSelectionController(result.catalog);
    controller.value.connectView(v => viewState.value = v);

    // A shared link wins over the locally saved plan: the student clicked it on
    // purpose, and their own plan is still in storage if they undo.
    if (!restorePlanFromUrl()) {
      const saved = loadPlan();
      if (saved && !isEmptyPlan(saved)) applySnapshot(saved, { notifyDropped: true });
    }

    await nextTick();
    setupScrollSync(selectedDept.value === null);
    scheduleArrowRefresh();
  } catch (e) {
    console.error(e);
    loadError.value = e instanceof Error ? e.message : 'An unexpected error occurred while loading the catalog.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  inject();
  // A saved choice wins; otherwise follow the operating system.
  const prefersDark = preferences.darkMode ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
  isDarkMode.value = prefersDark;
  document.documentElement.classList.toggle('dark', prefersDark);
  window.addEventListener('keydown', handleKeydown); window.addEventListener('click', closeDropdown); window.addEventListener('resize', scheduleArrowRefresh);
  narrowQuery = window.matchMedia(NARROW_QUERY);
  onNarrowChange(narrowQuery);
  narrowQuery.addEventListener('change', onNarrowChange);
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(scheduleArrowRefresh);
  unsubscribeRatings = ratingStore.onChange(() => { ratingsVersion.value++; });
  ratingStore.loadAggregates().then(() => ratingStore.flushPending());
  await loadCatalog();
});
onBeforeUnmount(() => { 
    cancelAnimationFrame(arrowFrame); if (panelAnimationRaf) cancelAnimationFrame(panelAnimationRaf);
    unsubscribeRatings?.();
    if (statusTimer) clearTimeout(statusTimer);
    narrowQuery?.removeEventListener('change', onNarrowChange);
    resizeObserver?.disconnect(); window.removeEventListener('keydown', handleKeydown); window.removeEventListener('click', closeDropdown); window.removeEventListener('resize', scheduleArrowRefresh);
    // Drag handlers live on `window` for the duration of a resize; unmounting mid-drag
    // would otherwise leave them attached and firing against a dead component.
    stopLeftResize(); stopRightResize(); setupScrollSync(false);
});
</script>

<style scoped>
.tooltip-pop-enter-active, .tooltip-pop-leave-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.tooltip-pop-enter-from, .tooltip-pop-leave-to { opacity: 0; transform: scale(0.95); }
.animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
.no-transition { transition: none !important; }
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.panel-content-fade-enter-active, .panel-content-fade-leave-active { transition: opacity 0.15s ease-out; }
.panel-content-fade-enter-from, .panel-content-fade-leave-to { opacity: 0; }
</style>
<style>
.theme-transition, .theme-transition * {
  transition: background-color 0.5s ease, border-color 0.5s ease, color 0.5s ease, fill 0.5s ease, stroke 0.5s ease !important;
}
</style>
