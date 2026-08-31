const weekStartsOnMondayOffset = 6;

export function formatStorageDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMonthTitle(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatDateLabel(date: Date): string {
  const weekDay = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekDay})`;
}

export function isSameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
  );
}

export function buildMonthCalendar(month: Date): Date[] {
  const firstDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (firstDate.getDay() + weekStartsOnMondayOffset) % 7;
  const startDate = new Date(firstDate);
  startDate.setDate(firstDate.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}
