import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');

describe('amber theme tokens', () => {
    it('defines the amber interactive ramp', () => {
        expect(css).toMatch(/#ffb020/i);
        expect(css).toMatch(/#ff9e1b/i);
    });

    it('keeps directional colors out of the accent ramp', () => {
        // accent token declarations must not reference greens/reds
        const accentBlock = css.match(/--accent-primary:[^;]+;/)?.[0] ?? '';
        expect(accentBlock.toLowerCase()).not.toMatch(/#(0f0|00c853|26a69a|ef5350|f6465d)/);
    });

    it('applies tabular numerals to metric surfaces', () => {
        expect(css).toMatch(/tabular-nums/);
    });

    it('defines the dark dim-border amber', () => {
        expect(css).toMatch(/#8a6516/i);
    });
});
