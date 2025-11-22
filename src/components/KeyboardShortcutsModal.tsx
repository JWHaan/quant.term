import React from 'react';
import { X, Keyboard } from 'lucide-react';
import type { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
    shortcuts: KeyboardShortcut[];
    isOpen: boolean;
    onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ shortcuts, isOpen, onClose }) => {
    if (!isOpen) return null;

    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
        const category = shortcut.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category]!.push(shortcut);
        return acc;
    }, {} as Record<string, KeyboardShortcut[]>);

    const formatShortcut = (shortcut: KeyboardShortcut) => {
        const parts: string[] = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.shift) parts.push('Shift');
        if (shortcut.alt) parts.push('Alt');
        parts.push(shortcut.key.toUpperCase());
        return parts.join(' + ');
    };

    const categoryLabels = {
        navigation: 'Navigation',
        panels: 'Panel Focus',
        actions: 'Actions'
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'linear-gradient(135deg, #0A0A14 0%, #1A1A24 100%)',
                    border: '1px solid rgba(255, 128, 0, 0.3)',
                    borderRadius: '8px',
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(255, 128, 0, 0.2)',
                    animation: 'slideUp 0.3s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid rgba(255, 128, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 128, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Keyboard size={24} color="var(--accent-primary)" />
                        <h2 style={{
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#fff',
                            fontFamily: 'var(--font-ui)'
                        }}>
                            Keyboard Shortcuts
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '20px',
                    overflowY: 'auto',
                    maxHeight: 'calc(80vh - 80px)'
                }}>
                    {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                        <div key={category} style={{ marginBottom: '24px' }}>
                            <h3 style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: 'var(--accent-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '12px',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {categoryLabels[category as keyof typeof categoryLabels]}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {categoryShortcuts.map((shortcut, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 12px',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(255, 255, 255, 0.05)'
                                        }}
                                    >
                                        <span style={{
                                            fontSize: '13px',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'var(--font-ui)'
                                        }}>
                                            {shortcut.description}
                                        </span>
                                        <kbd style={{
                                            padding: '4px 8px',
                                            background: 'rgba(255, 128, 0, 0.1)',
                                            border: '1px solid rgba(255, 128, 0, 0.3)',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: 'var(--accent-primary)',
                                            fontFamily: 'var(--font-mono)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {formatShortcut(shortcut)}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Help shortcut */}
                    <div style={{
                        marginTop: '24px',
                        padding: '12px',
                        background: 'rgba(255, 128, 0, 0.05)',
                        border: '1px solid rgba(255, 128, 0, 0.2)',
                        borderRadius: '4px',
                        textAlign: 'center'
                    }}>
                        <span style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            Press <kbd style={{
                                padding: '2px 6px',
                                background: 'rgba(255, 128, 0, 0.2)',
                                borderRadius: '2px',
                                color: 'var(--accent-primary)',
                                fontWeight: '600'
                            }}>?</kbd> anytime to show this help • <kbd style={{
                                padding: '2px 6px',
                                background: 'rgba(255, 128, 0, 0.2)',
                                borderRadius: '2px',
                                color: 'var(--accent-primary)',
                                fontWeight: '600'
                            }}>ESC</kbd> to close
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default KeyboardShortcutsModal;
