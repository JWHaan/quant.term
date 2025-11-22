import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AlertState, Alert, AlertCondition } from '@/types/stores';

/**
 * Alert Store - Global state for trading alerts
 * Manages price, indicator, volume, and custom alerts
 * 
 * Features:
 * - Multiple alert types (price, indicator, volume, OFI, signal, liquidation)
 * - Alert triggering logic
 * - Browser notification support
 * - Sound notification support
 * - Alert history tracking
 */

// Internal alert engine for checking conditions
class AlertEngine {
    private alerts: Alert[] = [];
    private history: Array<Alert & { triggeredAt: number }> = [];

    addAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>): string {
        const id = `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const newAlert: Alert = {
            ...alert,
            id,
            createdAt: Date.now(),
            triggered: false
        };
        this.alerts.push(newAlert);
        return id;
    }

    removeAlert(id: string): void {
        this.alerts = this.alerts.filter(a => a.id !== id);
    }

    toggleAlert(id: string): void {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) {
            alert.enabled = !alert.enabled;
        }
    }

    updateAlert(id: string, updates: Partial<Alert>): void {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) {
            Object.assign(alert, updates);
        }
    }

    triggerAlert(id: string): void {
        const alert = this.alerts.find(a => a.id === id);
        if (alert && alert.enabled && !alert.triggered) {
            alert.triggered = true;
            alert.lastTriggered = Date.now();

            // Add to history
            this.history.push({
                ...alert,
                triggeredAt: Date.now()
            });

            // Browser notification
            if (alert.notificationEnabled && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(`Alert: ${alert.symbol}`, {
                        body: alert.message,
                        icon: '/favicon.ico'
                    });
                }
            }

            // Sound notification (if enabled)
            if (alert.soundEnabled) {
                this.playAlertSound();
            }
        }
    }

    private playAlertSound(): void {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjJ7yvLRgj4IEnC67+yNRwsWZsfr77NSFQpJmu36vmQdBSp4y/HSlEILFGbA7/KUUA0KVbHj6MBkHgY5i9nxx2MqBCh0wfHZlj8JF3DF8+SOSwsYYrTq7aZNEQxGm9vvxGQhBi+D0fPTgjsHEWi/8eeJNQgZabvv6Zs+CRNlvez0mE0ODV2378NjHQY2jtH1zm0pBSZ2yo/LejgEEWrD8OOOSQsXX7nr87JiHgU6k9f0yXEqBSd4zvPWjj0IDmzB8O2NRQsVXrbn7qpSEQtGnOD1xWMcBjGH0fLOeygEJHXI89CGPwkVb7/y45FGDRVW6+n0sGAfBjiP1vLLeScEJnfM8tiLOwgTc8Xx4It4IQUqeMvw04k5BxNqv+3smEIKFGS97++VTw0OVrLl67JcGwU4jNPy0m8nBSV4y++8fzgGD2K87eJ7FgMW8BfD4/+3j60gcAIAAAEFCgsPEhUZHR8gISIiIiMiIiIhHx0YFhMPDAgHBQMCAAABAgQGCgsMCA0QFRUVFBQTExIRERAODgwMCgoDAwIBAAABAwQGBggKDAwODg8RERITExMUFBQUExQTEhIREA8PCg' +
                'oJCAYFAwIBAAABAQMFBggICw4PEBETExQVFRYWFRUUFBISERAOCw8LCwoIBwYFAwIBAAACAwQGBgkLDQ4QERQVFhUWFRQUExERDw4MCwkIBQQCAgECAAAAAwMGBggJCwoMDA4PEBESExMSExMSERAPDgwLCggGBQMBAAABAAIDBAQGBwgKDAwN');
            audio.play().catch(() => {
                // Silent fail for audio playback errors
            });
        } catch (error) {
            console.warn('Failed to play alert sound:', error);
        }
    }

    checkAlerts(symbol: string, price: number, indicators?: Record<string, number>): string[] {
        const triggeredIds: string[] = [];

        this.alerts.forEach(alert => {
            if (!alert.enabled || alert.triggered || alert.symbol !== symbol) {
                return;
            }

            let shouldTrigger = false;

            switch (alert.type) {
                case 'price':
                    shouldTrigger = this.checkPriceCondition(price, alert.condition, alert.value);
                    break;
                case 'indicator':
                    if (indicators) {
                        const indicatorValue = indicators[alert.condition];
                        if (indicatorValue !== undefined) {
                            shouldTrigger = indicatorValue >= alert.value;
                        }
                    }
                    break;
                case 'volume':
                    // Volume alerts would need volume data
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
                return Math.abs(price - targetValue) < 0.01; // Small tolerance
            default:
                return false;
        }
    }

    getAlerts(): Alert[] {
        return this.alerts;
    }

    getHistory(): Array<Alert & { triggeredAt: number }> {
        return this.history;
    }

    clearHistory(): void {
        this.history = [];
    }

    setAlerts(alerts: Alert[]): void {
        this.alerts = alerts;
    }
}

const alertEngine = new AlertEngine();

// Storage adapter that works both in the browser and in test/non-DOM environments
const alertStorage = createJSONStorage(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    // Vitest / Node or environments without localStorage: use a no-op storage
    return {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
    } as any;
});

export const useAlertStore = create<AlertState>()(
    persist(
        (set, get) => ({
            // State
            alerts: [],
            triggeredAlerts: [],

            // Actions
            addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => {
                const id = alertEngine.addAlert(alert);
                set({ alerts: alertEngine.getAlerts() });
                return id;
            },

            removeAlert: (id: string) => {
                alertEngine.removeAlert(id);
                set({
                    alerts: alertEngine.getAlerts(),
                    triggeredAlerts: get().triggeredAlerts.filter(tId => tId !== id)
                });
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
                set(state => ({
                    alerts: alertEngine.getAlerts(),
                    triggeredAlerts: [...state.triggeredAlerts, id]
                }));
            },

            clearTriggeredAlerts: () => {
                set({ triggeredAlerts: [] });
            },

            checkAlerts: (symbol: string, price: number, indicators?: Record<string, number>) => {
                const triggeredIds = alertEngine.checkAlerts(symbol, price, indicators);
                if (triggeredIds.length > 0) {
                    set(state => ({
                        alerts: alertEngine.getAlerts(),
                        triggeredAlerts: [...state.triggeredAlerts, ...triggeredIds]
                    }));
                }
            },

            // Getters
            getAlertsBySymbol: (symbol: string): Alert[] => {
                return get().alerts.filter(a => a.symbol === symbol);
            },

            getActiveAlerts: (): Alert[] => {
                return get().alerts.filter(a => a.enabled && !a.triggered);
            },

            // History management
            history: alertEngine.getHistory(),

            getHistory: (): Array<Alert & { triggeredAt: number }> => {
                return alertEngine.getHistory();
            },

            clearHistory: () => {
                alertEngine.clearHistory();
                set({ history: [] });
            },

            checkMarketConditions: (marketData: any) => {
                // For compatibility with components expecting this method
                if (marketData.symbol && marketData.price) {
                    get().checkAlerts(marketData.symbol, marketData.price, {
                        rsi: marketData.rsi,
                        macd: marketData.macd
                    });
                }
            }
        }),
        {
            name: 'alert-store',
            storage: alertStorage,
            partialize: (state) => ({
                alerts: state.alerts.map(a => ({
                    ...a,
                    triggered: false // Reset triggered state on load
                }))
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Restore alerts to the engine
                    alertEngine.setAlerts(state.alerts);
                }
            }
        }
    )
);

export default useAlertStore;
