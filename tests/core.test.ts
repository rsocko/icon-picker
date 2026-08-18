import { describe, expect, it } from 'vitest';
import { getIconUrl, parseIconValue, serializeIconValue } from '../src/core';

describe('parseIconValue', () => {
  it.each([
    ['lucide:rocket', { source: 'lucide', name: 'rocket' }],
    ['mdi:home', { source: 'mdi', name: 'home' }],
    ['ph:star', { source: 'ph', name: 'star' }],
    ['dash:nextcloud', { source: 'dash', name: 'nextcloud' }],
    ['si:github', { source: 'si', name: 'github' }],
    ['🚀', { source: 'emoji', name: '🚀' }],
    ['rocket', { source: 'lucide', name: 'rocket' }],
  ])('parses %s', (value, expected) => {
    expect(parseIconValue(value)).toEqual(expected);
  });

  it('preserves unknown legacy values as raw emoji-compatible text', () => {
    expect(parseIconValue('Legacy Value')).toEqual({
      source: 'emoji',
      name: 'Legacy Value',
    });
  });

  it.each([null, undefined, ''])('returns null for %s', (value) => {
    expect(parseIconValue(value)).toBeNull();
  });
});

describe('serializeIconValue', () => {
  it('stores emoji without a prefix', () => {
    expect(serializeIconValue({ source: 'emoji', name: '🎯' })).toBe('🎯');
  });

  it('stores provider icons as prefix:name', () => {
    expect(serializeIconValue({ source: 'mdi', name: 'home' })).toBe('mdi:home');
  });
});

describe('getIconUrl', () => {
  it('builds provider URLs and validated color paths', () => {
    expect(getIconUrl({ source: 'lucide', name: 'rocket' }, '#3b82f6')).toBe(
      'https://api.iconify.design/lucide/rocket.svg?color=%233b82f6',
    );
    expect(getIconUrl({ source: 'mdi', name: 'home' })).toBe(
      'https://api.iconify.design/mdi/home.svg',
    );
    expect(getIconUrl({ source: 'ph', name: 'star' }, 'fff')).toBe(
      'https://api.iconify.design/ph/star.svg?color=%23fff',
    );
    expect(getIconUrl({ source: 'dash', name: 'nextcloud' }, '#fff')).toBe(
      'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/nextcloud.svg',
    );
    expect(getIconUrl({ source: 'si', name: 'github' }, '#ffffff')).toBe(
      'https://cdn.simpleicons.org/github/ffffff',
    );
  });

  it.each(['../secret', 'icon?redirect=x', 'icon/name', ' icon', ''])(
    'rejects unsafe icon name %s',
    (name) => {
      expect(getIconUrl({ source: 'lucide', name })).toBeNull();
    },
  );

  it('ignores invalid colors instead of placing them in a URL', () => {
    expect(
      getIconUrl({ source: 'lucide', name: 'rocket' }, '#fff&redirect=evil'),
    ).toBe('https://api.iconify.design/lucide/rocket.svg');
  });

  it('does not construct a URL for emoji', () => {
    expect(getIconUrl({ source: 'emoji', name: '🚀' })).toBeNull();
  });
});
