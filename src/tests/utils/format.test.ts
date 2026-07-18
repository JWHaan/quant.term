import { describe, expect, it } from 'vitest';
import { formatPrice } from '@/utils/format';

describe('formatPrice', () => {
    it('preserves cent-level changes for high-priced assets', () => {
        expect(formatPrice(64_005.83)).toBe('64005.83');
        expect(formatPrice(1_844.25)).toBe('1844.25');
    });

    it('preserves eight decimals for assets priced below 0.0001', () => {
        expect(formatPrice(0.00009999)).toBe('0.00009999');
        expect(formatPrice(0.00000618)).toBe('0.00000618');
        expect(formatPrice(0.00000012)).toBe('0.00000012');
    });

    it('keeps six decimals at and above the small-price threshold', () => {
        expect(formatPrice(0.0001)).toBe('0.000100');
        expect(formatPrice(0.1234564)).toBe('0.123456');
    });

    it('uses an em dash for absent or invalid prices', () => {
        expect(formatPrice(0)).toBe('—');
        expect(formatPrice(Number.NaN)).toBe('—');
    });
});
