import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivativesSnapshot } from '@/integrations/binance/derivatives';
import type { Liquidation } from '@/integrations/binance/liquidations';
import MicrostructureRibbon from '@/features/market/MicrostructureRibbon';

const hookState = vi.hoisted(() => ({
    current: {
        snapshot: null as ReturnType<typeof buildSnapshot> | null,
        error: null as string | null,
        isLoading: false,
        refresh: (): void => undefined,
    },
}));

const liqChannel = vi.hoisted(() => ({
    callback: null as ((event: Liquidation) => void) | null,
    close: vi.fn(),
}));

vi.mock('@/hooks/useDerivativesSnapshot', () => ({
    useDerivativesSnapshot: () => hookState.current,
}));

vi.mock('@/integrations/binance/liquidations', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/integrations/binance/liquidations')>();
    return {
        ...actual,
        subscribeLiquidations: (onLiquidation: (event: Liquidation) => void) => {
            liqChannel.callback = onLiquidation;
            return { close: liqChannel.close };
        },
    };
});

const buildSnapshot = (): DerivativesSnapshot => ({
    markPrice: 100.0,
    indexPrice: 99.9,
    fundingRate: 0.00012,
    nextFundingTime: Date.now() + 60_000,
    openInterest: 850_000_000,
    longAccount: 0.62,
    shortAccount: 0.38,
    updatedAt: Date.now(),
});

const liquidation = (overrides: Partial<Liquidation>): Liquidation => ({
    symbol: 'BTCUSDT',
    side: 'SELL',
    price: 100,
    quantity: 1,
    value: 250_000,
    time: 1,
    isBuy: false,
    ...overrides,
});

const emit = (events: Liquidation[]): void => {
    act(() => {
        for (const event of events) liqChannel.callback?.(event);
    });
};

beforeEach(() => {
    hookState.current = {
        snapshot: buildSnapshot(),
        error: null,
        isLoading: false,
        refresh: (): void => undefined,
    };
    liqChannel.callback = null;
    liqChannel.close.mockClear();
});

afterEach(() => {
    liqChannel.callback = null;
});

describe('MicrostructureRibbon', () => {
    it('renders five labelled cells with computed values', () => {
        const { container } = render(<MicrostructureRibbon symbol="BTCUSDT" />);

        const cells = ['funding', 'basis', 'oi', 'ls', 'liq'];
        for (const cell of cells) {
            expect(container.querySelector(`[data-cell="${cell}"]`)).not.toBeNull();
        }

        // funding: 0.00012 * 10_000 = 1.2 bps
        expect(screen.getByText('+1.20 bps')).toBeInTheDocument();

        // basis: ((100 / 99.9) - 1) * 10_000 ≈ +10.01 bps
        expect(screen.getByText('+10.01 bps')).toBeInTheDocument();

        // open interest: $850M BTC
        const oiCell = container.querySelector('[data-cell="oi"]');
        expect(oiCell?.textContent).toContain('850.00M');

        // long/short bar widths via inline style inside the ls cell
        const lsCell = container.querySelector('[data-cell="ls"]');
        const bars = lsCell?.querySelectorAll<HTMLElement>('.ratio-bar > div');
        expect(bars?.length).toBeGreaterThan(0);
        expect(bars?.item(0).style.width).toBe('62%');
        expect(lsCell?.textContent).toContain('38%');
    });

    it('lists liquidation events newest-first with side classes and compact values', () => {
        const { container } = render(<MicrostructureRibbon symbol="BTCUSDT" />);

        emit([
            liquidation({ symbol: 'BTCUSDT', side: 'SELL', price: 64_000, quantity: 2, value: 128_000, time: 1, isBuy: false }),
            liquidation({ symbol: 'ETHUSDT', side: 'BUY', price: 3_200, quantity: 50, value: 160_000, time: 2, isBuy: true }),
            liquidation({ symbol: 'SOLUSDT', side: 'SELL', price: 140, quantity: 300, value: 42_000, time: 3, isBuy: false }),
        ]);

        const items = container.querySelectorAll('[data-cell="liq"] .ribbon__liqs > li');
        expect(items.length).toBe(3);
        expect(items.item(0)?.textContent).toContain('SOL');
        expect(items.item(0)?.className).toContain('negative');
        expect(items.item(0)?.textContent).toContain('42.00K');
        expect(items.item(1)?.textContent).toContain('ETH');
        expect(items.item(1)?.className).toContain('positive');
        expect(items.item(1)?.textContent).toContain('160.00K');
        expect(items.item(2)?.textContent).toContain('BTC');
        expect(items.item(2)?.className).toContain('negative');
        expect(items.item(2)?.textContent).toContain('128.00K');
    });

    it('renders muted placeholders and surfaces the error when the snapshot fails', () => {
        hookState.current = { snapshot: null, error: 'boom', isLoading: false, refresh: (): void => undefined };

        const { container } = render(<MicrostructureRibbon symbol="BTCUSDT" />);

        for (const cell of ['funding', 'basis', 'oi', 'ls']) {
            const node = container.querySelector(`[data-cell="${cell}"]`);
            expect(node?.textContent).toContain('—');
        }
        const status = screen.getByRole('status');
        expect(status.textContent).toContain('boom');
    });

    it('closes the liquidation subscription on unmount', () => {
        const { unmount } = render(<MicrostructureRibbon symbol="BTCUSDT" />);
        expect(liqChannel.callback).not.toBeNull();

        unmount();
        expect(liqChannel.close).toHaveBeenCalledTimes(1);
    });
});
