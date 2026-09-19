import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function WorkoutSheet({
  children,
  heading,
  action,
  onClose,
}: {
  children: ReactNode;
  heading: ReactNode;
  action?: ReactNode;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y: number; height: number } | null>(null);
  const manualHeight = useRef<number | null>(null);
  const [height, setHeight] = useState(240);
  const [limits, setLimits] = useState({ min: 140, max: 700 });

  useLayoutEffect(() => {
    const parent = sheet.current?.parentElement;
    parent?.style.setProperty("--workout-sheet-height", `${height}px`);
    return () => {
      parent?.style.removeProperty("--workout-sheet-height");
    };
  }, [height]);

  useLayoutEffect(() => {
    const parent = sheet.current?.parentElement;
    if (!parent || !header.current || !content.current) return;
    const measure = () => {
      const available = parent.clientHeight;
      if (!available) return;
      const max = Math.max(100, available - 90);
      const min = Math.min(max, header.current!.offsetHeight + 48);
      const bottomPadding =
        Number.parseFloat(
          getComputedStyle(content.current!.parentElement!).paddingBottom,
        ) || 0;
      const natural =
        header.current!.offsetHeight + content.current!.scrollHeight + bottomPadding + 2;
      const auto = Math.max(min, Math.min(natural, available * 0.6));
      setLimits({ min, max });
      setHeight(Math.max(min, Math.min(manualHeight.current ?? auto, max)));
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(parent);
    observer?.observe(header.current);
    observer?.observe(content.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  function resize(next: number) {
    const value = Math.max(limits.min, Math.min(next, limits.max));
    manualHeight.current = value;
    setHeight(value);
  }

  return (
    <section
      ref={sheet}
      className="selected-day-panel workout-sheet"
      aria-label="選択日の記録"
      style={{ height }}
    >
      <div ref={header} className="sheet-header">
        <div
          className="sheet-handle"
          role="slider"
          tabIndex={0}
          aria-label="一覧の高さ"
          aria-orientation="vertical"
          aria-valuemin={Math.round(limits.min)}
          aria-valuemax={Math.round(limits.max)}
          aria-valuenow={Math.round(height)}
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current) return;
            drag.current = { id: event.pointerId, y: event.clientY, height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (drag.current?.id === event.pointerId)
              resize(drag.current.height + drag.current.y - event.clientY);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowUp"
                ? height + 40
                : event.key === "ArrowDown"
                  ? height - 40
                  : event.key === "Home"
                    ? limits.min
                    : event.key === "End"
                      ? limits.max
                      : null;
            if (next !== null) {
              event.preventDefault();
              resize(next);
            }
          }}
        >
          <span />
        </div>
        <div className="selected-day-heading">
          <div className="sheet-date-row">
            {heading}
            <button
              className="sheet-close button-icon"
              type="button"
              aria-label="一覧を閉じる"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          {action}
        </div>
      </div>
      <div className="sheet-scroll">
        <div ref={content}>{children}</div>
      </div>
    </section>
  );
}
