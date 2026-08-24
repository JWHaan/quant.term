import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarketGrid, {
    partitionTickSections,
} from '@/features/market/MarketGrid';
import type { WatchlistMarketData } from '@/integrations/binance/watchlist';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface FixtureSpec {
    symbol: string;
    name: string;
    price: number;
    change: number;
}

const MAJOR_SPECS: FixtureSpec[] = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 65_000, change: 2 },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 3_200, change: 1 },
    { symbol: 'BNBUSDT', name: 'BNB', price: 580, change: 0.5 },
    { symbol: 'SOLUSDT', name: 'Solana', price: 140, change: -0.3 },
    { symbol: 'XRPUSDT', name: 'XRP', price: 0.52, change: 0.9 },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0.12, change: -0.2 },
];

const ALT_SPECS: FixtureSpec[] = [
    { symbol: 'ADAUSDT', name: 'Cardano', price: 0.45, change: 12.4 },
    { symbol: 'AVAXUSDT', name: 'Avalanche', price: 28, change: 9.1 },
    { symbol: 'DOTUSDT', name: 'Polkadot', price: 6.4, change: 7.7 },
    { symbol: 'LINKUSDT', name: 'Chainlink', price: 14.2, change: 5 },
    { symbol: 'ATOMUSDT', name: 'Cosmos', price: 7.1, change: -11.3 },
    { symbol: 'UNIUSDT', name: 'Uniswap', price: 9.3, change: -8.2 },
];

const buildDisplayRecord = (spec: FixtureSpec): WatchlistMarketData => ({
    symbol: spec.symbol,
    name: spec.name,
    category: 'Layer 1',
    price: spec.price,
    priceChangePercent: spec.change,
    quoteVolume: 25_000_000,
});

/** Raw 24hr-ticker-shaped payloads (what the seed endpoint returns). */
const buildRawTicker = (spec: FixtureSpec): Record<string, string> => ({
    symbol: spec.symbol,
    lastPrice: String(spec.price),
    priceChangePercent: String(spec.change),
    quoteVolume: '25000000',
});

const ALL_SPECS = [...MAJOR_SPECS, ...ALT_SPECS];
const SEED_PAYLOAD = ALL_SPECS.map(buildRawTicker);

const buildPremiumIndexRecord = (
    symbol: string,
    markPrice: number,
    fundingRate: number,
    nextFundingTime: number,
): Record<string, unknown> => ({
    symbol,
    markPrice: String(markPrice),
    lastFundingRate: String(fundingRate),
    nextFundingTime,
});

const jsonResponse = (payload: unknown): Response =>
    ({
        ok: true,
        status: 200,
        json: async () => payload,
    }) as unknown as Response;

const jsonError = (status: number): Response =>
    ({
        ok: false,
        status,
        json: async () => ({}),
    }) as unknown as Response;

// ---------------------------------------------------------------------------
// Global stubs
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

const installFetchRouter = (routes: {
    seed?: () => Promise<Response> | Response;
    premiumIndex?: () => Promise<Response> | Response;
}): void => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v3/ticker/24hr')) {
            const handler = routes.seed ?? ((): Response => jsonResponse(SEED_PAYLOAD));
            return handler();
        }
        if (url.includes('/fapi/v1/premiumIndex')) {
            const handler =
                routes.premiumIndex ??
                ((): Response => jsonResponse([]));
            return handler();
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
};

beforeEach(() => {
    window.localStorage.clear();
    // Minimal WebSocket: the component opens one socket on mount; nothing sends.
    vi.stubGlobal(
        'WebSocket',
        class {
            close(): void {
                /* noop */
            }
        },
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const majorsSection = (): HTMLElement => {
    const node = document.querySelector('[data-testid="tick-section-majors"]');
    if (!(node instanceof HTMLElement)) throw new Error('MAJORS section missing');
    return node;
};

const moversSection = (): HTMLElement => {
    const node = document.querySelector('[data-testid="tick-section-movers"]');
    if (!(node instanceof HTMLElement)) throw new Error('MOVERS section missing');
    return node;
};

describe('partitionTickSections', () => {
    it('orders majors by MAJOR_BASES, excludes them from movers, and slices top/bottom five', () => {
        const data = ALL_SPECS.map(buildDisplayRecord);
        const result = partitionTickSections(data);

        expect(result.majors.map((item) => item.symbol)).toEqual([
            'BTCUSDT',
            'ETHUSDT',
            'BNBUSDT',
            'SOLUSDT',
            'XRPUSDT',
            'DOGEUSDT',
        ]);

        const moverSymbols = [
            ...result.moversUp,
            ...result.moversDown,
        ].map((item) => item.symbol);
        for (const major of result.majors) {
            expect(moverSymbols).not.toContain(major.symbol);
        }

        expect(result.moversUp.map((item) => item.priceChangePercent)).toEqual([
            12.4,
            9.1,
            7.7,
            5,
            -8.2,
        ]);
        expect(result.moversDown.map((item) => item.priceChangePercent)).toEqual([
            -11.3,
            -8.2,
            5,
            7.7,
            9.1,
        ]);
    });

    it('omits majors that are absent from the data', () => {
        const data = ALT_SPECS.concat(MAJOR_SPECS.slice(0, 2)).map(buildDisplayRecord);
        const result = partitionTickSections(data);
        expect(result.majors.map((item) => item.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
    });
});

describe('MarketGrid TICK board', () => {
    it('renders MAJORS, PERPS and MOVERS section headers with fixture prices in MAJORS', async () => {
        installFetchRouter({});

        render(<MarketGrid />);

        expect(screen.getByRole('button', { name: /MAJORS/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /PERPS/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /MOVERS/ })).toBeInTheDocument();

        await waitFor(() => {
            expect(within(majorsSection()).getByText('65000.00')).toBeInTheDocument();
        });
        // A couple more fixture prices rendered through formatPrice.
        expect(within(majorsSection()).getByText('3200.00')).toBeInTheDocument();
        expect(within(majorsSection()).getByText('0.120000')).toBeInTheDocument();

        // MOVERS body lists the biggest gainer first.
        await waitFor(() => {
            expect(within(moversSection()).getByText('ADA')).toBeInTheDocument();
        });
    });

    it('collapses MOVERS on header click and persists merged defaults to localStorage', async () => {
        installFetchRouter({});
        const { rerender } = render(<MarketGrid />);

        const moversHeader = screen.getByRole('button', { name: /MOVERS/ });
        expect(moversHeader.getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(moversHeader);

        expect(moversHeader.getAttribute('aria-expanded')).toBe('false');
        expect(within(moversSection()).queryByRole('table')).toBeNull();

        const stored = window.localStorage.getItem('qt.tickboard.sections');
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored ?? '{}')).toEqual({
            majors: true,
            perps: true,
            movers: false,
        });

        // Re-render picks the persisted state back up: body stays collapsed.
        rerender(<MarketGrid />);
        expect(screen.getByRole('button', { name: /MOVERS/ }).getAttribute('aria-expanded')).toBe('false');
        expect(within(moversSection()).queryByRole('table')).toBeNull();
    });

    it('polls bulk premiumIndex and renders funding in bps with an mm:ss countdown', async () => {
        installFetchRouter({
            premiumIndex: (): Response =>
                jsonResponse([
                    buildPremiumIndexRecord('BTCUSDT', 65_100.5, 0.00015, Date.now() + 90_000),
                    buildPremiumIndexRecord('ETHUSDT', 3_201, -0.00008, Date.now() + 3_600_000),
                    buildPremiumIndexRecord('ARBUSDT', 1.02, 0.0001, Date.now() + 3_600_000),
                ]),
        });

        const { container } = render(<MarketGrid />);

        const perpsNode = document.querySelector('[data-testid="tick-section-perps"]');
        expect(perpsNode).not.toBeNull();

        // BTC funding 0.00015 -> +1.50 bps; ETH funding -0.00008 -> -0.80 bps.
        // ARBUSDT is not a major and must be filtered out.
        await waitFor(() => {
            expect(within(perpsNode as HTMLElement).getByText('+1.50 bps')).toBeInTheDocument();
        });
        expect(within(perpsNode as HTMLElement).getByText('-0.80 bps')).toBeInTheDocument();
        expect(within(perpsNode as HTMLElement).queryByText('ARB')).toBeNull();

        // Bulk endpoint hit once on mount.
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/fapi/v1/premiumIndex'))).toBe(true);

        const btcRow = within(perpsNode as HTMLElement).getByLabelText(
            'BTC perpetual funding +1.50 bps',
        );
        const cells = btcRow.querySelectorAll('td');
        expect(cells.item(1)?.textContent).toContain('65100.50');
        expect(cells.item(3)?.textContent).toMatch(/^01:\d{2}$/);
        expect(container).toBeTruthy();
    });

    it('renders a muted fallback when the bulk premiumIndex request fails', async () => {
        installFetchRouter({
            premiumIndex: (): Response => jsonError(500),
        });

        render(<MarketGrid />);

        const perpsNode = await waitFor(() => {
            const node = document.querySelector('[data-testid="tick-section-perps"]');
            if (!node) throw new Error('PERPS section missing');
            return node;
        });
        await waitFor(() => {
            expect(within(perpsNode as HTMLElement).getByText('Perps data unavailable')).toBeInTheDocument();
        });
        expect(within(perpsNode as HTMLElement).queryByRole('table')).toBeNull();
    });

    it('filters rows across sections from the search input', async () => {
        installFetchRouter({});

        render(<MarketGrid />);

        const input = await waitFor(() => {
            const node = screen.getByLabelText('Filter market watchlist');
            return node as HTMLInputElement;
        });

        fireEvent.change(input, { target: { value: 'btc' } });

        const majorsBodyRows = majorsSection().querySelectorAll('tbody tr');
        expect(majorsBodyRows.length).toBe(1);
        expect(majorsBodyRows.item(0)?.textContent).toContain('BTC');
        expect(majorsBodyRows.item(0)?.textContent).not.toContain('ETH');

        // Count badge reflects the filtered view.
        expect(screen.getByLabelText('1 assets shown')).toBeInTheDocument();
    });
});
