import { env } from '../../config/env.js';

// Calendar date and hour as seen in the business time zone, whatever the server's own zone is
const businessClock = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour') };
};

// Tomorrow's date as UTC midnight, which is how Prisma stores a @db.Date column
export const tomorrowInBusinessTz = (now = new Date()): Date => {
  const { year, month, day } = businessClock(now);
  return new Date(Date.UTC(year, month - 1, day + 1));
};

export const isOrderingOpen = (now = new Date()): boolean =>
  businessClock(now).hour < env.ORDER_CUTOFF_HOUR;

export const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

export const parseDateString = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
