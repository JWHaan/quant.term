import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StrategyLab from '@/features/backtest/StrategyLab';

describe('StrategyLab', () => {
    it('does not present generated performance before a run', () => {
        render(<StrategyLab />);

        expect(screen.getByText('No generated performance yet')).toBeInTheDocument();
        expect(screen.queryByText('Total return')).not.toBeInTheDocument();
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
});
