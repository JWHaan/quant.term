import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
    AlertState,
    Alert,
    AlertCondition,
    MarketConditionPayload,
} from '@/types/stores';

interface AlertHistoryEntry extends Alert {
    triggeredAt: number;
}

const STORAGE_FALLBACK = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};

class AlertEngine {
    private alerts: Alert[] = [];
    private history: AlertHistoryEntry[] = [];

    addAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>): string {
        const id = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newAlert: Alert = { ...alert, id, createdAt: Date.now(), triggered: false };
        this.alerts.push(newAlert);
        return id;
    }

    removeAlert(id: string): void {
        this.alerts = this.alerts.filter((a) => a.id !== id);
    }

    toggleAlert(id: string): void {
        const alert = this.alerts.find((a) => a.id === id);
        if (alert) alert.enabled = !alert.enabled;
    }

    updateAlert(id: string, updates: Partial<Alert>): void {
        const alert = this.alerts.find((a) => a.id === id);
        if (alert) Object.assign(alert, updates);
    }

    triggerAlert(id: string): void {
        const alert = this.alerts.find((a) => a.id === id);
        if (!alert || !alert.enabled || alert.triggered) return;

        alert.triggered = true;
        alert.lastTriggered = Date.now();
        this.history.push({ ...alert, triggeredAt: Date.now() });

        if (alert.notificationEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(`Alert: ${alert.symbol}`, {
                body: alert.message,
                icon: '/quant_term_logo.svg',
            });
        }

        if (alert.soundEnabled) this.playAlertSound();
    }

    private playAlertSound(): void {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjJ7yvLRgj4IEnC67+yNRwsWZsfr77NSFQpJmu36vmQdBSp4y/HSlEILFGbA7/KUUA0KVbHj6MBkHgY5i9nxx2MqBCh0wfHZlj8JF3DF8+SOSwsYYrTq7aZNEQxGm9vvxGQhBi+D0fPTgjsHEWi/8eeJNQgZabvv6Zs+CRNlvez0mE0ODV2378NjHQY2jtH1zm0pBSZ2yo/LejgEEWrD8OOOSQsXX7nr87JiHgU6k9f0yXEqBSd4zvPWjj0IDmzB8O2NRQsVXrbn7qpSEQtGnOD1xWMcBjGH0fLOeygEJHXI89CGPwkVb7/y45FGDRVW6+n0sGAfBjiP1vLLeScEJnfM8tiLOwgTc8Xx4It4IQUqeMvw04k5BxNqv+3smEIKFGS97++VTw0OVrLl67JcGwU4jNPy0m8nBSV4y++8fzgGD2K87eJ7FgMW8BfD4/+3j60gcAIAAAEFCgsPEhUZHR8gISIiIiMiIiIhHx0YFhMPDAgHBQMCAAABAgQGCgsMCA0QFRUVFBQTExIRERAODgwMCgoDAwIBAAABAwQGBggKDAwODg8RERITExMUFBQUExMTEhIREA8PCgoJCAYFAwIBAAABAAIDBAQGBwgKDAwODQ8RERITExMUFBQUExMTEhIREA8PCgoJCAYFAwIBAAACAwQGBgkLDQ4QERQVFhUWFRQUExERDw4MCwkIBQQCAgECAAAAAwMGBggJCwoMDA4PEBESExMSExMSERAPDgwLCggGBQMBAAABAAIDBAQGBwgKDAwN');
            audio.play().catch(() => {});
        } catch (error) {
            console.warn('Failed to play alert sound:', error);
        }
    }

    checkAlerts(symbol: string, price: number, marketData?: Omit<MarketConditionPayload, 'symbol' | 'price'>): string[] {
        const triggeredIds: string[] = [];

        this.alerts.forEach((alert) => {
            if (!alert.enabled || alert.triggered || alert.symbol !== symbol) return;

            let shouldTrigger = false;
            switch (alert.type) {
                case 'price':
                    if (typeof alert.value === 'number') shouldTrigger = this.checkPriceCondition(price, alert.condition, alert.value);
                    break;
                case 'indicator': {
                    if (marketData && alert.indicator && typeof alert.value === 'number') {
                        const indicatorValue = marketData[alert.indicator];
                        if (typeof indicatorValue === 'number') {
                            shouldTrigger = this.checkPriceCondition(
                                indicatorValue,
                                alert.condition,
                                alert.value,
                            );
                        }
                    }
                    break;
                }
                case 'volume':
                    if (marketData?.volumeRatio !== undefined && typeof alert.value === 'number') {
                        shouldTrigger = this.checkPriceCondition(marketData.volumeRatio, alert.condition, alert.value);
                    }
                    break;
                case 'signal':
                    if (marketData?.signal !== undefined && typeof alert.value === 'string') {
                        shouldTrigger = marketData.signal === alert.value;
                    }
                    break;
                case 'ofi':
                    if (typeof marketData?.ofi === 'number' && typeof alert.value === 'number') {
                        shouldTrigger = this.checkPriceCondition(marketData.ofi, alert.condition, alert.value);
                    }
                    break;
                case 'liquidation':
                    if (typeof marketData?.liquidation === 'number' && typeof alert.value === 'number') {
                        shouldTrigger = this.checkPriceCondition(marketData.liquidation, alert.condition, alert.value);
                    }
                    break;
                default:
                    break;
            }

            if (shouldTrigger) {
                this.triggerAlert(alert.id);
                triggeredIds.push(alert.id);
            }
        });

        return triggeredIds;
    }

    private checkPriceCondition(price: number, condition: AlertCondition, targetValue: number): boolean {
        switch (condition) {
            case 'above':
                return price > targetValue;
            case 'below':
                return price < targetValue;
            case 'equals':
                return Math.abs(price - targetValue) < 0.01;
            default:
                return false;
        }
    }

    getAlerts(): Alert[] {
        return this.alerts;
    }

    getHistory(): AlertHistoryEntry[] {
        return this.history;
    }

    clearHistory(): void {
        this.history = [];
    }

    setAlerts(alerts: Alert[]): void {
        this.alerts = alerts;
    }

    clearAlerts(): void {
        this.alerts = [];
    }
}

const alertEngine = new AlertEngine();

const alertStorage = createJSONStorage(() => {
    if (import.meta.env.MODE === 'test') return STORAGE_FALLBACK;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return STORAGE_FALLBACK;
});

export const useAlertStore = create<AlertState>()(
    persist(
        (set, get) => ({
            alerts: [],
            triggeredAlerts: [],
            history: [],
            alertHistory: [],

            addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => {
                const id = alertEngine.addAlert(alert);
                set({ alerts: alertEngine.getAlerts() });
                return id;
            },

            removeAlert: (id: string) => {
                alertEngine.removeAlert(id);
                set({ alerts: alertEngine.getAlerts(), triggeredAlerts: get().triggeredAlerts.filter((tId) => tId !== id), alertHistory: alertEngine.getHistory(), history: alertEngine.getHistory() });
            },

            toggleAlert: (id: string) => {
                alertEngine.toggleAlert(id);
                set({ alerts: alertEngine.getAlerts() });
            },

            updateAlert: (id: string, updates: Partial<Alert>) => {
                alertEngine.updateAlert(id, updates);
                set({ alerts: alertEngine.getAlerts() });
            },

            triggerAlert: (id: string) => {
                alertEngine.triggerAlert(id);
                set((state) => ({ alerts: alertEngine.getAlerts(), triggeredAlerts: [...state.triggeredAlerts, id], history: alertEngine.getHistory(), alertHistory: alertEngine.getHistory() }));
            },

            clearTriggeredAlerts: () => set({ triggeredAlerts: [] }),

            clearAlerts: () => {
                alertEngine.clearAlerts();
                set({ alerts: [], triggeredAlerts: [] });
            },

            checkAlerts: (symbol: string, price: number, marketData?: Omit<MarketConditionPayload, 'symbol' | 'price'>) => {
                const triggeredIds = alertEngine.checkAlerts(symbol, price, marketData);
                if (triggeredIds.length > 0) {
                    set((state) => ({ alerts: alertEngine.getAlerts(), triggeredAlerts: [...state.triggeredAlerts, ...triggeredIds], alertHistory: alertEngine.getHistory(), history: alertEngine.getHistory() }));
                }
                return triggeredIds;
            },

            getAlertsBySymbol: (symbol: string): Alert[] => get().alerts.filter((a) => a.symbol === symbol),
            getActiveAlerts: (): Alert[] => get().alerts.filter((a) => a.enabled && !a.triggered),
            getHistory: (): AlertHistoryEntry[] => {
                const history = alertEngine.getHistory();
                set({ alertHistory: history, history });
                return history;
            },
            clearHistory: () => {
                alertEngine.clearHistory();
                set({ history: [], alertHistory: [] });
            },
            requestNotificationPermission: async (): Promise<string> => {
                if (typeof Notification !== 'undefined' && Notification.requestPermission) {
                    return Notification.requestPermission();
                }
                return 'granted';
            },
            checkMarketConditions: (marketData: MarketConditionPayload) => {
                if (!marketData.symbol || !marketData.price) return;
                const conditions: Omit<MarketConditionPayload, 'symbol' | 'price'> = {
                    ...(marketData.rsi !== undefined ? { rsi: marketData.rsi } : {}),
                    ...(marketData.macd !== undefined ? { macd: marketData.macd } : {}),
                    ...(marketData.volumeRatio !== undefined ? { volumeRatio: marketData.volumeRatio } : {}),
                    ...(marketData.signal !== undefined ? { signal: marketData.signal } : {}),
                    ...(marketData.ofi !== undefined ? { ofi: marketData.ofi } : {}),
                    ...(marketData.liquidation !== undefined ? { liquidation: marketData.liquidation } : {}),
                };
                get().checkAlerts(marketData.symbol, marketData.price, conditions);
            },
        }),
        {
            name: 'alert-store',
            storage: alertStorage,
            partialize: (state) => ({
                alerts: state.alerts.map((a) => ({ ...a, triggered: false })),
            }),
            onRehydrateStorage: () => (state) => {
                if (state) alertEngine.setAlerts(state.alerts);
            },
        }
    )
);

export const useAlerts = () => useAlertStore((s) => s.alerts);
export const useTriggeredAlerts = () => useAlertStore((s) => s.triggeredAlerts);
export const useActiveAlerts = () => useAlertStore((s) => s.getActiveAlerts());
export const useAddAlert = () => useAlertStore((s) => s.addAlert);
export const useCheckMarketConditions = () => useAlertStore((s) => s.checkMarketConditions);

export default useAlertStore;
