import { memo, useState } from 'react';
import { getIconUrl, parseIconValue } from './core';
import { cx } from './classnames';
import type { IconRendererProps } from './types';

export const IconRenderer = memo(function IconRenderer({
  value,
  size = 20,
  color,
  className,
  label,
  fallback = null,
}: IconRendererProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const parsed = parseIconValue(value);
  const renderedSize = Number.isFinite(size) && size > 0 ? size : 20;

  if (!parsed) return <>{fallback}</>;

  const accessibleLabel =
    label === undefined
      ? parsed.source === 'emoji'
        ? `Emoji: ${parsed.name}`
        : `${parsed.source} icon: ${parsed.name}`
      : label;

  if (parsed.source === 'emoji') {
    return (
      <span
        className={cx('rs-icon-picker__renderer-emoji', className)}
        style={{
          fontSize: renderedSize * 0.85,
          width: renderedSize,
          height: renderedSize,
        }}
        role={accessibleLabel ? 'img' : undefined}
        aria-label={accessibleLabel || undefined}
        aria-hidden={accessibleLabel ? undefined : true}
      >
        {parsed.name}
      </span>
    );
  }

  const url = getIconUrl(parsed, color);
  if (!url || failedUrl === url) return <>{fallback}</>;

  return (
    <img
      src={url}
      alt={accessibleLabel}
      aria-hidden={accessibleLabel ? undefined : true}
      width={renderedSize}
      height={renderedSize}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cx(
        'rs-icon-picker__renderer-image',
        !color &&
          (parsed.source === 'lucide' ||
            parsed.source === 'mdi' ||
            parsed.source === 'ph') &&
          'rs-icon-picker__renderer-image--adaptive',
        className,
      )}
      style={{ width: renderedSize, height: renderedSize }}
      onError={() => setFailedUrl(url)}
    />
  );
});
