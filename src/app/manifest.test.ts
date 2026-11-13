import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from './manifest';

describe('PWA', () => {
  it('oferece instalação standalone com ícones 192 e 512', () => {
    const value = manifest();
    expect(value.display).toBe('standalone');
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    );
  });
  it('não armazena respostas da API nem navegação privada', () => {
    const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain("event.request.mode === 'navigate'");
    expect(sw).toContain("caches.match('/offline.html')");
    expect(sw).not.toContain('cache.put(');
  });
});
