<template>
  <path
    :d="pathD"
    fill="none"
    :stroke="strokeColor"
    :stroke-width="strokeWidth"
    :stroke-dasharray="dashArray"
    :stroke-linecap="'round'"
    :stroke-linejoin="'round'"
    :class="['pointer-events-none transition-all duration-300', animatedClass]"
    :style="animatedStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GraphEdge, GraphNode } from '@/backend/GraphBuilder';

const props = defineProps<{
  edge: GraphEdge;
  source: GraphNode;
  target: GraphNode;
  highlighted?: boolean;
  dimmed?: boolean;
  isDark?: boolean;
}>();

const pathD = computed(() => {
  const sx = props.source.x + props.source.width;
  const sy = props.source.y + props.source.height / 2;
  const tx = props.target.x;
  const ty = props.target.y + props.target.height / 2;

  // Same-grade (vertical) edge: route around the nodes.
  if (Math.abs(sx - tx) < 40) {
    const midX = (sx + tx) / 2 + 24;
    return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
  }

  const horizontalGap = tx - sx;
  const cp1x = sx + horizontalGap * 0.5;
  const cp2x = tx - horizontalGap * 0.5;
  return `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;
});

const strokeColor = computed(() => {
  if (props.edge.kind === 'moveUp') {
    return props.isDark ? '#FF9F0A' : '#FF9500';
  }
  if (props.highlighted) {
    return props.isDark ? '#0A84FF' : '#007AFF';
  }
  return props.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
});

const strokeWidth = computed(() => {
  if (props.highlighted) return 2.5;
  if (props.edge.kind === 'moveUp') return 2;
  return 1.5;
});

const dashArray = computed(() => {
  if (props.edge.kind === 'moveUp') return '6 5';
  return undefined;
});

const animatedClass = computed(() => {
  if (props.highlighted && props.edge.kind !== 'moveUp') return 'edge-flow';
  return '';
});

const animatedStyle = computed(() => {
  const base: Record<string, string> = {};
  if (props.dimmed) base.opacity = '0.25';
  return base;
});
</script>

<style scoped>
.edge-flow {
  animation: flowDash 1.2s linear infinite;
  stroke-dasharray: 8 6;
}

@keyframes flowDash {
  from {
    stroke-dashoffset: 14;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>
