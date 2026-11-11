import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appStyles = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('nested resizable panel handles', () => {
    it('targets orientation on each handle instead of every nested descendant', () => {
        expect(appStyles).toMatch(/\.resize-handle\[aria-orientation='horizontal'\]/);
        expect(appStyles).toMatch(/\.resize-handle\[aria-orientation='vertical'\]/);
        expect(appStyles).not.toMatch(/\[aria-orientation='(horizontal|vertical)'\]\s+\.resize-handle/);
    });
});
