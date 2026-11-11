import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTickFlash } from '@/hooks/useTickFlash';

interface Props {
    price: number;
    identity: string;
}

const renderTickFlash = (price: number, identity = 'BTCUSDT') =>
    renderHook(({ price: nextPrice, identity: nextIdentity }: Props) => useTickFlash(nextPrice, nextIdentity), {
        initialProps: { price, identity },
    });

describe('useTickFlash', () => {
    it('does not flash the first observation', () => {
        const { result } = renderTickFlash(64_000);
        expect(result.current.direction).toBeNull();
        expect(result.current.nonce).toBe(0);
    });

    it('reports the direction of each move', () => {
        const { result, rerender } = renderTickFlash(64_000);

        rerender({ price: 64_100, identity: 'BTCUSDT' });
        expect(result.current.direction).toBe('up');

        rerender({ price: 63_900, identity: 'BTCUSDT' });
        expect(result.current.direction).toBe('down');
    });

    it('bumps the nonce on every move so a repeated direction restarts its animation', () => {
        const { result, rerender } = renderTickFlash(64_000);

        rerender({ price: 64_100, identity: 'BTCUSDT' });
        expect(result.current).toEqual({ direction: 'up', nonce: 1 });

        rerender({ price: 64_200, identity: 'BTCUSDT' });
        expect(result.current).toEqual({ direction: 'up', nonce: 2 });
    });

    it('ignores a repeated price', () => {
        const { result, rerender } = renderTickFlash(64_000);

        rerender({ price: 64_000, identity: 'BTCUSDT' });
        expect(result.current).toEqual({ direction: null, nonce: 0 });
    });

    it('re-baselines instead of flashing when the instrument changes', () => {
        const { result, rerender } = renderTickFlash(64_000, 'BTCUSDT');

        rerender({ price: 3_200, identity: 'ETHUSDT' });
        expect(result.current.direction).toBeNull();

        rerender({ price: 3_210, identity: 'ETHUSDT' });
        expect(result.current.direction).toBe('up');
    });

    it('ignores non-finite prices', () => {
        const { result, rerender } = renderTickFlash(64_000);

        rerender({ price: Number.NaN, identity: 'BTCUSDT' });
        expect(result.current).toEqual({ direction: null, nonce: 0 });

        rerender({ price: 64_100, identity: 'BTCUSDT' });
        expect(result.current).toEqual({ direction: 'up', nonce: 1 });
    });
});
