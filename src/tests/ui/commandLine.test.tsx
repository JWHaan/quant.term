import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandLine, resolveCommandInput } from '@/ui/CommandLine';
import type { Command } from '@/features/command-palette/commands';

const makeCommand = (id: string, mnemonic?: string, label = id): Command => ({
    id,
    label,
    description: `desc-${id}`,
    icon: null,
    action: vi.fn(),
    category: 'Test',
    // exactOptionalPropertyTypes forbids an explicit `mnemonic: undefined`.
    ...(mnemonic === undefined ? {} : { mnemonic }),
});

describe('resolveCommandInput', () => {
    const commands = [
        makeCommand('a', 'MON'),
        makeCommand('b', 'TOP'),
        makeCommand('c'),
    ];

    it('matches an exact mnemonic', () => {
        const result = resolveCommandInput('mon', commands);
        expect(result).toEqual({ kind: 'exact', command: commands[0] });
    });

    it('routes "TOP <arg>" to the TOP command', () => {
        const result = resolveCommandInput('top btc', commands);
        expect(result).toEqual({ kind: 'exact', command: commands[1] });
    });

    it('filters by label substring otherwise', () => {
        const result = resolveCommandInput('des', commands);
        expect(result).toEqual({ kind: 'filtered', items: commands });
    });
});

describe('CommandLine', () => {
    it('dispatches the highlighted command on Enter and clears', () => {
        const action = vi.fn();
        const commands = [makeCommand('monitor', 'MON', 'Open Market Monitor'), { ...makeCommand('lab', 'LAB'), action }];
        const onOpenPalette = vi.fn();
        render(<CommandLine commands={commands} onOpenPalette={onOpenPalette} />);
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'LAB' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(action).toHaveBeenCalledTimes(1);
        expect((input as HTMLInputElement).value).toBe('');
    });

    it('parses TOP arguments into a symbol switch', () => {
        const setSymbol = vi.fn();
        const topCommand: Command = {
            ...makeCommand('analyze', 'TOP', 'Switch symbol'),
            action: () => {},
        };
        render(
            <CommandLine
                commands={[topCommand]}
                onOpenPalette={vi.fn()}
                onSymbolArg={setSymbol}
            />,
        );
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'top eth' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(setSymbol).toHaveBeenCalledWith('ETHUSDT');
    });

    it('does not execute anything on Enter with an empty input', () => {
        const actions = [makeCommand('monitor', 'MON'), makeCommand('news', 'NEWS'), makeCommand('lab', 'LAB')];
        render(<CommandLine commands={actions} onOpenPalette={vi.fn()} />);
        const input = screen.getByLabelText('Command line');
        fireEvent.keyDown(input, { key: 'Enter' });
        for (const command of actions) expect(command.action).not.toHaveBeenCalled();
    });

    it('shows feedback and does not fall back when the TOP argument is invalid', () => {
        const action = vi.fn();
        const setSymbol = vi.fn();
        const topCommand: Command = {
            ...makeCommand('analyze-top', 'TOP', 'Switch symbol'),
            action,
        };
        render(
            <CommandLine
                commands={[topCommand]}
                onOpenPalette={vi.fn()}
                onSymbolArg={setSymbol}
            />,
        );
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'top !!!' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(action).not.toHaveBeenCalled();
        expect(setSymbol).not.toHaveBeenCalled();
        expect(screen.getByText(/no match/i)).toBeInTheDocument();
    });

    it('Escape clears the query then blurs', () => {
        render(<CommandLine commands={[makeCommand('a', 'MON')]} onOpenPalette={vi.fn()} />);
        const input = screen.getByLabelText('Command line') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'mo' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(input.value).toBe('');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(document.activeElement).not.toBe(input);
    });

    it('shows a no-match hint instead of executing garbage', () => {
        render(<CommandLine commands={[makeCommand('a', 'MON')]} onOpenPalette={vi.fn()} />);
        const input = screen.getByLabelText('Command line');
        fireEvent.change(input, { target: { value: 'zzz' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByText(/no match/i)).toBeInTheDocument();
    });
});
