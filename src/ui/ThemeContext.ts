import { createContext } from 'react';

export interface ThemeContextType {
    theme: string;
    toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    toggleTheme: () => { }
});
