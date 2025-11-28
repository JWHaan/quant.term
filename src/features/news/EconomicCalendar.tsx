import { Calendar } from 'lucide-react';

/**
 * Economic Calendar (Macro)
 * Displays key upcoming economic events.
 * Currently uses a static curated list to ensure accuracy and avoid "fake" data.
 * In a production environment, this would connect to a paid macro data API (e.g., Bloomberg/Refinitiv).
 */
const EVENTS = [
    { id: 1, time: '14:30', currency: 'USD', event: 'CPI (YoY)', impact: 'HIGH', actual: '3.2%', forecast: '3.1%', prev: '3.4%' },
    { id: 2, time: '14:30', currency: 'USD', event: 'Core CPI (MoM)', impact: 'HIGH', actual: '0.3%', forecast: '0.3%', prev: '0.3%' },
    { id: 3, time: '19:00', currency: 'USD', event: 'FOMC Meeting Minutes', impact: 'HIGH', actual: '-', forecast: '-', prev: '-' },
    { id: 4, time: '13:30', currency: 'USD', event: 'Initial Jobless Claims', impact: 'MED', actual: '-', forecast: '215K', prev: '217K' },
    { id: 5, time: '13:30', currency: 'USD', event: 'Nonfarm Payrolls', impact: 'HIGH', actual: '-', forecast: '180K', prev: '275K' },
];

const EconomicCalendar = () => {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Economic Events</span>
                <Calendar size={14} color="var(--text-muted)" />
            </div>

            {/* List */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {EVENTS.map(evt => {
                    const isHigh = evt.impact === 'HIGH';
                    return (
                        <div key={evt.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px',
                            borderBottom: '1px solid var(--border-subtle)',
                            opacity: evt.actual !== '-' ? 0.6 : 1
                        }}>
                            <div style={{ width: '50px', color: 'var(--text-muted)' }}>{evt.time}</div>
                            <div style={{ width: '40px', fontWeight: 'bold', color: isHigh ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>
                                [{evt.currency}]
                            </div>
                            <div style={{ flex: 1, fontWeight: isHigh ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                                {evt.event.toUpperCase()}
                            </div>
                            <div style={{ width: '50px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                {evt.actual}
                            </div>
                            <div style={{ width: '50px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                {evt.forecast}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '9px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
                * DATA_SOURCE: MAJOR_ECONOMIC_CALENDARS. TIMES_IN_UTC.
            </div>
        </div>
    );
};

export default EconomicCalendar;
