import { AlertTriangle } from 'lucide-react';

/**
 * DisclaimerBanner - Prominent legal disclaimer for educational trading tool
 * Required for any platform that displays trading signals or market analysis
 */
export const DisclaimerBanner = () => {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(255, 200, 0, 0.15) 0%, rgba(255, 150, 0, 0.1) 100%)',
            border: '1px solid rgba(255, 200, 0, 0.5)',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '12px',
            backdropFilter: 'blur(10px)'
        }}>
            <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
            }}>
                <AlertTriangle size={20} color="#FFC800" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                    <div style={{
                        fontWeight: '700',
                        fontSize: '13px',
                        color: '#FFC800',
                        marginBottom: '6px',
                        letterSpacing: '0.5px'
                    }}>
                        EDUCATIONAL TOOL ONLY – NOT FINANCIAL ADVICE
                    </div>
                    <p style={{
                        fontSize: '11px',
                        margin: 0,
                        color: 'rgba(255, 255, 255, 0.85)',
                        lineHeight: '1.5'
                    }}>
                        This platform is provided for <strong>informational and educational purposes only</strong>.
                        It is NOT financial, investment, or trading advice. Cryptocurrency trading involves
                        substantial risk of loss. Past performance does not guarantee future results. Signals
                        and indicators shown are experimental and may be inaccurate. <strong>Never trade with
                            money you cannot afford to lose.</strong> Always conduct your own research and consult
                        with a licensed financial advisor before making any investment decisions.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DisclaimerBanner;
