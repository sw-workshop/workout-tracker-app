import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import {
  buildMonthCalendar,
  formatMonthTitle,
  formatStorageDate,
  isSameMonth,
} from "./dateUtils";
import type { WorkoutRecord } from "./types";

const weekDays = ["月", "火", "水", "木", "金", "土", "日"];
const swipeThreshold = 50;
const edgeWidth = 24;
const directionRatio = 1.2;
const transitionDuration = 180;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  tracking: boolean;
};

type TransitionDirection = -1 | 0 | 1;

type CalendarCarouselProps = {
  visibleMonth: Date;
  selectedDateKey: string;
  todayKey: string;
  recordsByDate: Record<string, WorkoutRecord[]>;
  onSelectDate: (date: Date) => void;
  onMoveMonth: (monthOffset: number) => void;
};

function monthWithOffset(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}

export function CalendarCarousel({
  visibleMonth,
  selectedDateKey,
  todayKey,
  recordsByDate,
  onSelectDate,
  onMoveMonth,
}: CalendarCarouselProps) {
  const drag = useRef<DragState | null>(null);
  const pendingDirection = useRef<TransitionDirection>(0);
  const transitionTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(0);
  const months = useMemo(
    () => [-1, 0, 1].map((offset) => monthWithOffset(visibleMonth, offset)),
    [visibleMonth],
  );
  const trackTransform = `translate3d(calc(-33.333333% + ${dragOffset}px), 0, 0)`;

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }
    };
  }, []);

  function completeTransition() {
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
    const direction = pendingDirection.current;
    pendingDirection.current = 0;
    setTransitionDirection(0);
    setTransitioning(false);
    setDragOffset(0);
    if (direction !== 0) onMoveMonth(direction);
  }

  function settle(direction: TransitionDirection, width: number) {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDragOffset(0);
      if (direction !== 0) onMoveMonth(direction);
      return;
    }
    pendingDirection.current = direction;
    setTransitionDirection(direction);
    setTransitioning(true);
    setDragOffset(direction === 1 ? -width : direction === -1 ? width : 0);
    transitionTimer.current = window.setTimeout(
      completeTransition,
      transitionDuration + 80,
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || transitioning) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    if (
      bounds.width <= edgeWidth * 2 ||
      localX <= edgeWidth ||
      localX >= bounds.width - edgeWidth
    ) {
      drag.current = null;
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      tracking: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    const horizontal = event.clientX - current.startX;
    const vertical = event.clientY - current.startY;
    if (!current.tracking) {
      if (Math.abs(vertical) > 8 && Math.abs(vertical) >= Math.abs(horizontal)) {
        drag.current = null;
        return;
      }
      if (
        Math.abs(horizontal) < 8 ||
        Math.abs(horizontal) < Math.abs(vertical) * directionRatio
      ) {
        return;
      }
      current.tracking = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDragOffset(Math.max(-current.width, Math.min(horizontal, current.width)));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    drag.current = null;
    if (current?.pointerId !== event.pointerId || !current.tracking) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const horizontal = event.clientX - current.startX;
    settle(
      Math.abs(horizontal) < swipeThreshold ? 0 : horizontal < 0 ? 1 : -1,
      current.width,
    );
  }

  return (
    <section
      className="month-carousel"
      aria-label={`${formatMonthTitle(visibleMonth)}のカレンダー`}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onMoveMonth(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onMoveMonth(1);
        }
      }}
    >
      <div className="calendar-week-viewport">
        <div
          className={`calendar-week-track${transitioning ? " is-animating" : ""}`}
          style={{ transform: trackTransform }}
        >
          {months.map((month, monthIndex) => (
            <div
              className="calendar-week-header"
              key={formatStorageDate(month)}
              aria-hidden={monthIndex === 1 ? undefined : true}
            >
              {weekDays.map((weekDay) => (
                <div className="week-day" key={weekDay}>
                  {weekDay}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div
        className="month-viewport"
        data-transition={
          transitionDirection === 1
            ? "next"
            : transitionDirection === -1
              ? "previous"
              : "none"
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          const wasTracking = drag.current.tracking;
          const width = drag.current.width;
          drag.current = null;
          if (wasTracking) settle(0, width);
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }}
      >
        <div
          className={`month-track${transitioning ? " is-animating" : ""}`}
          style={{ transform: trackTransform }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget) completeTransition();
          }}
        >
          {months.map((month, monthIndex) => {
            const interactive = monthIndex === 1;
            return (
              <div
                className="month-grid"
                key={formatStorageDate(month)}
                aria-hidden={interactive ? undefined : true}
              >
                {buildMonthCalendar(month).map((date) => {
                  const dateKey = formatStorageDate(date);
                  const records = recordsByDate[dateKey] ?? [];
                  const className = [
                    "day-cell",
                    date.getDay() === 6 ? "saturday" : "",
                    date.getDay() === 0 ? "sunday" : "",
                    isSameMonth(date, month) ? "" : "outside-month",
                    dateKey === selectedDateKey ? "selected" : "",
                    dateKey === todayKey ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const content = (
                    <>
                      <span className="day-number">{date.getDate()}</span>
                      <span className="record-stack">
                        {records.slice(0, 2).map((record) => (
                          <span className="record-chip" key={record.id}>
                            {record.exerciseName}
                          </span>
                        ))}
                      </span>
                    </>
                  );
                  return interactive ? (
                    <button
                      className={className}
                      type="button"
                      key={dateKey}
                      onClick={() => onSelectDate(date)}
                      aria-pressed={dateKey === selectedDateKey}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={className} key={dateKey}>
                      {content}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
