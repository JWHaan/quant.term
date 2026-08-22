import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSyntheticBtcFixture } from '@/backtest/fixture';
import type { BacktestDataset } from '@/backtest/types';

type JsonSchemaProperty = {
    type?: string;
    pattern?: string;
    minimum?: number;
    enum?: string[];
};

const schema = JSON.parse(
    readFileSync(resolve(process.cwd(), 'schemas/backtest-v1.schema.json'), 'utf8'),
) as { properties: { dataset: { required: string[]; properties: Record<string, JsonSchemaProperty> } } };

const datasetSchema = schema.properties.dataset;

describe('backtest-v1 schema lockstep (dataset widening)', () => {
    it('requires intervalSeconds and fetchedAt on the dataset object', () => {
        expect(datasetSchema.required).toContain('intervalSeconds');
        expect(datasetSchema.required).toContain('fetchedAt');
        expect(datasetSchema.properties.intervalSeconds).toMatchObject({
            type: 'integer',
            minimum: 60,
        });
        expect(datasetSchema.properties.fetchedAt).toMatchObject({
            type: 'number',
            minimum: 0,
        });
    });

    it('widens symbol beyond BTCUSDT with a Binance pair-shaped pattern', () => {
        expect(datasetSchema.properties.symbol?.pattern).toBe('^[A-Z0-9]{5,20}$');
        expect('BTCUSDT').toMatch(new RegExp(datasetSchema.properties.symbol!.pattern!));
    });

    it('widens interval to the Binance spot interval enum', () => {
        expect(datasetSchema.properties.interval?.enum).toEqual([
            '1m', '3m', '5m', '15m', '30m',
            '1h', '2h', '4h', '6h', '12h',
            '1d', '3d', '1w', '1M',
        ]);
    });

    it('widens source to SYNTHETIC_FIXTURE | BINANCE_REST', () => {
        expect(datasetSchema.properties.source?.enum).toEqual([
            'SYNTHETIC_FIXTURE',
            'BINANCE_REST',
        ]);
    });

    it('keeps the bundled fixture dataset shape-aligned with the schema', () => {
        const fixture = createSyntheticBtcFixture();
        const fixtureDataset: BacktestDataset = fixture.dataset;

        expect(Object.keys(fixtureDataset).sort()).toEqual(
            Object.keys(datasetSchema.properties).sort(),
        );
        expect(datasetSchema.required.every((key) => key in fixtureDataset)).toBe(true);
        expect(fixtureDataset.intervalSeconds).toBe(60);
        expect(fixtureDataset.fetchedAt).toBe(0);
    });
});
