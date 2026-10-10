import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from './classnames';
import { IconPicker } from './IconPicker';
import { IconRenderer } from './IconRenderer';
import {
  copyIconPickerThemeStyle,
  useResolvedIconPickerTheme,
} from './theme';
import type { IconPickerButtonProps } from './types';

const SIZE_CONFIG = {
  sm: { className: 'rs-icon-picker-trigger--sm', iconSize: 16 },
  md: { className: 'rs-icon-picker-trigger--md', iconSize: 20 },
  lg: { className: 'rs-icon-picker-trigger--lg', iconSize: 28 },
} as const;

const PICKER_WIDTH = 420;
const PICKER_HEIGHT = 520;
const MIN_USABLE_PICKER_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 4;
const useBrowserLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface PickerPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

function calculatePickerPosition(
  rect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
): PickerPosition {
  const width = Math.max(
    1,
    Math.min(PICKER_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2),
  );
  const spaceBelow = Math.max(
    0,
    viewportHeight - rect.bottom - TRIGGER_GAP - VIEWPORT_MARGIN,
  );
  const spaceAbove = Math.max(0, rect.top - TRIGGER_GAP - VIEWPORT_MARGIN);
  const openAbove = spaceBelow < PICKER_HEIGHT && spaceAbove > spaceBelow;
  const viewportHeightLimit = Math.max(1, viewportHeight - VIEWPORT_MARGIN * 2);
  const overlapTrigger =
    Math.max(spaceAbove, spaceBelow) <
    Math.min(MIN_USABLE_PICKER_HEIGHT, viewportHeightLimit);
  const height = overlapTrigger
    ? Math.min(PICKER_HEIGHT, viewportHeightLimit)
    : Math.min(PICKER_HEIGHT, openAbove ? spaceAbove : spaceBelow);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    Math.max(VIEWPORT_MARGIN, viewportWidth - VIEWPORT_MARGIN - width),
  );
  const top = overlapTrigger
    ? VIEWPORT_MARGIN
    : openAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - TRIGGER_GAP - height)
      : Math.min(
          rect.bottom + TRIGGER_GAP,
          Math.max(VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - height),
        );

  return { top, left, width, height };
}

export function IconPickerButton({
  value,
  onChange,
  onOpenChange,
  placeholder,
  size = 'md',
  className,
  disabled = false,
  color,
  pickerColor = color,
  onColorChange,
  label = 'Pick an icon',
  portalTarget,
  pickerProps,
  theme = 'auto',
  style,
}: IconPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const [triggerElement, setTriggerElement] = useState<HTMLButtonElement | null>(
    null,
  );
  const [portalThemeStyle, setPortalThemeStyle] = useState({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const pickerId = `rs-icon-picker-${reactId.replace(/:/g, '')}`;
  const config = SIZE_CONFIG[size];
  const resolvedTheme = useResolvedIconPickerTheme(theme, triggerElement);
  const setTrigger = useCallback((element: HTMLButtonElement | null) => {
    triggerRef.current = element;
    setTriggerElement(element);
  }, []);

  const setOpenAndNotify = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const closePicker = useCallback(
    (restoreFocus: boolean) => {
      setOpenAndNotify(false);
      if (restoreFocus) triggerRef.current?.focus();
    },
    [setOpenAndNotify],
  );

  useBrowserLayoutEffect(() => {
    if (!open) return;
    setPortalThemeStyle(copyIconPickerThemeStyle(triggerElement));

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const next = calculatePickerPosition(
        rect,
        window.innerWidth,
        window.innerHeight,
      );
      setPosition((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    }

    function handleScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && popoverRef.current?.contains(target)) return;
      updatePosition();
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, resolvedTheme, style, triggerElement]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      closePicker(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [closePicker, open]);

  const portalHost =
    typeof document === 'undefined' ? null : (portalTarget ?? document.body);

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        onClick={() => {
          if (!disabled) setOpenAndNotify(!open);
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={pickerId}
        aria-label={label}
        title={label}
        className={cx(
          'rs-icon-picker-trigger',
          config.className,
          className,
        )}
        data-rs-icon-picker-theme={resolvedTheme}
        style={style}
      >
        {value ? (
          <IconRenderer
            value={value}
            size={config.iconSize}
            color={color}
            label=""
          />
        ) : (
          placeholder ?? (
            <span className="rs-icon-picker-trigger__placeholder" aria-hidden="true">
              😀
            </span>
          )
        )}
      </button>

      {open &&
        portalHost &&
        createPortal(
          <div
            ref={popoverRef}
            className="rs-icon-picker-popover"
            data-rs-icon-picker-theme={resolvedTheme}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              ...portalThemeStyle,
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: position?.width ?? PICKER_WIDTH,
              height: position?.height ?? PICKER_HEIGHT,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <IconPicker
              {...pickerProps}
              id={pickerId}
              value={value}
              onChange={(nextValue) => {
                onChange(nextValue);
                closePicker(true);
              }}
              onClose={() => closePicker(true)}
              color={pickerColor}
              onColorChange={onColorChange}
              modal
              theme={resolvedTheme}
            />
          </div>,
          portalHost,
        )}
    </>
  );
}
