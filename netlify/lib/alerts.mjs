// Decides which deadline warning is due right now and writes the Slack message.
// Pure logic, no storage or network, so it can be tested on its own.
import { toMinutes, label } from "./time.mjs";

export const WARN_MINUTES = 10; // warn this many minutes before each "Done by" time
export const SITE = "https://ah-support-checklist.netlify.app";

// All distinct deadlines in the list, earliest first, e.g. ["09:00", "10:20", "11:30", "14:00"].
export const deadlines = (items) => [...new Set(items.map((i) => i.due).filter(Boolean))].sort();

// The deadline whose warning window [due - WARN_MINUTES, due) contains `minutes`, or null.
export function deadlineToWarn(items, minutes) {
  return deadlines(items).find((d) => minutes >= toMinutes(d) - WARN_MINUTES && minutes < toMinutes(d)) ?? null;
}

export const unchecked = (items, checks, due) => items.filter((i) => i.due === due && !checks[i.id]);

// The deadline that started within the last WARN_MINUTES (used for the "caught up" note), or null.
export function deadlineJustPassed(items, minutes) {
  return deadlines(items).find((d) => minutes >= toMinutes(d) && minutes < toMinutes(d) + WARN_MINUTES) ?? null;
}

const countDue = (items, due) => items.filter((i) => i.due === due).length;

export function allDoneMessage(items, due, { caughtUp = false, test = false } = {}) {
  const n = countDue(items, due);
  const what = `${n} item${n === 1 ? "" : "s"} due by ${label(due)}`;
  return `${test ? "*TEST* — " : ""}:white_check_mark: ${caughtUp ? `All caught up. Every one of the ${what} is now done.` : `All ${what} are done, ahead of time.`} Thank you, team!`;
}

export function message(due, missing, { test = false } = {}) {
  const lines = missing.map((i) => `• ${i.text}  _(${i.group || i.section})_`);
  const head = `${test ? "*TEST* — " : ""}*${missing.length} checklist item${missing.length === 1 ? "" : "s"} not done yet, due by ${label(due)}*`;
  return [head, ...lines, "", `<${SITE}|Open the Support Team checklist>`].join("\n");
}
