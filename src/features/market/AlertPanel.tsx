import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Plus, Trash2 } from 'lucide-react';
import { useAlertStore } from '@/stores/alertStore';
import { useMarketData } from '@/stores/marketStore';
import type { AlertCondition } from '@/types/stores';
import { formatPrice } from '@/utils/format';

interface AlertPanelProps {
    symbol: string;
}

const AlertPanel: React.FC<AlertPanelProps> = ({ symbol }) => {
    const market = useMarketData(symbol);
    const alerts = useAlertStore((state) => state.alerts);
    const addAlert = useAlertStore((state) => state.addAlert);
    const removeAlert = useAlertStore((state) => state.removeAlert);
    const toggleAlert = useAlertStore((state) => state.toggleAlert);
    const checkAlerts = useAlertStore((state) => state.checkAlerts);
    const requestPermission = useAlertStore((state) => state.requestNotificationPermission);
    const [condition, setCondition] = useState<Extract<AlertCondition, 'above' | 'below'>>('above');
    const [target, setTarget] = useState('');
    const [notifications, setNotifications] = useState(
        typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false
    );

    useEffect(() => {
        if (market?.price) checkAlerts(symbol, market.price);
    }, [checkAlerts, market?.price, symbol]);

    const createAlert = () => {
        const value = Number(target || market?.price);
        if (!Number.isFinite(value) || value <= 0) return;
        addAlert({
            symbol,
            type: 'price',
            condition,
            value,
            message: `${symbol} moved ${condition} ${formatPrice(value)}`,
            enabled: true,
            soundEnabled: true,
            notificationEnabled: notifications,
        });
    };

    const enableNotifications = async () => {
        const permission = await requestPermission();
        setNotifications(permission === 'granted');
    };

    const symbolAlerts = alerts.filter((alert) => alert.symbol === symbol);

    return (
        <section className="terminal-stack" aria-label={`${symbol} price alerts`}>
            <div className="source-line">
                LOCAL PRICE ALERTS
                <button className="text-action" onClick={enableNotifications}>
                    {notifications ? <Bell size={11} /> : <BellOff size={11} />}
                    {notifications ? 'Browser alerts on' : 'Enable browser alerts'}
                </button>
            </div>
            <div className="alert-ticket">
                <select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)} aria-label="Alert condition">
                    <option value="above">Price above</option>
                    <option value="below">Price below</option>
                </select>
                <input value={target} placeholder={market?.price ? String(market.price) : 'Target price'} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" aria-label="Alert target price" />
                <button className="primary-action" onClick={createAlert}><Plus size={12} /> Add</button>
            </div>
            <div className="alert-list">
                {symbolAlerts.map((alert) => (
                    <div className={`alert-row ${alert.enabled ? '' : 'alert-row--disabled'}`} key={alert.id}>
                        <button className="icon-action" onClick={() => toggleAlert(alert.id)} aria-label={`${alert.enabled ? 'Disable' : 'Enable'} alert`}>
                            {alert.enabled ? <Bell size={12} /> : <BellOff size={12} />}
                        </button>
                        <div>
                            <strong>{alert.condition.replace('_', ' ').toUpperCase()} {formatPrice(Number(alert.value))}</strong>
                            <small>{alert.triggered ? 'Triggered' : 'Armed'} · Created {new Date(alert.createdAt).toLocaleTimeString()}</small>
                        </div>
                        <button className="icon-action" onClick={() => removeAlert(alert.id)} aria-label="Delete alert"><Trash2 size={12} /></button>
                    </div>
                ))}
                {!symbolAlerts.length && <div className="panel-state"><Bell size={15} /> No alerts armed for {symbol}</div>}
            </div>
            <div className="freshness-line">Alerts run in this browser while the terminal is open.</div>
        </section>
    );
};

export default AlertPanel;
