/** Timezone-safe YYYY-MM-DD keys, so workouts land on the day the user actually trained. */
export function dateKeyOf(d: Date, tz?: string | null) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Monday-first weekday name for a YYYY-MM-DD key. */
export function weekdayOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
}

export function startOfWeek(key: string) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const idx = names.indexOf(weekdayOf(key));
  return addDays(key, -((idx + 6) % 7));
}

export function prettyDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Store a log at local noon so it never slips a day across timezones. */
export function noonISO(key: string) {
  return `${key}T12:00:00`;
}
