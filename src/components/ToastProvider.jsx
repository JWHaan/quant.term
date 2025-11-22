import { Toaster } from 'react-hot-toast';

/**
 * ToastProvider - Global toast notification system
 * For displaying API errors, success messages, and user feedback
 */
export const ToastProvider = () => {
    return (
        <Toaster
            position="bottom-right"
            toastOptions={{
                duration: 4000,
                style: {
                    background: 'rgba(20, 20, 30, 0.95)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-ui)'
                },
                success: {
                    iconTheme: {
                        primary: 'var(--accent-primary)',
                        secondary: '#000',
                    },
                },
                error: {
                    iconTheme: {
                        primary: 'var(--accent-danger)',
                        secondary: '#000',
                    },
                    duration: 6000,
                },
            }}
        />
    );
};

export default ToastProvider;
