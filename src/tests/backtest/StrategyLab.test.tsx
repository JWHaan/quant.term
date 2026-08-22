import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import StrategyLab from '@/features/backtest/StrategyLab';
import { fetchKlinesRange } from '@/integrations/binance/klines';
import type { BacktestCandle } from '@/backtest/types';

vi.mock('@/integrations/binance/klines', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/integrations/binance/klines')>();
    return {
        ...actual,
        fetchKlinesRange: vi.fn(),
    };
});

const fetchKlinesRangeMock = vi.mocked(fetchKlinesRange);

const CANDLE_START = 1_704_067_200;

/** Build valid ascending candles; when `gapAfter` is set, one bar is omitted after that index. */
const binanceCandles = (count: number, gapAfter?: number): BacktestCandle[] => {
    const candles: BacktestCandle[] = [];
    for (let index = 0; index < count; index += 1) {
        const skipped = gapAfter !== undefined && index > gapAfter;
        const time = CANDLE_START + (index + (skipped ? 1 : 0)) * 60;
        const open = 42_000 + index;
        const close = open + 5;
        candles.push({
            time,
            open,
            high: Math.max(open, close) + 2,
            low: Math.min(open, close) - 2,
            close,
            volume: 10,
        });
    }
    return candles;
};

const deferredRange = () => {
    let resolve!: (value: { candles: BacktestCandle[]; requests: number }) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<{ candles: BacktestCandle[]; requests: number }>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    fetchKlinesRangeMock.mockReturnValue(promise);
    return { resolve, reject };
};

const selectBinanceSource = () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Binance history' }));
};

describe('StrategyLab', () => {
    beforeEach(() => {
        fetchKlinesRangeMock.mockReset();
    });

    it('does not present generated performance before a run', () => {
        render(<StrategyLab />);

        expect(screen.getByText('No generated performance yet')).toBeInTheDocument();
        expect(screen.queryByText('Total return')).not.toBeInTheDocument();
    });

    it('defaults to the synthetic fixture dataset and provenance', () => {
        render(<StrategyLab />);

        expect(screen.getByText('Synthetic')).toBeInTheDocument();
        expect(screen.getByText('SOURCE: FIXTURE')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Fetch Binance history' })).not.toBeInTheDocument();
    });

    it('runs the deterministic fixture and exposes inspectable results', () => {
        const onResult = vi.fn();
        render(<StrategyLab onResult={onResult} />);

        fireEvent.click(screen.getByRole('button', { name: 'Run deterministic replay' }));

        expect(screen.getByText('Total return')).toBeInTheDocument();
        expect(screen.getByText('MARK-TO-MARKET EQUITY')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /^Trades/ })).toBeInTheDocument();
        expect(onResult).toHaveBeenCalledTimes(1);
        expect(onResult.mock.calls[0]?.[0].diagnostics.deterministic).toBe(true);
    });

    it('surfaces invalid strategy configuration without stale results', () => {
        render(<StrategyLab />);
        const slowPeriod = screen.getByRole('spinbutton', { name: 'Slow SMA period' });

        fireEvent.change(slowPeriod, { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Run deterministic replay' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Slow period must be an integer greater than the fast period',
        );
        expect(screen.queryByText('Total return')).not.toBeInTheDocument();
    });

    it('reveals symbol, interval, and lookback controls after switching source', () => {
        render(<StrategyLab />);
        selectBinanceSource();

        expect(screen.getByRole('textbox', { name: 'Binance symbol' })).toHaveValue('BTCUSDT');
        expect(screen.getByRole('combobox', { name: 'Kline interval' })).toHaveValue('1m');
        expect(screen.getByRole('spinbutton', { name: 'Lookback bars' })).toHaveValue(1000);
        expect(screen.getByRole('button', { name: 'Fetch Binance history' })).toBeEnabled();
    });

    it('excludes the calendar-month 1M timeframe from the interval picker', () => {
        render(<StrategyLab />);
        selectBinanceSource();

        const options = [...screen.getByRole('combobox', { name: 'Kline interval' }).querySelectorAll('option')];
        const values = options.map((option) => option.value);
        expect(values).not.toContain('1M');
        // Sanity: shorter timeframes remain selectable.
        expect(values).toContain('1m');
        expect(values).toContain('1d');
    });

    it('shows a loading status then the BINANCE_REST provenance card with a gap report', async () => {
        const { resolve } = deferredRange();
        render(<StrategyLab />);
        selectBinanceSource();

        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));
        expect(await screen.findByText(/Fetching/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Fetch Binance history' })).toBeDisabled();

        resolve({ candles: binanceCandles(60, 30), requests: 1 });
        expect(await screen.findByText(/GAPS 1 · MISSING 1 bars/)).toBeInTheDocument();
        expect(screen.getByText('SOURCE: BINANCE REST')).toBeInTheDocument();
        expect(screen.getByText('Binance REST')).toBeInTheDocument();
        expect(fetchKlinesRangeMock).toHaveBeenCalledWith(
            { symbol: 'BTCUSDT', interval: '1m', lookbackBars: 1000 },
            expect.anything(),
        );
    });

    it('reports NO GAPS DETECTED for a continuous Binance range', async () => {
        fetchKlinesRangeMock.mockResolvedValue({ candles: binanceCandles(60), requests: 1 });
        render(<StrategyLab />);
        selectBinanceSource();

        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));

        expect(await screen.findByText('NO GAPS DETECTED')).toBeInTheDocument();
    });

    it('re-enables fetch after a mid-flight form change aborts the load', async () => {
        const { resolve } = deferredRange();
        render(<StrategyLab />);
        selectBinanceSource();

        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));
        expect(await screen.findByText(/Fetching/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Fetch Binance history' })).toBeDisabled();

        // Editing a param while loading aborts the in-flight walk; the button must not stay stuck.
        fireEvent.change(screen.getByRole('textbox', { name: 'Binance symbol' }), { target: { value: 'ETHUSDT' } });

        expect(await screen.findByRole('button', { name: 'Fetch Binance history' })).toBeEnabled();
        // The aborted walk must never settle into state.
        resolve({ candles: binanceCandles(60), requests: 1 });
        expect(screen.queryByText(/Loaded 60 closed candles/)).not.toBeInTheDocument();
    });

    it('surfaces a fetch rejection as an alert and keeps the prior dataset', async () => {
        fetchKlinesRangeMock.mockResolvedValueOnce({ candles: binanceCandles(60), requests: 1 });
        render(<StrategyLab />);
        selectBinanceSource();
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));
        await screen.findByText('NO GAPS DETECTED');

        fetchKlinesRangeMock.mockRejectedValueOnce(new Error('Failed to fetch klines (418)'));
        fireEvent.change(screen.getByRole('textbox', { name: 'Binance symbol' }), { target: { value: 'ETHUSDT' } });
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch klines (418)');
        expect(screen.getByText('BTCUSDT · 1m')).toBeInTheDocument();
        expect(screen.getByText('SOURCE: BINANCE REST')).toBeInTheDocument();
    });

    it('treats an empty fetched range as an error and keeps the prior live dataset', async () => {
        fetchKlinesRangeMock.mockResolvedValueOnce({ candles: binanceCandles(60), requests: 1 });
        render(<StrategyLab />);
        selectBinanceSource();
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));
        await screen.findByText('NO GAPS DETECTED');

        fetchKlinesRangeMock.mockResolvedValueOnce({ candles: [], requests: 0 });
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No closed candles available for BTCUSDT 1m',
        );
        // The failed empty range must not clear the previously loaded dataset.
        expect(screen.getByText('BTCUSDT · 1m')).toBeInTheDocument();
        expect(screen.getByText('SOURCE: BINANCE REST')).toBeInTheDocument();
        expect(screen.getByText('NO GAPS DETECTED')).toBeInTheDocument();
    });

    it('runs the replay against the fetched Binance dataset and warns on gaps', async () => {
        fetchKlinesRangeMock.mockResolvedValue({ candles: binanceCandles(60, 30), requests: 1 });
        render(<StrategyLab />);
        selectBinanceSource();
        fireEvent.change(screen.getByRole('textbox', { name: 'Binance symbol' }), { target: { value: 'ETHUSDT' } });
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Binance history' }));
        await screen.findByText(/GAPS 1 · MISSING 1 bars/);

        fireEvent.click(screen.getByRole('button', { name: 'Run deterministic replay' }));

        expect(await screen.findByRole('heading', { name: 'ETHUSDT · SMA 12/36' })).toBeInTheDocument();
        expect(screen.getByText(/data gap/)).toBeInTheDocument();
    });
});
