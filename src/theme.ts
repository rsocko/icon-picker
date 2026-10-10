import { useEffect, useLayoutEffect, useState } from 'react';
import type {
  IconPickerCssVariable,
  IconPickerStyle,
  IconPickerTheme,
} from './types';

const ICON_PICKER_CSS_VARIABLES: IconPickerCssVariable[] = [
  '--rs-icon-picker-bg',
  '--rs-icon-picker-surface',
  '--rs-icon-picker-surface-hover',
  '--rs-icon-picker-border',
  '--rs-icon-picker-text',
  '--rs-icon-picker-muted',
  '--rs-icon-picker-accent',
  '--rs-icon-picker-shadow',
  '--rs-icon-picker-notice-bg',
  '--rs-icon-picker-notice-text',
];

const useBrowserLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

function preferredTheme(): Exclude<IconPickerTheme, 'auto'> {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveIconPickerTheme(
  theme: IconPickerTheme,
  element: HTMLElement | null,
): Exclude<IconPickerTheme, 'auto'> {
  if (theme !== 'auto') return theme;

  let ancestor = element?.parentElement ?? null;
  while (ancestor) {
    const declaredTheme = ancestor.dataset.theme;
    if (declaredTheme === 'dark' || declaredTheme === 'light') {
      return declaredTheme;
    }
    if (ancestor.classList.contains('dark')) return 'dark';

    const schemes = getComputedStyle(ancestor).colorScheme
      .split(/\s+/)
      .filter(Boolean);
    if (schemes.length === 1 && schemes[0] === 'dark') return 'dark';
    if (schemes.length === 1 && schemes[0] === 'light') return 'light';
    ancestor = ancestor.parentElement;
  }

  return preferredTheme();
}

export function useResolvedIconPickerTheme(
  theme: IconPickerTheme,
  element: HTMLElement | null,
): Exclude<IconPickerTheme, 'auto'> {
  const [resolvedTheme, setResolvedTheme] = useState<
    Exclude<IconPickerTheme, 'auto'>
  >(theme === 'dark' ? 'dark' : 'light');

  useBrowserLayoutEffect(() => {
    const updateTheme = () =>
      setResolvedTheme(resolveIconPickerTheme(theme, element));
    updateTheme();

    if (theme !== 'auto' || typeof window === 'undefined') return;

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', updateTheme);

    const observers: MutationObserver[] = [];
    let ancestor = element?.parentElement ?? null;
    while (ancestor) {
      const observer = new MutationObserver(updateTheme);
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme'],
      });
      observers.push(observer);
      ancestor = ancestor.parentElement;
    }

    return () => {
      media?.removeEventListener('change', updateTheme);
      for (const observer of observers) observer.disconnect();
    };
  }, [element, theme]);

  return resolvedTheme;
}

export function copyIconPickerThemeStyle(
  element: HTMLElement | null,
): IconPickerStyle {
  if (!element || typeof window === 'undefined') return {};

  const inheritedStyle: IconPickerStyle = {};
  for (const property of ICON_PICKER_CSS_VARIABLES) {
    let current: HTMLElement | null = element;
    while (current) {
      const value = getComputedStyle(current).getPropertyValue(property).trim();
      if (value) {
        inheritedStyle[property] = value;
        break;
      }
      current = current.parentElement;
    }
  }

  return inheritedStyle;
}
