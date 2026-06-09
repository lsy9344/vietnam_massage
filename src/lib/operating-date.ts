export type OperatingMonthDateRange = {
  id: string;
  startDate: string;
  endDate: string;
};

export function kstTodayIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function clampDateToOperatingMonth(date: string | undefined, month: OperatingMonthDateRange, now = new Date()) {
  if (!date || date < month.startDate || date > month.endDate) {
    const today = kstTodayIsoDate(now);
    return today >= month.startDate && today <= month.endDate ? today : month.startDate;
  }

  return date;
}

export function selectedOperatingMonthFor<T extends { id: string }>(months: T[], operatingMonthId?: string) {
  return months.find((month) => month.id === operatingMonthId) ?? months[0] ?? null;
}
