/**
 * Alert Engine
 * Monitors market conditions and triggers alerts based on user-defined rules
 */

export const ALERT_TYPES = {
    PRICE_ABOVE: 'price_above',
    PRICE_BELOW: 'price_below',
    RSI_OVERBOUGHT: 'rsi_overbought',
    RSI_OVERSOLD: 'rsi_oversold',
    VOLUME_SPIKE: 'volume_spike',
    OFI_FLIP: 'ofi_flip',
    SIGNAL_CHANGE: 'signal_change',
    LIQUIDATION_LARGE: 'liquidation_large'
};

export class AlertEngine {
    constructor() {
        this.alerts = [];
        this.triggeredHistory = [];
        this.requestNotificationPermission();
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    /**
     * Add a new alert
     * @param {Object} alert - Alert configuration
     * @returns {string} - Alert ID
     */
    addAlert(alert) {
        const newAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...alert,
            enabled: true,
            triggered: false,
            createdAt: Date.now()
        };

        this.alerts.push(newAlert);
        return newAlert.id;
    }

    /**
     * Remove an alert
     */
    removeAlert(alertId) {
        this.alerts = this.alerts.filter(a => a.id !== alertId);
    }

    /**
     * Update alert enabled state
     */
    toggleAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.enabled = !alert.enabled;
        }
    }

    /**
     * Check market conditions and trigger alerts
     * @param {Object} marketData - Current market state
     */
    checkAlerts(marketData) {
        const now = Date.now();

        this.alerts.forEach(alert => {
            if (!alert.enabled || alert.triggered) return;

            let shouldTrigger = false;
            let message = '';

            switch (alert.type) {
                case ALERT_TYPES.PRICE_ABOVE:
                    if (marketData.price >= alert.value) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} price above $${alert.value}`;
                    }
                    break;

                case ALERT_TYPES.PRICE_BELOW:
                    if (marketData.price <= alert.value) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} price below $${alert.value}`;
                    }
                    break;

                case ALERT_TYPES.RSI_OVERBOUGHT:
                    if (marketData.rsi >= (alert.value || 70)) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} RSI overbought (${marketData.rsi.toFixed(1)})`;
                    }
                    break;

                case ALERT_TYPES.RSI_OVERSOLD:
                    if (marketData.rsi <= (alert.value || 30)) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} RSI oversold (${marketData.rsi.toFixed(1)})`;
                    }
                    break;

                case ALERT_TYPES.VOLUME_SPIKE:
                    if (marketData.volumeRatio >= (alert.value || 2)) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} volume spike (${marketData.volumeRatio.toFixed(1)}x average)`;
                    }
                    break;

                case ALERT_TYPES.OFI_FLIP:
                    const previousOFI = alert.lastOFI || 0;
                    if ((previousOFI >= 0 && marketData.ofi < 0) || (previousOFI < 0 && marketData.ofi >= 0)) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} OFI flipped to ${marketData.ofi > 0 ? 'BUY' : 'SELL'} pressure`;
                    }
                    alert.lastOFI = marketData.ofi;
                    break;

                case ALERT_TYPES.SIGNAL_CHANGE:
                    if (alert.lastSignal && alert.lastSignal !== marketData.signal) {
                        shouldTrigger = true;
                        message = `${marketData.symbol} signal changed to ${marketData.signal}`;
                    }
                    alert.lastSignal = marketData.signal;
                    break;

                case ALERT_TYPES.LIQUIDATION_LARGE:
                    if (marketData.liquidationValue >= (alert.value || 100000)) {
                        shouldTrigger = true;
                        message = `Large ${marketData.liquidationSide} liquidation: $${(marketData.liquidationValue / 1000).toFixed(0)}K`;
                    }
                    break;
            }

            if (shouldTrigger) {
                this.triggerAlert(alert, message);
            }
        });
    }

    /**
     * Trigger an alert
     */
    triggerAlert(alert, message) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();

        this.triggeredHistory.unshift({
            id: alert.id,
            type: alert.type,
            message,
            timestamp: Date.now()
        });

        // Limit history to 100 items
        if (this.triggeredHistory.length > 100) {
            this.triggeredHistory = this.triggeredHistory.slice(0, 100);
        }

        // Send browser notification
        this.sendNotification(message);

        // If alert is one-time, disable it
        if (!alert.repeating) {
            alert.enabled = false;
        } else {
            // For repeating alerts, reset after cooldown
            setTimeout(() => {
                alert.triggered = false;
            }, alert.cooldown || 60000); // Default 1 minute cooldown
        }
    }

    /**
     * Send browser notification
     */
    sendNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Quant Terminal Alert', {
                body: message,
                icon: '/quant_term_logo.svg',
                tag: 'quant-alert',
                requireInteraction: false
            });
        }

        // Also play sound
        this.playAlertSound();
    }

    /**
     * Play alert sound
     */
    playAlertSound() {
        // Use Web Audio API for a simple beep
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.warn('Unable to play alert sound:', error);
        }
    }

    /**
     * Get all alerts
     */
    getAlerts() {
        return this.alerts;
    }

    /**
     * Get triggered history
     */
    getHistory() {
        return this.triggeredHistory;
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.triggeredHistory = [];
    }
}

// Global instance (singleton)
export const alertEngine = new AlertEngine();
