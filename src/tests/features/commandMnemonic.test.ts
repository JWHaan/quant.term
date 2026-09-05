import { describe, expect, it } from 'vitest';
import { buildCommands, normalizeSymbolArg, type CommandsConfig } from '@/features/command-palette/commands';

const noop = (): void => undefined;
const cfg: CommandsConfig = {
    setShowHelp: noop,
    setSymbol: noop,
    openMonitor: noop,
    openStrategyLab: noop,
    scrollToMarket: noop,
    scrollToChart: noop,
    scrollToAlpha: noop,
    scrollToNews: noop,
};

describe('normalizeSymbolArg', () => {
    it('appends USDT to bare base symbols', () => {
        expect(normalizeSymbolArg('btc')).toBe('BTCUSDT');
        expect(normalizeSymbolArg(' wld ')).toBe('WLDUSDT');
    });

    it('keeps quoted pairs intact', () => {
        expect(normalizeSymbolArg('ethusdt')).toBe('ETHUSDT');
    });

    it('strips a leading slash', () => {
        expect(normalizeSymbolArg('/sol')).toBe('SOLUSDT');
    });

    it('rejects garbage', () => {
        expect(normalizeSymbolArg('!!')).toBeNull();
        expect(normalizeSymbolArg('')).toBeNull();
    });
});

describe('command mnemonics', () => {
    it('assigns the documented mnemonics', () => {
        const commands = buildCommands(cfg);
        const byId = new Map(commands.map((c) => [c.id, c.mnemonic]));
        expect(byId.get('open-monitor')).toBe('MON');
        expect(byId.get('open-strategy-lab')).toBe('LAB');
        expect(byId.get('focus-market')).toBe('MW');
        expect(byId.get('focus-chart')).toBe('CHART');
        expect(byId.get('focus-alpha')).toBe('ALPHA');
        expect(byId.get('focus-news')).toBe('NEWS');
        expect(byId.get('toggle-help')).toBe('KEYS');
    });

    it('marks analyze-* commands with the TOP prefix', () => {
        const commands = buildCommands(cfg);
        const analyze = commands.filter((c) => c.id.startsWith('analyze-'));
        expect(analyze.length).toBeGreaterThan(0);
        analyze.forEach((c) => expect(c.mnemonic).toBe('TOP'));
    });
});
