import { renderHook, act } from '@testing-library/react';
import { useAlertStore } from '@/stores/alertStore';
import { describe, test, beforeEach, expect } from 'vitest';
describe('alertStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        const { clearTriggeredAlerts, clearHistory } = useAlertStore.getState();
        act(() => {
            clearTriggeredAlerts();
            clearHistory();
        });
    });

    test('addAlert creates an alert with correct fields', () => {
        const { result } = renderHook(() => useAlertStore());
        act(() => {
            result.current.addAlert({
                symbol: 'BTCUSDT',
                type: 'price',
                condition: 'above',
                value: 50000,
                message: 'Price above 50k',
                enabled: true,
                soundEnabled: false,
                notificationEnabled: false,
            });
        });
        expect(result.current.alerts).toHaveLength(1);
        const alert = result.current.alerts[0]!;
        expect(alert.symbol).toBe('BTCUSDT');
        expect(alert.type).toBe('price');
        expect(alert.condition).toBe('above');
        expect(alert.value).toBe(50000);
    });

    test('triggerAlert moves alert to history and marks triggered', () => {
        const { result } = renderHook(() => useAlertStore());
        const alertId = result.current.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 1,
            message: 'test',
            enabled: true,
            soundEnabled: false,
            notificationEnabled: false,
        });
        act(() => {
            result.current.triggerAlert(alertId);
        });
        expect(result.current.alerts[0]?.triggered).toBe(true);
        expect(result.current.history).toHaveLength(1);
        expect(result.current.history[0]?.id).toBe(alertId);
    });
});
