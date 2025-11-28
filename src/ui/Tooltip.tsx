import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="absolute z-50 px-2 py-1 text-xs text-white bg-black rounded shadow-lg -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                    {content}
                    <div className="absolute w-2 h-2 bg-black transform rotate-45 left-1/2 -translate-x-1/2 -bottom-1"></div>
                </div>
            )}
        </div>
    );
};
