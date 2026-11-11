import React, { useEffect, useState } from 'react';
import { ThemeContext } from './ThemeContext';

interface ThemeProviderProps {
    children: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => {
        if (prev === 'dark') return 'light';
        return 'dark';
    });

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeProvider;
