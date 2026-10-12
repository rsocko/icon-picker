import { describe, expect, it } from 'vitest';

import { getRetryDelayMilliseconds } from '../scripts/retry-after.mjs';

const now = Date.parse('2026-10-12T00:00:00Z');

describe('getRetryDelayMilliseconds', () => {
  it('parses delay-seconds headers', async () => {
    const response = new Response('', {
      status: 429,
      headers: { 'retry-after': '30' },
    });

    await expect(getRetryDelayMilliseconds(response, now)).resolves.toBe(30_000);
  });

  it('parses HTTP-date headers', async () => {
    const response = new Response('', {
      status: 503,
      headers: { 'retry-after': 'Sun, 12 Oct 2026 00:00:45 GMT' },
    });

    await expect(getRetryDelayMilliseconds(response, now)).resolves.toBe(45_000);
  });

  it('parses Cloudflare JSON retry hints', async () => {
    const response = new Response(JSON.stringify({ retry_after: 30 }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });

    await expect(getRetryDelayMilliseconds(response, now)).resolves.toBe(30_000);
  });

  it('caps server-directed waits', async () => {
    const response = new Response('', {
      status: 429,
      headers: { 'retry-after': '120' },
    });

    await expect(getRetryDelayMilliseconds(response, now)).resolves.toBe(60_000);
  });

  it('returns null without a server retry hint', async () => {
    const response = new Response('', { status: 500 });

    await expect(getRetryDelayMilliseconds(response, now)).resolves.toBeNull();
  });
});
