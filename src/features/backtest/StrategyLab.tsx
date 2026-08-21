import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Beaker, CheckCircle2, Play, ShieldCheck } from 'lucide-react';
import { runSmaCrossBacktest } from '@/backtest/engine';
import { createSyntheticBtcFixture } from '@/backtest/fixture';
import type { BacktestConfig, BacktestResult } from '@/backtest/types';
import EquityCurveChart from '@/features/backtest/EquityCurveChart';
import TabPanel from '@/ui/TabPanel';
import { formatCurrency, formatPrice } from '@/utils/format';

const DEFAULT_CONFIG: BacktestConfig = {
    initialCapital: 10_000,
    fastPeriod: 12,
    slowPeriod: 36,
    feeBps: 10,
    slippageBps: 5,
};

interface StrategyLabProps {
    onResult?: (result: BacktestResult) => void;
}

const signedPercent = (value: number): string => (
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
);

const formatTimestamp = (time: number): string => (
    new Date(time * 1000).toISOString().replace('T', ' ').slice(0, 16)
);

const StrategyLab: React.FC<StrategyLabProps> = ({ onResult }) => {
    const fixture = useMemo(() => createSyntheticBtcFixture(), []);
    const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState(
        'Configure the replay, then run it against the verified synthetic fixture.',
    );
    const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (status === 'success') resultsHeadingRef.current?.focus();
    }, [status]);

    const updateConfig = (key: keyof BacktestConfig, value: number) => {
        setConfig((current) => ({ ...current, [key]: value }));
    };

    const runBacktest = () => {
        try {
            const nextResult = runSmaCrossBacktest(fixture.candles, fixture.dataset, config);
            setResult(nextResult);
            setStatus('success');
            setMessage(
                `Replay completed deterministically: ${nextResult.metrics.totalTrades} closed trades across ${fixture.candles.length} candles.`,
            );
            onResult?.(nextResult);
        } catch (caught) {
            setResult(null);
            setStatus('error');
            setMessage(caught instanceof Error ? caught.message : 'Backtest could not be completed');
        }
    };

    const metrics = result?.metrics;
    const resultTabs = result ? [
        {
            id: 'trades',
            label: `Trades (${result.trades.length})`,
            content: (
                <div className="backtest-trade-log">
                    <table className="terminal-table">
                        <caption className="sr-only">Closed trades from the latest deterministic replay</caption>
                        <thead>
                            <tr>
                                <th>Trade</th>
                                <th>Entry UTC</th>
                                <th>Exit UTC</th>
                                <th>Entry</th>
                                <th>Exit</th>
                                <th>Bars</th>
                                <th>Fees</th>
                                <th>Net P&amp;L</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.trades.map((trade) => (
                                <tr key={trade.id}>
                                    <td>{trade.id}</td>
                                    <td>{formatTimestamp(trade.entryTime)}</td>
                                    <td>{formatTimestamp(trade.exitTime)}</td>
                                    <td>{formatPrice(trade.entryPrice)}</td>
                                    <td>{formatPrice(trade.exitPrice)}</td>
                                    <td>{trade.barsHeld}</td>
                                    <td>{formatCurrency(trade.entryFee + trade.exitFee)}</td>
                                    <td className={trade.netPnl >= 0 ? 'positive' : 'negative'}>
                                        {formatCurrency(trade.netPnl)}
                                    </td>
                                    <td>{trade.exitReason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ),
        },
        {
            id: 'diagnostics',
            label: 'Diagnostics',
            content: (
                <div className="backtest-diagnostics">
                    <dl>
                        <div><dt>Contract</dt><dd>{result.contractVersion}</dd></div>
                        <div><dt>Runtime</dt><dd>TypeScript browser reference</dd></div>
                        <div><dt>Native core</dt><dd>C++20 correctness target</dd></div>
                        <div><dt>Execution</dt><dd>Signal close → next bar open</dd></div>
                        <div><dt>Fill model</dt><dd>Market price with adverse bps costs</dd></div>
                        <div><dt>Dataset checksum</dt><dd>{result.dataset.checksum}</dd></div>
                    </dl>
                    <ul>
                        {result.diagnostics.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </div>
            ),
        },
    ] : [];

    return (
        <main className="strategy-lab" id="strategy-lab-workspace" tabIndex={-1}>
            <section className="strategy-lab__intro" aria-labelledby="strategy-lab-title">
                <div>
                    <span className="eyebrow"><Beaker size={13} /> RESEARCH WORKSPACE</span>
                    <h2 id="strategy-lab-title">Deterministic Strategy Lab</h2>
                    <p>
                        Validate a bounded SMA crossover against a fixed BTC/USDT candle fixture.
                        Signals use closed candles and execute at the next candle open.
                    </p>
                </div>
                <div className="strategy-lab__provenance" aria-label="Replay provenance">
                    <span><ShieldCheck size={13} /> NO LOOK-AHEAD</span>
                    <span><CheckCircle2 size={13} /> FIXED DATASET</span>
                    <span><Activity size={13} /> EXPLICIT COSTS</span>
                </div>
            </section>

            <div className="strategy-lab__grid">
                <aside className="backtest-setup" aria-labelledby="backtest-setup-title">
                    <div className="panel-title-row">
                        <h3 id="backtest-setup-title">Backtest setup</h3>
                        <span>CONTRACT V1</span>
                    </div>

                    <fieldset>
                        <legend>Dataset</legend>
                        <div className="dataset-card">
                            <div>
                                <strong>{fixture.dataset.name}</strong>
                                <span>{fixture.dataset.symbol} · {fixture.dataset.interval}</span>
                            </div>
                            <dl>
                                <div><dt>Candles</dt><dd>{fixture.dataset.candleCount}</dd></div>
                                <div><dt>Source</dt><dd>Synthetic</dd></div>
                                <div><dt>Checksum</dt><dd>{fixture.dataset.checksum.slice(-8)}</dd></div>
                            </dl>
                        </div>
                        <p className="field-help">
                            Deterministic regime data validates execution and accounting only. It is
                            not evidence of future or historical returns.
                        </p>
                    </fieldset>

                    <fieldset>
                        <legend>Strategy · SMA crossover</legend>
                        <div className="backtest-form-grid">
                            <label>
                                <span>Fast period</span>
                                <input
                                    aria-label="Fast SMA period"
                                    type="number"
                                    min="2"
                                    step="1"
                                    value={config.fastPeriod}
                                    onChange={(event) => updateConfig('fastPeriod', Number(event.target.value))}
                                />
                            </label>
                            <label>
                                <span>Slow period</span>
                                <input
                                    aria-label="Slow SMA period"
                                    type="number"
                                    min="3"
                                    step="1"
                                    value={config.slowPeriod}
                                    onChange={(event) => updateConfig('slowPeriod', Number(event.target.value))}
                                />
                            </label>
                        </div>
                        <p className="field-help">Long when fast crosses above slow; flat on the reverse cross.</p>
                    </fieldset>

                    <fieldset>
                        <legend>Capital and execution costs</legend>
                        <label className="backtest-field--wide">
                            <span>Initial capital · USDT</span>
                            <input
                                aria-label="Initial capital"
                                type="number"
                                min="100"
                                step="100"
                                value={config.initialCapital}
                                onChange={(event) => updateConfig('initialCapital', Number(event.target.value))}
                            />
                        </label>
                        <div className="backtest-form-grid">
                            <label>
                                <span>Taker fee · bps</span>
                                <input
                                    aria-label="Taker fee in basis points"
                                    type="number"
                                    min="0"
                                    max="1000"
                                    step="1"
                                    value={config.feeBps}
                                    onChange={(event) => updateConfig('feeBps', Number(event.target.value))}
                                />
                            </label>
                            <label>
                                <span>Slippage · bps</span>
                                <input
                                    aria-label="Slippage in basis points"
                                    type="number"
                                    min="0"
                                    max="1000"
                                    step="1"
                                    value={config.slippageBps}
                                    onChange={(event) => updateConfig('slippageBps', Number(event.target.value))}
                                />
                            </label>
                        </div>
                    </fieldset>

                    <button className="backtest-run-button" type="button" onClick={runBacktest}>
                        <Play size={14} fill="currentColor" />
                        Run deterministic replay
                    </button>

                    <div
                        className={`backtest-run-status backtest-run-status--${status}`}
                        role={status === 'error' ? 'alert' : 'status'}
                        aria-live="polite"
                    >
                        {message}
                    </div>
                </aside>

                <section className="backtest-results" aria-labelledby="backtest-results-title">
                    {!result || !metrics ? (
                        <div className="backtest-empty-state">
                            <Beaker size={30} aria-hidden="true" />
                            <h3 id="backtest-results-title">No generated performance yet</h3>
                            <p>
                                Results appear only after you explicitly run the replay. The lab does
                                not preload placeholder returns or simulated model evidence.
                            </p>
                            <ol>
                                <li>Inspect the fixed dataset provenance.</li>
                                <li>Choose SMA periods and execution costs.</li>
                                <li>Run and inspect every generated trade.</li>
                            </ol>
                        </div>
                    ) : (
                        <>
                            <div className="backtest-results__heading">
                                <div>
                                    <span className="eyebrow">LATEST COMPLETED RUN</span>
                                    <h3 id="backtest-results-title" ref={resultsHeadingRef} tabIndex={-1}>
                                        {result.dataset.symbol} · SMA {result.config.fastPeriod}/{result.config.slowPeriod}
                                    </h3>
                                </div>
                                <span className="result-chip">DETERMINISTIC · {result.dataset.checksum.slice(-8)}</span>
                            </div>

                            <dl className="backtest-metrics">
                                <div>
                                    <dt>Total return</dt>
                                    <dd className={metrics.totalReturnPct >= 0 ? 'positive' : 'negative'}>
                                        {signedPercent(metrics.totalReturnPct)}
                                    </dd>
                                </div>
                                <div><dt>Final equity</dt><dd>{formatCurrency(metrics.finalEquity)}</dd></div>
                                <div><dt>Max drawdown</dt><dd className="negative">-{metrics.maxDrawdownPct.toFixed(2)}%</dd></div>
                                <div><dt>Closed trades</dt><dd>{metrics.totalTrades}</dd></div>
                                <div><dt>Win rate</dt><dd>{metrics.winRatePct.toFixed(1)}%</dd></div>
                                <div><dt>Sharpe · 1m annualized</dt><dd>{metrics.sharpeRatio.toFixed(2)}</dd></div>
                                <div><dt>Total fees</dt><dd>{formatCurrency(metrics.totalFees)}</dd></div>
                                <div><dt>Exposure</dt><dd>{metrics.exposurePct.toFixed(1)}%</dd></div>
                            </dl>

                            <EquityCurveChart points={result.equityCurve} />

                            <div className="backtest-result-tabs">
                                <TabPanel
                                    tabs={resultTabs}
                                    defaultTab="trades"
                                    ariaLabel="Backtest result details"
                                />
                            </div>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
};

export default StrategyLab;
