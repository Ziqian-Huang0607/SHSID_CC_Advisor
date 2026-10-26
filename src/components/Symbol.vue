<script lang="ts">
import { h, defineComponent } from 'vue';

export type SymbolName =
  | 'map'
  | 'list'
  | 'square-grid-2x2'
  | 'arrow-forward'
  | 'xmark'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'doc-on-doc'
  | 'checkmark'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'pencil'
  | 'hand-tap'
  | 'magnifyingglass'
  | 'info-circle'
  | 'exclamationmark-triangle'
  | 'square-and-arrow-up'
  | 'arrow-uturn-backward'
  | 'arrow-uturn-forward'
  | 'sun'
  | 'moon'
  | 'lock'
  | 'lock-open'
  | 'arrow-up-forward'
  | 'minus-circle'
  | 'square-stack'
  | 'arrow-left-right'
  | 'doc-text'
  | 'tablecells'
  | 'arrow-down-doc'
  | 'gearshape'
  | 'person';

type SvgChild = ReturnType<typeof h>;

const p = (d: string): SvgChild => h('path', { d, fill: 'none' });
const c = (cx: string | number, cy: string | number, r: string | number, extra?: Record<string, unknown>): SvgChild =>
  h('circle', { cx: String(cx), cy: String(cy), r: String(r), fill: 'none', ...extra });
const r = (x: string | number, y: string | number, w: string | number, h_: string | number, rx?: string | number): SvgChild =>
  h('rect', { x: String(x), y: String(y), width: String(w), height: String(h_), rx: rx ? String(rx) : undefined, fill: 'none' });

const icons: Record<SymbolName, SvgChild[]> = {
  map: [
    p('M3 6l6-2 6 2 6-2v15l-6 2-6-2-6 2V6z'),
    p('M9 4v15'),
    p('M15 6v15')
  ],
  list: [p('M4 6h16'), p('M4 12h16'), p('M4 18h16')],
  'square-grid-2x2': [
    r(3, 3, 7.5, 7.5, 1.5),
    r(13.5, 3, 7.5, 7.5, 1.5),
    r(3, 13.5, 7.5, 7.5, 1.5),
    r(13.5, 13.5, 7.5, 7.5, 1.5)
  ],
  'arrow-forward': [p('M5 12h14'), p('M12 5l7 7-7 7')],
  xmark: [p('M6 6l12 12'), p('M18 6L6 18')],
  'chevron-down': [p('M6 9l6 6 6-6')],
  'chevron-up': [p('M6 15l6-6 6 6')],
  'chevron-left': [p('M15 6l-6 6 6 6')],
  'chevron-right': [p('M9 6l6 6-6 6')],
  'doc-on-doc': [r(8, 4, 12, 16, 2), p('M4 16V6a2 2 0 012-2h10')],
  checkmark: [p('M5 12l5 5 9-9')],
  plus: [p('M12 5v14'), p('M5 12h14')],
  minus: [p('M5 12h14')],
  trash: [
    p('M4 7h16'),
    p('M10 11v6'),
    p('M14 11v6'),
    p('M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7'),
    p('M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2')
  ],
  pencil: [p('M4 16v4h4l10-10-4-4L4 16z'), p('M14.5 5.5l4 4')],
  'hand-tap': [
    p('M12 11V4'),
    p('M8 11V7'),
    p('M16 11V7'),
    p('M10 21.5l-3.5-5.5A2 2 0 018.5 12.5l2.5 1.5V9a2 2 0 114 0v3.5l2.5-1a2 2 0 012.6 2.6L16.5 20'),
    c(12, 12, 9, { opacity: 0.2 })
  ],
  magnifyingglass: [c(11, 11, 7), p('M20 20l-4.3-4.3')],
  'info-circle': [c(12, 12, 9), p('M12 16v-4'), p('M12 8h.01')],
  'exclamationmark-triangle': [p('M12 3l10 18H2L12 3z'), p('M12 10v5'), p('M12 18h.01')],
  'square-and-arrow-up': [p('M12 3v10'), p('M7 8l5-5 5 5'), r(5, 12, 14, 9, 2)],
  'arrow-uturn-backward': [p('M9 14L4 9l5-5'), p('M4 9h11a5 5 0 010 10h-4')],
  'arrow-uturn-forward': [p('M15 14l5-5-5-5'), p('M20 9H9a5 5 0 000 10h4')],
  sun: [
    c(12, 12, 4),
    p('M12 2v2'),
    p('M12 20v2'),
    p('M4.93 4.93l1.41 1.41'),
    p('M17.66 17.66l1.41 1.41'),
    p('M2 12h2'),
    p('M20 12h2'),
    p('M6.34 17.66l-1.41 1.41'),
    p('M19.07 4.93l-1.41 1.41')
  ],
  moon: [p('M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z')],
  lock: [r(5, 11, 14, 10, 2), p('M8 11V7a4 4 0 018 0v4')],
  'lock-open': [r(5, 11, 14, 10, 2), p('M8 11V7a4 4 0 017.5-1.5')],
  'arrow-up-forward': [p('M7 17L17 7'), p('M17 7H9'), p('M17 7v8')],
  'minus-circle': [c(12, 12, 9), p('M8 12h8')],
  'square-stack': [r(6, 6, 13, 13, 2), p('M5 17V7a2 2 0 012-2h10')],
  'arrow-left-right': [p('M7 16V8'), p('M17 16V8'), p('M3 12h4'), p('M17 12h4')],
  'doc-text': [r(5, 3, 14, 18, 2), p('M9 8h6'), p('M9 12h6'), p('M9 16h4')],
  tablecells: [r(3, 4, 18, 16, 2), p('M3 10h18'), p('M9 10v10')],
  'arrow-down-doc': [p('M12 3v10'), p('M7 12l5 5 5-5'), p('M5 21h14')],
  gearshape: [
    c(12, 12, 4),
    p('M19.4 13a7.8 7.8 0 00.1-2 7.8 7.8 0 00-.1-2l2.1-1.6a.5.5 0 00.1-.7l-2-3.5a.5.5 0 00-.6-.2l-2.5 1a7.5 7.5 0 00-1.7-1l-.4-2.6a.5.5 0 00-.5-.5h-4a.5.5 0 00-.5.5l-.4 2.6a7.5 7.5 0 00-1.7 1l-2.5-1a.5.5 0 00-.6.2l-2 3.5a.5.5 0 00.1.7l2.1 1.6a7.8 7.8 0 00-.1 2 7.8 7.8 0 00.1 2l-2.1 1.6a.5.5 0 00-.1.7l2 3.5a.5.5 0 00.6.2l2.5-1a7.5 7.5 0 001.7 1l.4 2.6a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l.4-2.6a7.5 7.5 0 001.7-1l2.5 1a.5.5 0 00.6-.2l2-3.5a.5.5 0 00-.1-.7l-2.1-1.6z')
  ],
  person: [c(12, 8, 4), p('M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2')]
};

export default defineComponent({
  props: {
    name: { type: String as () => SymbolName, required: true },
    size: { type: [Number, String], default: 20 },
    filled: { type: Boolean, default: false }
  },
  setup(props, { attrs }) {
    return () => {
      const sizePx = typeof props.size === 'number' ? `${props.size}px` : props.size;
      const children = icons[props.name] ?? [];
      return h(
        'svg',
        {
          ...attrs,
          viewBox: '0 0 24 24',
          style: { width: sizePx, height: sizePx },
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          fill: props.filled ? 'currentColor' : 'none',
          'aria-hidden': 'true'
        },
        children
      );
    };
  }
});
</script>
