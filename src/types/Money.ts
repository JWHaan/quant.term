/**
 * Money Type - High-precision decimal arithmetic for financial calculations
 * 
 * Uses decimal.js to eliminate floating-point errors in price/volume calculations.
 * All monetary values (prices, volumes, P&L) should use this type.
 * 
 * @example
 * ```typescript
 * const price = Money.from("45123.456789");
 * const quantity = Money.from("1.5");
 * const total = Money.multiply(price, quantity);
 * console.log(Money.toString(total, 2)); // "67685.19"
 * ```
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({
    precision: 20,        // 20 significant digits
    rounding: Decimal.ROUND_HALF_UP,
    toExpNeg: -9,         // Use exponential notation for numbers < 1e-9
    toExpPos: 20,         // Use exponential notation for numbers > 1e20
    minE: -9,
    maxE: 20
});

/**
 * Money type - alias for Decimal with financial semantics
 */
export type Money = Decimal;

/**
 * Money utility functions for common operations
 */
export const Money = {
    /**
     * Create Money from number or string
     * @param value - Numeric value (string preferred for precision)
     * @returns Money instance
     */
    from: (value: number | string | Decimal): Money => {
        if (value instanceof Decimal) return value;
        return new Decimal(value);
    },

    /**
     * Create zero value
     */
    zero: (): Money => new Decimal(0),

    /**
     * Create one value
     */
    one: (): Money => new Decimal(1),

    /**
     * Add two Money values
     */
    add: (a: Money, b: Money): Money => a.plus(b),

    /**
     * Subtract b from a
     */
    subtract: (a: Money, b: Money): Money => a.minus(b),

    /**
     * Multiply two Money values
     */
    multiply: (a: Money, b: Money): Money => a.times(b),

    /**
     * Divide a by b
     * @throws Error if b is zero
     */
    divide: (a: Money, b: Money): Money => {
        if (b.isZero()) {
            throw new Error('Division by zero');
        }
        return a.dividedBy(b);
    },

    /**
     * Raise a to power of b
     */
    pow: (a: Money, b: number): Money => a.pow(b),

    /**
     * Get absolute value
     */
    abs: (a: Money): Money => a.abs(),

    /**
     * Get negative value
     */
    negate: (a: Money): Money => a.negated(),

    /**
     * Round to specified decimal places
     */
    round: (a: Money, decimals: number = 2): Money => {
        return a.toDecimalPlaces(decimals);
    },

    /**
     * Compare two Money values
     * @returns -1 if a < b, 0 if a === b, 1 if a > b
     */
    compare: (a: Money, b: Money): number => a.comparedTo(b),

    /**
     * Check if a equals b
     */
    equals: (a: Money, b: Money): boolean => a.equals(b),

    /**
     * Check if a is greater than b
     */
    greaterThan: (a: Money, b: Money): boolean => a.greaterThan(b),

    /**
     * Check if a is less than b
     */
    lessThan: (a: Money, b: Money): boolean => a.lessThan(b),

    /**
     * Check if value is zero
     */
    isZero: (a: Money): boolean => a.isZero(),

    /**
     * Check if value is positive
     */
    isPositive: (a: Money): boolean => a.greaterThan(0),

    /**
     * Check if value is negative
     */
    isNegative: (a: Money): boolean => a.lessThan(0),

    /**
     * Get minimum of two values
     */
    min: (a: Money, b: Money): Money => Decimal.min(a, b),

    /**
     * Get maximum of two values
     */
    max: (a: Money, b: Money): Money => Decimal.max(a, b),

    /**
     * Convert to JavaScript number (use sparingly, only for display)
     * @warning May lose precision for very large or very small numbers
     */
    toNumber: (m: Money): number => m.toNumber(),

    /**
     * Convert to string with optional decimal places
     * @param m - Money value
     * @param decimals - Number of decimal places (undefined = full precision)
     */
    toString: (m: Money, decimals?: number): string => {
        return decimals !== undefined ? m.toFixed(decimals) : m.toString();
    },

    /**
     * Parse from string, returns null if invalid
     */
    tryParse: (value: string): Money | null => {
        try {
            const decimal = new Decimal(value);
            return decimal.isFinite() ? decimal : null;
        } catch {
            return null;
        }
    },

    /**
     * Check if value is valid Money
     */
    isValid: (value: unknown): value is Money => {
        return value instanceof Decimal && value.isFinite();
    },

    /**
     * Calculate percentage change
     * @param oldValue - Original value
     * @param newValue - New value
     * @returns Percentage change (e.g., 0.05 for 5% increase)
     */
    percentageChange: (oldValue: Money, newValue: Money): Money => {
        if (oldValue.isZero()) {
            return Money.zero();
        }
        return newValue.minus(oldValue).dividedBy(oldValue);
    },

    /**
     * Apply percentage to value
     * @param value - Base value
     * @param percentage - Percentage as decimal (e.g., 0.05 for 5%)
     * @returns value * (1 + percentage)
     */
    applyPercentage: (value: Money, percentage: Money): Money => {
        return value.times(Money.one().plus(percentage));
    },

    /**
     * Calculate weighted average
     * @param values - Array of [value, weight] pairs
     * @returns Weighted average
     */
    weightedAverage: (values: Array<[Money, Money]>): Money => {
        if (values.length === 0) return Money.zero();

        let sumWeightedValues = Money.zero();
        let sumWeights = Money.zero();

        for (const [value, weight] of values) {
            sumWeightedValues = sumWeightedValues.plus(value.times(weight));
            sumWeights = sumWeights.plus(weight);
        }

        if (sumWeights.isZero()) return Money.zero();
        return sumWeightedValues.dividedBy(sumWeights);
    }
};

/**
 * Type guard to check if value is Money
 */
export function isMoney(value: unknown): value is Money {
    return value instanceof Decimal;
}

/**
 * Serialize Money for JSON storage
 */
export function serializeMoney(value: Money): string {
    return value.toString();
}

/**
 * Deserialize Money from JSON storage
 */
export function deserializeMoney(value: string): Money {
    return Money.from(value);
}
