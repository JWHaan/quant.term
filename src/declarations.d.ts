declare module '*.jsx' {
    const content: any;
    export default content;
}

declare module './components/DashboardPanel';
declare module './components/LoadingSpinner';
declare module './components/PanelErrorBoundary';
declare module './components/ThemeProvider';
declare module './components/ErrorBoundary';

declare module './components/PerformancePanel';
declare module './components/QuantSignalEngine';

declare module '*?worker' {
    const workerConstructor: {
        new(): Worker;
    };
    export default workerConstructor;
}
