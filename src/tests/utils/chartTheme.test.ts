import { describe, expect, it } from 'vitest';
import { resolveChartTheme } from '@/features/charts/chartTheme';

describe('resolveChartTheme', () => {
    it('uses CSS variable values when present', () => {
        const theme = resolveChartTheme((name) => (name === '--chart-bg' ? '#101010' : ''));
        expect(theme.background).toBe('#101010');
    });

    it('falls back to the terminal palette when variables are missing', () => {
        const theme = resolveChartTheme(() => '');
        expect(theme.background).toBe('#0f172a');
        expect(theme.upColor).toBe('#22c55e');
        expect(theme.downColor).toBe('#ef4444');
        expect(theme.ema9).toBe('#3b82f6');
    });
});
