import React, { useEffect, useState } from 'react';
import { formatBps, formatVolume } from '@/utils/format';
import { getBinanceFuturesContract } from '@/integrations/binance/contracts';
import { subscribeLiquidations, type Liquidation } from '@/integrations/binance/liquidations';
import { useDerivativesSnapshot } from '@/hooks/useDerivativesSnapshot';

interface MicrostructureRibbonProps {
    symbol: string;
}

const LIQ_BUFFER_SIZE = 8;
const LIQ_VISIBLE = 3;

const MutedCell = ({ label }: { label: string }) => (
    <div className="ribbon__cell" data-cell={label}>
        <span className="ribbon__label">{label.toUpperCase()}</span>
        <span className="ribbon__value ribbon__value--muted">—</span>
    </div>
);

/**
 * MicrostructureRibbon — dense derivatives strip docked under the chart.
 * Funding · basis · open interest · long/short · latest liquidations.
 */
const MicrostructureRibbon: React.FC<MicrostructureRibbonProps> = ({ symbol }) => {
    const contract = getBinanceFuturesContract(symbol);
    const { snapshot, error } = useDerivativesSnapshot(contract.spotSymbol);
    const [liquidations, setLiquidations] = useState<Liquidation[]>([]);

    useEffect(() => {
        const subscription = subscribeLiquidations((event) => {
            setLiquidations((previous) => [event, ...previous].slice(0, LIQ_BUFFER_SIZE));
        });
        return () => subscription.close();
    }, []);

    const basis = snapshot && snapshot.indexPrice
        ? ((snapshot.markPrice / snapshot.indexPrice) - 1) * 10_000
        : null;
    const fundingBps = snapshot ? snapshot.fundingRate * 10_000 : null;
    const visibleLiquidations = liquidations.slice(0, LIQ_VISIBLE);

    return (
        <section
            className="ribbon"
            aria-label={`${contract.spotSymbol} microstructure`}
            data-testid="microstructure-ribbon"
        >
            {fundingBps === null ? (
                <MutedCell label="funding" />
            ) : (
                <div className="ribbon__cell" data-cell="funding">
                    <span className="ribbon__label">FUNDING 8H</span>
                    <span className={`ribbon__value ${fundingBps >= 0 ? 'positive' : 'negative'}`}>
                        {formatBps(fundingBps)}
                    </span>
                </div>
            )}

            {basis === null || !snapshot ? (
                <MutedCell label="basis" />
            ) : (
                <div className="ribbon__cell" data-cell="basis">
                    <span className="ribbon__label">BASIS</span>
                    <span className={`ribbon__value ${basis >= 0 ? 'positive' : 'negative'}`}>
                        {formatBps(basis)}
                    </span>
                </div>
            )}

            {!snapshot ? (
                <MutedCell label="oi" />
            ) : (
                <div className="ribbon__cell" data-cell="oi">
                    <span className="ribbon__label">OPEN INTEREST</span>
                    <span className="ribbon__value">
                        ${formatVolume(snapshot.openInterest)} {contract.spotSymbol.replace('USDT', '')}
                    </span>
                </div>
            )}

            {!snapshot ? (
                <MutedCell label="ls" />
            ) : (
                <div className="ribbon__cell ribbon__cell--wide" data-cell="ls">
                    <span className="ribbon__label">LONG/SHORT</span>
                    <div
                        className="ratio-bar ratio-bar--mini"
                        aria-label={`Long accounts ${(snapshot.longAccount * 100).toFixed(1)} percent, short accounts ${(snapshot.shortAccount * 100).toFixed(1)} percent`}
                    >
                        <div style={{ width: `${snapshot.longAccount * 100}%` }} />
                    </div>
                    <span className="ribbon__sub">
                        <span className="positive">{(snapshot.longAccount * 100).toFixed(0)}%</span>
                        {' / '}
                        <span className="negative">{(snapshot.shortAccount * 100).toFixed(0)}%</span>
                    </span>
                </div>
            )}

            <div className="ribbon__cell ribbon__cell--wide" data-cell="liq">
                <span className="ribbon__label">LIQUIDATIONS</span>
                {visibleLiquidations.length === 0 ? (
                    <span className="ribbon__value ribbon__value--muted">—</span>
                ) : (
                    <ul className="ribbon__liqs">
                        {visibleLiquidations.map((event) => (
                            <li key={`${event.time}-${event.symbol}-${event.price}`} className={event.isBuy ? 'positive' : 'negative'}>
                                {event.isBuy ? '▲' : '▼'} {event.symbol.replace('USDT', '')} ${formatVolume(event.value)}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {error && (
                <span className="ribbon__status" role="status">{error}</span>
            )}
        </section>
    );
};

export default MicrostructureRibbon;
