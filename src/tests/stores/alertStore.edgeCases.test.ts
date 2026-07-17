import { beforeEach, describe, expect, it } from 'vitest';
import { useAlertStore } from '@/stores/alertStore';

const addAlert = (
    overrides: Partial<Parameters<ReturnType<typeof useAlertStore.getState>['addAlert']>[0]> = {},
): string => useAlertStore.getState().addAlert({
    symbol: 'BTCUSDT',
    type: 'price',
    condition: 'above',
    value: 100,
    message: 'threshold reached',
    enabled: true,
    notificationEnabled: false,
    soundEnabled: false,
    ...overrides,
});

describe('alertStore edge cases', () => {
    beforeEach(() => {
        const store = useAlertStore.getState();
        store.clearAlerts();
        store.clearHistory();
        store.clearTriggeredAlerts();
    });

    it('requires matching symbols and available liquidation data', () => {
        const id = addAlert({
            type: 'liquidation',
            condition: 'below',
            value: 1_000_000,
        });

        expect(useAlertStore.getState().checkAlerts('ETHUSDT', 100, { liquidation: 900_000 })).toEqual([]);
        expect(useAlertStore.getState().checkAlerts('BTCUSDT', 100)).toEqual([]);
        expect(useAlertStore.getState().checkAlerts('BTCUSDT', 100, { liquidation: 900_000 })).toEqual([id]);
    });

    it('uses the documented tolerance for equals alerts', () => {
        const id = addAlert({ condition: 'equals' });

        expect(useAlertStore.getState().checkAlerts('BTCUSDT', 100.02)).toEqual([]);
        expect(useAlertStore.getState().checkAlerts('BTCUSDT', 100.009)).toEqual([id]);
    });

    it('does not duplicate a previously triggered alert or its history entry', () => {
        const id = addAlert();
        expect(useAlertStore.getState().checkAlerts('BTCUSDT', 101)).toEqual([id]);
        expect(useAlertStore.getState().checkAlerts('BTCUSDT', 102)).toEqual([]);

        const state = useAlertStore.getState();
        expect(state.triggeredAlerts).toEqual([id]);
        expect(state.alertHistory).toHaveLength(1);
        expect(state.history).toHaveLength(1);
    });
});
