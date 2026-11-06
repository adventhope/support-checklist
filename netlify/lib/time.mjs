// Shared date helpers. Everything runs on Eastern time.
export const TZ = "America/New_York";

function partsET(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  return p;
}

// The Sunday (YYYY-MM-DD) that starts the current week. Weeks run Sunday 00:00 to Saturday 23:59 Eastern,
// so checkmarks clear Sunday at midnight.
export function weekStart(now = new Date()) {
  const p = partsET(now);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - dow));
  return d.toISOString().slice(0, 10);
}

// Day of week ("Sat") and minutes since midnight, Eastern.
export function nowET(now = new Date()) {
  const p = partsET(now);
  return { weekday: p.weekday, minutes: +p.hour * 60 + +p.minute };
}

// "09:00" -> 540
export const toMinutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

// "13:50" -> "1:50 PM"
export function label(hhmm) {
  let [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
