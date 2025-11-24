import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAlertStore } from '@/stores/alertStore';

describe('alertStore', () => {
    beforeEach(() => {
        // Reset store before each test
        const store = useAlertStore.getState();
        store.clearAlerts();
        store.clearHistory();
    });

    it('should add a price alert', () => {
        const store = useAlertStore.getState();

        const id = store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'BTC above $50k',
            enabled: true,
            notificationEnabled: true,
            soundEnabled: false
        });

        expect(id).toBeDefined();
        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts).toHaveLength(1);
        expect(updatedStore.alerts[0]?.symbol).toBe('BTCUSDT');
        expect(updatedStore.alerts[0]?.type).toBe('price');
    });

    it('should remove an alert', () => {
        const store = useAlertStore.getState();

        const id = store.addAlert({
            symbol: 'ETHUSDT',
            type: 'price',
            condition: 'below',
            value: 3000,
            message: 'ETH below $3k',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        let updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts).toHaveLength(1);

        store.removeAlert(id);

        updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts).toHaveLength(0);
    });

    it('should toggle alert enabled state', () => {
        const store = useAlertStore.getState();

        const id = store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'Test alert',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        let updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.enabled).toBe(true);

        store.toggleAlert(id);

        updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.enabled).toBe(false);

        store.toggleAlert(id);

        updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.enabled).toBe(true);
    });

    it('should update an alert', () => {
        const store = useAlertStore.getState();

        const id = store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'Original message',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.updateAlert(id, {
            value: 55000,
            message: 'Updated message'
        });

        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.value).toBe(55000);
        expect(updatedStore.alerts[0]?.message).toBe('Updated message');
    });

    it('should check market conditions and trigger price alert', () => {
        const store = useAlertStore.getState();

        // Add alert for BTC above 50000
        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'BTC above $50k',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        // Check with price below threshold
        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 49000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        let updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(false);

        // Check with price above threshold
        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 51000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(true);
        expect(updatedStore.alertHistory).toHaveLength(1);
    });

    it('should check RSI indicator alert', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'indicator',
            condition: 'rsi' as any,
            indicator: 'rsi',
            value: 70,
            message: 'RSI overbought',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 50000,
            rsi: 75,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(true);
    });

    it('should check volume ratio alert', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'volume',
            condition: 'above',
            value: 2,
            message: 'High volume',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 50000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 2.5,
            ofi: 0
        });

        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(true);
    });

    it('should check OFI alert', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'ofi',
            condition: 'above',
            value: 1000,
            message: 'High OFI',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 50000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 1500
        });

        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(true);
    });

    it('should check signal alert', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'signal',
            condition: 'equals',
            value: 'STRONG BUY',
            message: 'Strong buy signal',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 50000,
            rsi: 50,
            signal: 'STRONG BUY',
            volumeRatio: 1,
            ofi: 0
        });

        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(true);
    });

    it('should not trigger disabled alerts', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'Test',
            enabled: false,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 51000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        const updatedStore = useAlertStore.getState();
        expect(updatedStore.alerts[0]?.triggered).toBe(false);
    });

    it('should not trigger already triggered alerts', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'Test',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        // First trigger
        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 51000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        let updatedStore = useAlertStore.getState();
        expect(updatedStore.alertHistory).toHaveLength(1);

        // Second trigger attempt
        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 52000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        updatedStore = useAlertStore.getState();
        // Should still be 1 (not triggered again)
        expect(updatedStore.alertHistory).toHaveLength(1);
    });

    it('should clear alert history', () => {
        const store = useAlertStore.getState();

        store.addAlert({
            symbol: 'BTCUSDT',
            type: 'price',
            condition: 'above',
            value: 50000,
            message: 'Test',
            enabled: true,
            notificationEnabled: false,
            soundEnabled: false
        });

        store.checkMarketConditions({
            symbol: 'BTCUSDT',
            price: 51000,
            rsi: 50,
            signal: 'NEUTRAL',
            volumeRatio: 1,
            ofi: 0
        });

        let updatedStore = useAlertStore.getState();
        expect(updatedStore.alertHistory).toHaveLength(1);

        store.clearHistory();

        updatedStore = useAlertStore.getState();
        expect(updatedStore.alertHistory).toHaveLength(0);
    });

    it('should request notification permission', async () => {
        // Mock Notification API
        const mockRequestPermission = vi.fn().mockResolvedValue('granted');
        global.Notification = {
            requestPermission: mockRequestPermission,
            permission: 'default'
        } as any;

        const store = useAlertStore.getState();
        await store.requestNotificationPermission();

        expect(mockRequestPermission).toHaveBeenCalled();
    });
});
