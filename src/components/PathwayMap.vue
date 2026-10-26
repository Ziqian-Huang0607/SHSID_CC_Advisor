<template>
  <div
    ref="containerRef"
    class="relative w-full h-full overflow-hidden bg-[#F2F2F7] dark:bg-[#000000] select-none"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @wheel="onWheel"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Floating toolbar -->
    <div
      class="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full border bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl px-2 py-1.5 shadow-sm border-black/5 dark:border-white/10"
    >
      <button
        type="button"
        class="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#007AFF] hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 transition-colors"
        aria-label="Zoom out"
        @click.stop="zoomOut"
      >
        <Symbol name="minus" :size="14" />
      </button>
      <span class="text-[11px] font-semibold text-[#3C3C43] dark:text-[#EBEBF5] w-12 text-center tabular-nums">
        {{ Math.round(scale * 100) }}%
      </span>
      <button
        type="button"
        class="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#007AFF] hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 transition-colors"
        aria-label="Zoom in"
        @click.stop="zoomIn"
      >
        <Symbol name="plus" :size="14" />
      </button>
      <div class="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5" />
      <button
        type="button"
        class="h-7 px-2 inline-flex items-center gap-1 rounded-full text-[11px] font-semibold text-[#007AFF] hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 transition-colors"
        aria-label="Fit to screen"
        @click.stop="fitToScreen"
      >
        <Symbol name="tablecells" :size="13" />
        Fit
      </button>
    </div>

    <!-- Hint -->
    <div
      v-if="showHint"
      class="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 rounded-full bg-[#1C1C1E]/90 dark:bg-white/90 px-3 py-1.5 text-[11px] font-medium text-white dark:text-black shadow-lg pointer-events-none transition-opacity duration-500"
    >
      Drag to pan · Scroll to zoom · Double-click a course to select
    </div>

    <!-- Empty state when no department selected -->
    <div
      v-if="!selectedDept"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#F2F2F7]/95 dark:bg-[#000000]/95 backdrop-blur-sm"
    >
      <div class="h-16 w-16 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center">
        <Symbol name="map" :size="32" class="text-[#007AFF]" />
      </div>
      <h3 class="text-[17px] font-bold text-black dark:text-white">Pick a department</h3>
      <p class="text-[13px] text-[#8E8E93] text-center max-w-[240px] leading-relaxed">
        Choose a department from the sidebar to see its course pathway as an interactive map.
      </p>
      <button
        type="button"
        @click="emit('browse-departments')"
        class="mt-2 h-9 px-4 rounded-full bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0070EB] active:bg-[#0062D1] transition-colors"
      >
        Browse departments
      </button>
    </div>

    <!-- Transformed graph content -->
    <div
      v-if="selectedDept"
      class="absolute origin-top-left will-change-transform"
      :style="transformStyle"
    >
      <!-- Grade column headers -->
      <div
        v-for="col in layout.columns"
        :key="`col-${col.grade}`"
        class="absolute top-0 h-10 flex items-center justify-center text-[12px] font-semibold text-[#8E8E93] dark:text-[#98989D]"
        :style="{ left: `${col.x}px`, width: `${col.width}px` }"
      >
        Grade {{ col.grade }}
      </div>

      <!-- Department lanes -->
      <div
        v-for="lane in layout.lanes"
        :key="`lane-${lane.dept}`"
        class="absolute rounded-2xl border border-black/5 dark:border-white/5"
        :style="{
          left: '8px',
          top: `${lane.y}px`,
          width: `${layout.bounds.maxX - 16}px`,
          height: `${lane.height}px`,
          backgroundColor: isDark ? lane.darkColor : lane.color
        }"
      />
      <div
        v-for="lane in layout.lanes"
        :key="`label-${lane.dept}`"
        class="absolute left-3 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider text-[#3C3C43] dark:text-[#EBEBF5]"
        :style="{ top: `${lane.y + 6}px` }"
      >
        {{ lane.dept }}
      </div>

      <!-- Edges -->
      <svg
        class="absolute top-0 left-0 overflow-visible"
        :width="layout.bounds.maxX"
        :height="layout.bounds.maxY"
      >
        <PathwayEdge
          v-for="edge in layout.edges"
          :key="edge.id"
          :edge="edge"
          :source="nodeMap.get(edge.sourceId)!"
          :target="nodeMap.get(edge.targetId)!"
          :highlighted="highlightedEdgeIds.has(edge.id)"
          :dimmed="hasPlan && !highlightedEdgeIds.has(edge.id)"
          :is-dark="isDark"
        />
      </svg>

      <!-- Nodes -->
      <CourseNode
        v-for="node in layout.nodes"
        :key="node.id"
        :node="node"
        :vm="viewState[node.id]"
        :is-inspected="inspectedCourseId === node.id"
        :is-dark="isDark"
        :effective-rating="ratingOf(node.id).value"
        :vote-count="ratingOf(node.id).voteCount"
        @toggle="onToggle"
        @inspect="onInspect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { buildGraphLayout, type GraphLayout } from '@/backend/GraphBuilder';
import type { CourseModel } from '@/backend/CourseModel';
import type { CourseViewModel } from '@/backend/ViewModel';
import type { EffectiveRating } from '@/backend/RatingStore';
import CourseNode from './CourseNode.vue';
import PathwayEdge from './PathwayEdge.vue';
import Symbol from './Symbol.vue';

const props = defineProps<{
  catalog: CourseModel;
  viewState: Record<string, CourseViewModel>;
  inspectedCourseId: string | null;
  selectedDept: string | null;
  isDark: boolean;
  ratingOf: (courseId: string) => EffectiveRating;
}>();

const emit = defineEmits<{
  (e: 'toggle', id: string): void;
  (e: 'inspect', id: string): void;
  (e: 'browse-departments'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const layout = computed<GraphLayout>(() => {
  if (!props.selectedDept) return buildGraphLayout(props.catalog);
  const deptData = props.catalog.departments[props.selectedDept];
  if (!deptData) return buildGraphLayout(props.catalog);
  const filtered: CourseModel = {
    ...props.catalog,
    departments: {
      biology: {},
      residuals: [],
      [props.selectedDept]: deptData
    } as CourseModel['departments']
  };
  return buildGraphLayout(filtered);
});
const nodeMap = computed(() => {
  const map = new Map<string, GraphLayout['nodes'][number]>();
  layout.value.nodes.forEach(n => map.set(n.id, n));
  return map;
});

const scale = ref(1);
const pan = ref({ x: 16, y: 16 });
const showHint = ref(true);

const transformStyle = computed(() => ({
  transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${scale.value})`
}));

const selectedIds = computed(() => {
  const ids = new Set<string>();
  Object.values(props.viewState).forEach(vm => {
    if (vm.isSelected || vm.isMoveUpTarget) ids.add(vm.id);
  });
  return ids;
});

const hasPlan = computed(() => selectedIds.value.size > 0);

const highlightedEdgeIds = computed(() => {
  const ids = new Set<string>();
  if (!hasPlan.value) return ids;

  for (const edge of layout.value.edges) {
    const sourceInPlan = selectedIds.value.has(edge.sourceId);
    const targetInPlan = selectedIds.value.has(edge.targetId);
    if (!sourceInPlan || !targetInPlan) continue;

    if (edge.kind === 'moveUp') {
      const sourceVm = props.viewState[edge.sourceId];
      if (sourceVm?.isMoveUpSource && sourceVm.moveUpTargetId === edge.targetId) {
        ids.add(edge.id);
      }
      continue;
    }

    ids.add(edge.id);
  }
  return ids;
});

// ------------------------------------------------------------------ pan/zoom --

interface PointerRecord {
  id: number;
  x: number;
  y: number;
}

const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const panStart = ref({ x: 0, y: 0 });
const pointers = ref<PointerRecord[]>([]);
const pinchStart = ref({ distance: 0, scale: 1, center: { x: 0, y: 0 }, pan: { x: 0, y: 0 } });

function clientToContainer(clientX: number, clientY: number) {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return { x: clientX, y: clientY };
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function pointInContainer(clientX: number, clientY: number) {
  return clientToContainer(clientX, clientY);
}

function zoomToPoint(newScale: number, anchorContainerX: number, anchorContainerY: number) {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  const clamped = Math.max(0.25, Math.min(newScale, 3));
  const ratio = clamped / scale.value;
  const newX = anchorContainerX - (anchorContainerX - pan.value.x) * ratio;
  const newY = anchorContainerY - (anchorContainerY - pan.value.y) * ratio;
  scale.value = clamped;
  pan.value = { x: newX, y: newY };
}

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest('.course-node, button')) return;
  isDragging.value = true;
  dragStart.value = { x: event.clientX, y: event.clientY };
  panStart.value = { ...pan.value };
}

function onMouseMove(event: MouseEvent) {
  if (!isDragging.value) return;
  pan.value = {
    x: panStart.value.x + (event.clientX - dragStart.value.x),
    y: panStart.value.y + (event.clientY - dragStart.value.y)
  };
}

function onMouseUp() {
  isDragging.value = false;
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  if (showHint.value) showHint.value = false;
  const pt = pointInContainer(event.clientX, event.clientY);
  const delta = event.deltaY > 0 ? 0.92 : 1.08;
  zoomToPoint(scale.value * delta, pt.x, pt.y);
}

function getDistance(a: PointerRecord, b: PointerRecord) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCenter(a: PointerRecord, b: PointerRecord) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function updatePointers(touches: TouchList, rect: DOMRect) {
  pointers.value = Array.from(touches).map(t => ({
    id: t.identifier,
    x: t.clientX - rect.left,
    y: t.clientY - rect.top
  }));
}

function onTouchStart(event: TouchEvent) {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  updatePointers(event.touches, rect);

  if (pointers.value.length === 2) {
    const a = pointers.value[0]!;
    const b = pointers.value[1]!;
    pinchStart.value = {
      distance: getDistance(a, b),
      scale: scale.value,
      center: getCenter(a, b),
      pan: { ...pan.value }
    };
  } else if (pointers.value.length === 1) {
    const target = event.target as HTMLElement;
    if (target.closest('.course-node, button')) return;
    isDragging.value = true;
    const p = pointers.value[0]!;
    dragStart.value = { x: p.x, y: p.y };
    panStart.value = { ...pan.value };
  }
}

function onTouchMove(event: TouchEvent) {
  event.preventDefault();
  if (showHint.value) showHint.value = false;
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  updatePointers(event.touches, rect);

  if (pointers.value.length === 2) {
    const a = pointers.value[0]!;
    const b = pointers.value[1]!;
    const dist = getDistance(a, b);
    const newScale = pinchStart.value.scale * (dist / pinchStart.value.distance);
    const center = getCenter(a, b);
    const ratio = newScale / pinchStart.value.scale;
    const newPanX = center.x - (pinchStart.value.center.x - pinchStart.value.pan.x) * ratio;
    const newPanY = center.y - (pinchStart.value.center.y - pinchStart.value.pan.y) * ratio;
    scale.value = Math.max(0.25, Math.min(newScale, 3));
    pan.value = { x: newPanX, y: newPanY };
  } else if (isDragging.value && pointers.value.length === 1) {
    const p = pointers.value[0]!;
    pan.value = {
      x: panStart.value.x + (p.x - dragStart.value.x),
      y: panStart.value.y + (p.y - dragStart.value.y)
    };
  }
}

function onTouchEnd() {
  isDragging.value = false;
  pointers.value = [];
}

function zoomIn() {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  zoomToPoint(scale.value * 1.2, rect.width / 2, rect.height / 2);
}

function zoomOut() {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  zoomToPoint(scale.value * 0.8, rect.width / 2, rect.height / 2);
}

function fitToScreen() {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return;
  const padding = 48;
  const availW = rect.width - padding * 2;
  const availH = rect.height - padding * 2;
  const scaleX = availW / layout.value.bounds.maxX;
  const scaleY = availH / layout.value.bounds.maxY;
  scale.value = Math.max(0.2, Math.min(scaleX, scaleY, 1));
  pan.value = {
    x: padding + (availW - layout.value.bounds.maxX * scale.value) / 2,
    y: padding + (availH - layout.value.bounds.maxY * scale.value) / 2
  };
}

function onToggle(id: string) {
  showHint.value = false;
  emit('toggle', id);
}

function onInspect(id: string) {
  showHint.value = false;
  emit('inspect', id);
}

onMounted(() => {
  nextTick(fitToScreen);
  setTimeout(() => { showHint.value = false; }, 6000);
});

watch(() => props.selectedDept, () => {
  nextTick(fitToScreen);
});
</script>
