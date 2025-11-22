/**
 * Simple TreeMap Layout Algorithm
 * Based on Squarified Treemap
 */

export function generateTreeMap(data, width, height) {
    if (!data || data.length === 0) return [];

    // Sort by value descending
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Calculate total value
    const totalValue = sortedData.reduce((sum, item) => sum + item.value, 0);

    // Normalize values to area
    const totalArea = width * height;
    const items = sortedData.map(item => ({
        ...item,
        area: (item.value / totalValue) * totalArea
    }));

    const result = [];
    squarify(items, [], { x: 0, y: 0, width, height }, result);

    return result;
}

function squarify(children, row, rect, result) {
    if (children.length === 0) {
        if (row.length > 0) layoutRow(row, rect, result);
        return;
    }

    const child = children[0];
    const newRow = [...row, child];

    if (row.length === 0) {
        squarify(children.slice(1), newRow, rect, result);
        return;
    }

    const worst1 = worst(row, Math.min(rect.width, rect.height));
    const worst2 = worst(newRow, Math.min(rect.width, rect.height));

    if (worst2 <= worst1) {
        squarify(children.slice(1), newRow, rect, result);
    } else {
        const remainingRect = layoutRow(row, rect, result);
        squarify(children, [], remainingRect, result);
    }
}

function layoutRow(row, rect, result) {
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const side = Math.min(rect.width, rect.height);
    const otherSide = rowArea / side;

    const isHorizontal = rect.width >= rect.height;

    let currentPos = 0;

    row.forEach(item => {
        const itemSide = item.area / otherSide;

        if (isHorizontal) {
            // Row is vertical column
            result.push({
                ...item,
                x: rect.x,
                y: rect.y + currentPos,
                w: otherSide,
                h: itemSide
            });
        } else {
            // Row is horizontal row
            result.push({
                ...item,
                x: rect.x + currentPos,
                y: rect.y,
                w: itemSide,
                h: otherSide
            });
        }
        currentPos += itemSide;
    });

    if (isHorizontal) {
        return {
            x: rect.x + otherSide,
            y: rect.y,
            width: rect.width - otherSide,
            height: rect.height
        };
    } else {
        return {
            x: rect.x,
            y: rect.y + otherSide,
            width: rect.width,
            height: rect.height - otherSide
        };
    }
}

function worst(row, side) {
    if (row.length === 0) return Infinity;

    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const otherSide = rowArea / side;

    let min = Infinity;
    let max = -Infinity;

    row.forEach(item => {
        const itemSide = item.area / otherSide;
        if (itemSide < min) min = itemSide;
        if (itemSide > max) max = itemSide;
    });

    const ratio1 = (otherSide * otherSide) * max / (rowArea * rowArea); // Simplified aspect ratio check
    // Actually, standard formula is max(w/h, h/w)
    // Here: item w = otherSide, h = itemSide (or vice versa)
    // Aspect ratio = max(otherSide/itemSide, itemSide/otherSide)

    let maxAspectRatio = 0;
    row.forEach(item => {
        const itemSide = item.area / otherSide;
        const ar = Math.max(otherSide / itemSide, itemSide / otherSide);
        if (ar > maxAspectRatio) maxAspectRatio = ar;
    });

    return maxAspectRatio;
}
