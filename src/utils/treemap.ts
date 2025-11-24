export interface TreeMapItem {
    id: string;
    label: string;
    value: number;
    change: number;
    category?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
}

export function generateTreeMap(data: TreeMapItem[], width: number, height: number): TreeMapItem[] {
    if (!data || data.length === 0) return [];

    // Sort by value descending
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Simple squarified treemap algorithm implementation
    // This is a simplified version for the demo

    let x = 0;
    let y = 0;
    let w = width;
    // let h = height; // Unused

    const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0);

    return sortedData.map(item => {
        const ratio = item.value / totalValue;
        const itemArea = width * height * ratio;

        // Simple tiling strategy (horizontal strips)
        // In a real implementation, you'd use a proper squarified algorithm
        const itemW = w;
        const itemH = itemArea / w;

        const result = {
            ...item,
            x: x,
            y: y,
            w: itemW,
            h: itemH
        };

        y += itemH;

        return result;
    });
}
