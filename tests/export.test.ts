import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getIconExportFilename,
  getIconReactCode,
  getIconSvg,
  IconExportError,
} from '../src/export';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('icon export utilities', () => {
  it('fetches and validates provider SVG markup', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('<svg viewBox="0 0 24 24"></svg>'),
    } as unknown as Response);

    await expect(
      getIconSvg({ source: 'lucide', name: 'rocket' }, '#3b82f6'),
    ).resolves.toBe('<svg viewBox="0 0 24 24"></svg>');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.iconify.design/lucide/rocket.svg?color=%233b82f6',
      undefined,
    );
  });

  it('rejects emoji and invalid provider responses as explicit export errors', async () => {
    await expect(getIconSvg({ source: 'emoji', name: '🚀' })).rejects.toMatchObject({
      code: 'unsupported',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('<html>not an icon</html>'),
    } as unknown as Response);
    await expect(
      getIconSvg({ source: 'mdi', name: 'home' }),
    ).rejects.toEqual(
      new IconExportError('The icon provider returned invalid SVG data.', 'invalid-svg'),
    );
  });

  it('creates safe filenames and package-oriented React markup', () => {
    expect(
      getIconExportFilename({ source: 'mdi', name: 'alert/circle' }, 'png'),
    ).toBe('mdi-alert-circle.png');
    expect(
      getIconReactCode({ source: 'lucide', name: 'rocket' }, '#10b981', 32),
    ).toBe(
      '<IconRenderer value="lucide:rocket" size={32} color="#10b981" />',
    );
    expect(getIconReactCode({ source: 'emoji', name: '🚀' })).toContain(
      'role="img"',
    );
  });
});
