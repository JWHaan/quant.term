import { useEffect, useRef, useState } from 'react';

export type TickDirection = 'up' | 'down';

export interface TickFlash {
    direction: TickDirection | null;
    /** Bumps on every change so a repeated flash restarts its CSS animation. */
    nonce: number;
}

const IDLE: TickFlash = { direction: null, nonce: 0 };

/**
 * Reports the direction of the latest price change so a field can flash like a
 * Bloomberg tick. The first observation never flashes, equal prices are ignored,
 * and swapping `identity` (for example a new instrument) silently re-baselines
 * instead of flashing a move that never traded.
 */
export const useTickFlash = (
    price: number | null | undefined,
    identity: string = '',
): TickFlash => {
    const previousRef = useRef<{ identity: string; price: number } | null>(null);
    const [flash, setFlash] = useState<TickFlash>(IDLE);

    useEffect(() => {
        if (price === null || price === undefined || !Number.isFinite(price)) return;

        const previous = previousRef.current;
        if (previous === null || previous.identity !== identity) {
            previousRef.current = { identity, price };
            return;
        }
        if (previous.price === price) return;

        previousRef.current = { identity, price };
        setFlash((current) => ({
            direction: price > previous.price ? 'up' : 'down',
            nonce: current.nonce + 1,
        }));
    }, [identity, price]);

    return flash;
};
