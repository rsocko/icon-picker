import { getIconUrl, serializeIconValue } from './core';
import type { ParsedIcon } from './types';

const SVG_ROOT = /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i;
const HEX_COLOR = /^#?(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/;
const MAX_SVG_LENGTH = 200_000;
const MAX_PNG_SIZE = 2048;

export type IconExportFormat = 'svg' | 'png';

export interface IconPngOptions {
  /** Output width and height in CSS pixels. */
  size?: number;
  /** Empty space inside the output bounds in CSS pixels. */
  padding?: number;
  /** Transparent, or a hexadecimal background color. */
  background?: string;
  /** Optional hexadecimal icon color for providers that support tinting. */
  color?: string;
}

export class IconExportError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported'
      | 'invalid-option'
      | 'fetch-failed'
      | 'invalid-svg'
      | 'render-failed'
      | 'clipboard-unavailable',
  ) {
    super(message);
    this.name = 'IconExportError';
  }
}

function assertHexColor(value: string, label: string): void {
  if (!HEX_COLOR.test(value)) {
    throw new IconExportError(
      `${label} must be a 3-, 4-, 6-, or 8-digit hexadecimal color.`,
      'invalid-option',
    );
  }
}

function normalizePngOptions(options: IconPngOptions) {
  const size = options.size ?? 128;
  const padding = options.padding ?? 12;
  const background = options.background ?? 'transparent';

  if (!Number.isInteger(size) || size < 1 || size > MAX_PNG_SIZE) {
    throw new IconExportError(
      `PNG size must be an integer from 1 to ${MAX_PNG_SIZE}.`,
      'invalid-option',
    );
  }
  if (!Number.isInteger(padding) || padding < 0 || padding * 2 >= size) {
    throw new IconExportError(
      'PNG padding must be a non-negative integer smaller than half the image size.',
      'invalid-option',
    );
  }
  if (background !== 'transparent') assertHexColor(background, 'Background');
  if (options.color) assertHexColor(options.color, 'Icon color');

  return { size, padding, background, color: options.color };
}

function safeFilenamePart(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96) || 'icon'
  );
}

/** Return a stable, filesystem-safe filename for an exported icon. */
export function getIconExportFilename(
  icon: ParsedIcon,
  format: IconExportFormat,
): string {
  return `${icon.source}-${safeFilenamePart(icon.name)}.${format}`;
}

/** Fetch and validate SVG markup for a vector icon provider. */
export async function getIconSvg(
  icon: ParsedIcon,
  color?: string,
  signal?: AbortSignal,
): Promise<string> {
  if (icon.source === 'emoji') {
    throw new IconExportError('Emoji do not have a provider SVG.', 'unsupported');
  }

  const url = getIconUrl(icon, color);
  if (!url) {
    throw new IconExportError('This icon cannot be exported as SVG.', 'unsupported');
  }

  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new IconExportError(
      `The icon provider returned HTTP ${response.status}.`,
      'fetch-failed',
    );
  }

  const svg = await response.text();
  if (svg.length > MAX_SVG_LENGTH || !SVG_ROOT.test(svg)) {
    throw new IconExportError(
      'The icon provider returned invalid SVG data.',
      'invalid-svg',
    );
  }
  return svg;
}

function loadImage(source: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const abort = () => {
      image.src = '';
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      signal?.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => {
      signal?.removeEventListener('abort', abort);
      reject(new IconExportError('The icon image could not be rendered.', 'render-failed'));
    };
    image.src = source;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else {
        reject(
          new IconExportError('The browser could not create a PNG image.', 'render-failed'),
        );
      }
    }, 'image/png');
  });
}

/** Render a provider icon or platform emoji glyph to a PNG blob. */
export async function renderIconPng(
  icon: ParsedIcon,
  options: IconPngOptions = {},
  signal?: AbortSignal,
): Promise<Blob> {
  const { size, padding, background, color } = normalizePngOptions(options);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new IconExportError('Canvas rendering is unavailable.', 'render-failed');
  }

  if (background !== 'transparent') {
    context.fillStyle = background.startsWith('#') ? background : `#${background}`;
    context.fillRect(0, 0, size, size);
  }

  const contentSize = size - padding * 2;
  if (icon.source === 'emoji') {
    context.font = `${Math.floor(contentSize * 0.82)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon.name, size / 2, size / 2);
    return canvasToPng(canvas);
  }

  const svg = await getIconSvg(icon, color, signal);
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = await loadImage(objectUrl, signal);
    context.drawImage(image, padding, padding, contentSize, contentSize);
    return await canvasToPng(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Copy a rendered PNG to the system clipboard. */
export async function copyIconPng(
  icon: ParsedIcon,
  options: IconPngOptions = {},
  signal?: AbortSignal,
): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new IconExportError(
      'This browser does not support copying PNG images.',
      'clipboard-unavailable',
    );
  }
  signal?.throwIfAborted();
  const png = renderIconPng(icon, options, signal);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/** Download an icon as SVG or PNG using a browser-generated object URL. */
export async function downloadIcon(
  icon: ParsedIcon,
  format: IconExportFormat,
  options: IconPngOptions = {},
  signal?: AbortSignal,
): Promise<void> {
  const blob =
    format === 'svg'
      ? new Blob([await getIconSvg(icon, options.color, signal)], {
          type: 'image/svg+xml',
        })
      : await renderIconPng(icon, options, signal);
  const objectUrl = URL.createObjectURL(blob);
  try {
    signal?.throwIfAborted();
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = getIconExportFilename(icon, format);
    link.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Return package-oriented React markup for an icon. */
export function getIconReactCode(
  icon: ParsedIcon,
  color = '#ffffff',
  size = 24,
): string {
  if (icon.source === 'emoji') {
    return `<span role="img" aria-label="${icon.name}">${icon.name}</span>`;
  }
  return `<IconRenderer value="${serializeIconValue(icon)}" size={${size}} color="${color}" />`;
}
