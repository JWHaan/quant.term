import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appStyles = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('nested resizable panel handles', () => {
    it('targets orientation on each handle instead of every nested descendant', () => {
        expect(appStyles).toMatch(/\.resize-handle\[data-panel-group-direction='vertical'\]/);
        expect(appStyles).toMatch(/\.resize-handle\[data-panel-group-direction='horizontal'\]/);
        expect(appStyles).not.toMatch(/\[data-panel-group-direction='vertical'\]\s+\.resize-handle/);
        expect(appStyles).not.toMatch(/\[data-panel-group-direction='horizontal'\]\s+\.resize-handle/);
    });
});
