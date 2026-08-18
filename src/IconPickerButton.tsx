import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from './classnames';
import { IconPicker } from './IconPicker';
import { IconRenderer } from './IconRenderer';
import type { IconPickerButtonProps } from './types';

const SIZE_CONFIG = {
  sm: { className: 'rs-icon-picker-trigger--sm', iconSize: 16 },
  md: { className: 'rs-icon-picker-trigger--md', iconSize: 20 },
  lg: { className: 'rs-icon-picker-trigger--lg', iconSize: 28 },
} as const;

export function IconPickerButton({
  value,
  onChange,
  onOpenChange,
  placeholder,
  size = 'md',
  className,
  disabled = false,
  color,
  onColorChange,
  label = 'Pick an icon',
  portalTarget,
  pickerProps,
}: IconPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const pickerId = `rs-icon-picker-${reactId.replace(/:/g, '')}`;
  const config = SIZE_CONFIG[size];

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

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const pickerWidth = Math.min(420, window.innerWidth - 16);
      const pickerHeight = Math.min(520, window.innerHeight - 16);
      const openAbove =
        window.innerHeight - rect.bottom - 8 < pickerHeight &&
        rect.top > pickerHeight;
      setPosition({
        top: openAbove
          ? Math.max(8, rect.top - pickerHeight - 4)
          : Math.min(window.innerHeight - pickerHeight - 8, rect.bottom + 4),
        left: Math.min(
          Math.max(8, rect.left),
          Math.max(8, window.innerWidth - pickerWidth - 8),
        ),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

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
        ref={triggerRef}
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
            style={{ top: position.top, left: position.left }}
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
              color={color}
              onColorChange={onColorChange}
              modal
            />
          </div>,
          portalHost,
        )}
    </>
  );
}
