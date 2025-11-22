import React, { useState } from 'react';
import { useAlertStore } from '@/stores/alertStore';
import { Bell, BellOff, Plus, Trash2, Clock } from 'lucide-react';

// Alert types (previously from AlertEngine)
const ALERT_TYPES = {
    PRICE_ABOVE: 'price_above',
    PRICE_BELOW: 'price_below',
    RSI_OVERBOUGHT: 'rsi_overbought',
    RSI_OVERSOLD: 'rsi_oversold',
    VOLUME_SPIKE: 'volume_spike',
    OFI_FLIP: 'ofi_flip',
    SIGNAL_CHANGE: 'signal_change',
    LIQUIDATION_LARGE: 'liquidation_large'
};

const AlertPanel = () => {
    const { alerts, history, addAlert, removeAlert, toggleAlert, clearHistory } = useAlertStore();
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAlert, setNewAlert] = useState({
        type: ALERT_TYPES.PRICE_ABOVE,
        value: '',
        symbol: 'BTCUSDT',
        repeating: false
    });

    const handleAddAlert = () => {
        if (!newAlert.value && newAlert.type !== ALERT_TYPES.SIGNAL_CHANGE && newAlert.type !== ALERT_TYPES.OFI_FLIP) {
            return;
        }

        addAlert({
            ...newAlert,
            value: parseFloat(newAlert.value) || 0
        });

        setNewAlert({ type: ALERT_TYPES.PRICE_ABOVE, value: '', symbol: 'BTCUSDT', repeating: false });
        setShowAddForm(false);
    };

    const formatAlertType = (type) => {
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const formatTime = (ts) => {
        const date = new Date(ts);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', padding: '12px', overflow: 'hidden', fontFamily: 'var(--font-mono)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    ALERTS ({alerts.length})
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--accent-primary)',
                        padding: '2px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)'
                    }}
                >
                    {showAddForm ? 'CANCEL' : '+ ADD'}
                </button>
            </div>

            {/* Add Alert Form */}
            {showAddForm && (
                <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(0,255,0,0.05)',
                    fontSize: '11px'
                }}>
                    <div style={{ marginBottom: '8px' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '9px', display: 'block', marginBottom: '4px' }}>TYPE</label>
                        <select
                            value={newAlert.type}
                            onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value })}
                            style={{
                                width: '100%',
                                background: '#000',
                                border: '1px solid #333',
                                color: '#fff',
                                padding: '4px',
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono)'
                            }}
                        >
                            {Object.values(ALERT_TYPES).map(type => (
                                <option key={type} value={type}>{formatAlertType(type)}</option>
                            ))}
                        </select>
                    </div>

                    {(newAlert.type !== ALERT_TYPES.SIGNAL_CHANGE && newAlert.type !== ALERT_TYPES.OFI_FLIP) && (
                        <div style={{ marginBottom: '8px' }}>
                            <label style={{ color: 'var(--text-secondary)', fontSize: '9px', display: 'block', marginBottom: '4px' }}>VALUE</label>
                            <input
                                type="number"
                                value={newAlert.value}
                                onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })}
                                placeholder="Enter threshold"
                                style={{
                                    width: '100%',
                                    background: '#000',
                                    border: '1px solid #333',
                                    color: '#fff',
                                    padding: '4px',
                                    fontSize: '10px',
                                    fontFamily: 'var(--font-mono)'
                                }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '4px' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="checkbox"
                                checked={newAlert.repeating}
                                onChange={(e) => setNewAlert({ ...newAlert, repeating: e.target.checked })}
                            />
                            REPEATING
                        </label>
                    </div>

                    <button
                        onClick={handleAddAlert}
                        style={{
                            width: '100%',
                            marginTop: '8px',
                            background: 'var(--accent-primary)',
                            border: 'none',
                            color: '#000',
                            padding: '6px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontFamily: 'var(--font-mono)'
                        }}
                    >
                        CREATE ALERT
                    </button>
                </div>
            )}

            {/* Active Alerts */}
            <div style={{ flex: showAddForm ? '0 0 auto' : '1', overflowY: 'auto', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px' }}>ACTIVE</div>
                {alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px', padding: '20px' }}>
                        No alerts configured
                    </div>
                ) : (
                    alerts.map(alert => (
                        <div
                            key={alert.id}
                            style={{
                                marginBottom: '6px',
                                padding: '6px',
                                border: `1px solid ${alert.enabled ? 'var(--accent-primary)' : '#333'}`,
                                background: alert.enabled ? 'rgba(0,255,0,0.05)' : 'rgba(0,0,0,0.3)',
                                opacity: alert.enabled ? 1 : 0.5,
                                fontSize: '10px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>{formatAlertType(alert.type)}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => toggleAlert(alert.id)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                        {alert.enabled ? <Bell size={12} color="var(--accent-primary)" /> : <BellOff size={12} color="#666" />}
                                    </button>
                                    <button
                                        onClick={() => removeAlert(alert.id)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Trash2 size={12} color="var(--accent-danger)" />
                                    </button>
                                </div>
                            </div>
                            {alert.value && (
                                <div style={{ color: 'var(--text-secondary)' }}>Threshold: {alert.value}</div>
                            )}
                            <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                                {alert.symbol} • {alert.repeating ? 'Repeating' : 'One-time'}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* History */}
            {!showAddForm && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            HISTORY ({history.length})
                        </div>
                        {history.length > 0 && (
                            <button
                                onClick={clearHistory}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)'
                                }}
                            >
                                CLEAR
                            </button>
                        )}
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {history.slice(0, 10).map(item => (
                            <div
                                key={`${item.id}-${item.timestamp}`}
                                style={{
                                    padding: '4px',
                                    marginBottom: '4px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    fontSize: '9px'
                                }}
                            >
                                <div style={{ color: '#fff', marginBottom: '2px' }}>{item.message}</div>
                                <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={8} />
                                    {formatTime(item.timestamp)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(AlertPanel);
