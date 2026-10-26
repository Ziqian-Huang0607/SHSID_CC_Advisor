// haptics.ts
// - Thin wrapper around navigator.vibrate for tactile feedback on interactive actions.
// - Falls back silently on devices that do not support vibration (desktop, older iOS).

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 40, 20],
    error: [30, 50, 30]
};

/**
 * Triggers a short vibration pattern. Safe to call on any device: unsupported
 * environments are ignored so the UI never blocks on haptics.
 */
export function haptic(kind: HapticKind = 'light'): void {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
        navigator.vibrate(PATTERNS[kind]);
    } catch {
        /* ignore */
    }
}
