export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(centsToDollars(cents));
}

export function formatDateLabel(date: string | null): string {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatIsoDateLabel(date: string | null): string {
  if (!date) return "No date";
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const year = match[1];
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = match[3];
  const month = MONTH_SHORT[monthIndex];
  if (!month) return date;
  return `${year}-${month}-${day}`;
}

export function isoDateFromDateInput(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date input.");
  }
  return parsed.toISOString().slice(0, 10);
}

export function isoDateToUtcDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid ISO date.");
  }
  return parsed;
}
