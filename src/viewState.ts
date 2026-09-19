import { formatStorageDate } from "./dateUtils";

export type ViewState = {
  version: 1;
  selectedDate: string;
  visibleMonth: string;
  recordId: string | null;
};

const storageKey = "workout-tracker.view-state";

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && formatStorageDate(date) === value;
}

export function readViewState(): ViewState | null {
  try {
    const text = window.sessionStorage.getItem(storageKey);
    if (text === null) return null;
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const state = value as Partial<ViewState>;
    if (
      state.version !== 1 ||
      !isDate(state.selectedDate) ||
      !isDate(state.visibleMonth) ||
      !state.visibleMonth.endsWith("-01") ||
      !(
        state.recordId === null ||
        (typeof state.recordId === "string" &&
          state.recordId.startsWith("record_") &&
          state.recordId.length > 7)
      )
    )
      return null;
    return {
      version: 1,
      selectedDate: state.selectedDate,
      visibleMonth: state.visibleMonth,
      recordId: state.recordId,
    };
  } catch {
    return null;
  }
}

export function writeViewState(state: ViewState): void {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // View restoration is optional when browser storage is unavailable.
  }
}
