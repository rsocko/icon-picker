export type { IconSource, ParsedIcon } from './types';
import type { IconSource, ParsedIcon } from './types';

const EMOJI_REGEX = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const PREFIX_REGEX = /^(lucide|mdi|ph|dash|si):(.+)$/;
const BARE_LUCIDE_REGEX = /^[a-z][a-z0-9-]*$/;
const SAFE_ICON_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const HEX_COLOR = /^#?([a-fA-F0-9]{3}|[a-fA-F0-9]{4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/;

/** Parse a stored icon string into a source and provider-specific name. */
export function parseIconValue(value: string | null | undefined): ParsedIcon | null {
  if (!value) return null;

  const prefixMatch = PREFIX_REGEX.exec(value);
  if (prefixMatch?.[1] && prefixMatch[2]) {
    return {
      source: prefixMatch[1] as Exclude<IconSource, 'emoji'>,
      name: prefixMatch[2],
    };
  }

  if (EMOJI_REGEX.test(value)) {
    return { source: 'emoji', name: value };
  }

  if (BARE_LUCIDE_REGEX.test(value)) {
    return { source: 'lucide', name: value };
  }

  // Preserve legacy raw values rather than making stored data unrenderable.
  return { source: 'emoji', name: value };
}

/** Serialize a parsed icon to the portable storage contract. */
export function serializeIconValue(icon: ParsedIcon): string {
  return icon.source === 'emoji' ? icon.name : `${icon.source}:${icon.name}`;
}

function normalizeColor(color: string | undefined): string | null {
  if (!color) return null;
  const match = HEX_COLOR.exec(color);
  return match?.[1] ?? null;
}

/** Return a provider URL for an icon, or null for emoji and unsafe names. */
export function getIconUrl(icon: ParsedIcon, color?: string): string | null {
  if (icon.source === 'emoji' || !SAFE_ICON_NAME.test(icon.name)) {
    return null;
  }

  const normalizedColor = normalizeColor(color);
  const iconifyColor = normalizedColor ? `?color=%23${normalizedColor}` : '';

  switch (icon.source) {
    case 'lucide':
    case 'mdi':
    case 'ph':
      return `https://api.iconify.design/${icon.source}/${icon.name}.svg${iconifyColor}`;
    case 'dash':
      return `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${icon.name}.svg`;
    case 'si':
      return `https://cdn.simpleicons.org/${icon.name}${
        normalizedColor ? `/${normalizedColor}` : ''
      }`;
  }
}
