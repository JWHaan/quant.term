export const getAdaptiveBookStep = (referencePrice: number): number => {
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) return 0.01;
    if (referencePrice >= 10_000) return 1;
    if (referencePrice >= 1_000) return 0.1;
    if (referencePrice >= 100) return 0.01;
    if (referencePrice >= 1) return 0.001;
    if (referencePrice >= 0.1) return 0.0001;
    if (referencePrice >= 0.01) return 0.00001;
    if (referencePrice >= 0.001) return 0.000001;
    if (referencePrice >= 0.0001) return 0.0000001;
    return 0.00000001;
};
