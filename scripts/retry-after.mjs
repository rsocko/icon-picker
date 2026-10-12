const maximumRetryDelayMilliseconds = 60_000;

function clampDelay(milliseconds) {
  return Math.min(
    maximumRetryDelayMilliseconds,
    Math.max(0, Math.ceil(milliseconds)),
  );
}

export async function getRetryDelayMilliseconds(response, now = Date.now()) {
  const retryAfter = response.headers.get('retry-after')?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return clampDelay(seconds * 1_000);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return clampDelay(retryAt - now);
    }
  }

  if (response.status === 429 || response.status === 503) {
    const body = await response.clone().text();
    const match = /"retry_after"\s*:\s*(\d+(?:\.\d+)?)/.exec(body);
    if (match?.[1]) {
      return clampDelay(Number(match[1]) * 1_000);
    }
  }

  return null;
}
