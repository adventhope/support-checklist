import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { ITEMS } from "../lib/items.mjs";
import { weekStart, nowET, toMinutes } from "../lib/time.mjs";
import { deadlines, deadlineToWarn, deadlineJustPassed, unchecked, message, allDoneMessage } from "../lib/alerts.mjs";

// Every 5 minutes on Saturdays, for each "Done by" time in checklist.md:
//  - 10 minutes before: DM the people in SLACK_ALERT_USERS either the items still unchecked,
//    or, if everything is done, a short "all done" note.
//  - At the deadline: if a warning went out and the team has since finished, a "caught up" note.
// Each message goes out at most once per week.
//
// Netlify environment variables (set in the Netlify UI, never in this public repo):
//   SLACK_BOT_TOKEN    Bot token of the "Support Checklist" Slack app (xoxb-...)
//   SLACK_ALERT_USERS  Comma-separated Slack member IDs to DM
//
// The first run outside Saturday (Eastern) sends one TEST message for the next deadline,
// so delivery can be confirmed. After that, non-Saturday runs send nothing.

const checksStore = () => getStore({ name: "support-checks", consistency: "strong" });
const sentStore = () => getStore({ name: "support-alerts", consistency: "strong" });

async function currentChecks(week: string) {
  const s = checksStore();
  const { blobs } = await s.list({ prefix: `${week}/` });
  const out: Record<string, unknown> = {};
  for (const b of blobs) out[b.key.slice(week.length + 1)] = true;
  return out;
}

async function dm(token: string, user: string, text: string) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel: user, text, unfurl_links: false }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Slack error for ${user}: ${data.error ?? res.status}`);
}

async function sendAll(token: string, users: string[], text: string) {
  const results = await Promise.allSettled(users.map((u) => dm(token, u, text)));
  results.forEach((r) => r.status === "rejected" && console.error(r.reason));
  return results.some((r) => r.status === "fulfilled");
}

export default async () => {
  const token = Netlify.env.get("SLACK_BOT_TOKEN");
  const users = (Netlify.env.get("SLACK_ALERT_USERS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !users.length) { console.log("SLACK_BOT_TOKEN or SLACK_ALERT_USERS not set; nothing sent."); return; }

  const week = weekStart();
  const { weekday, minutes } = nowET();
  const sent = sentStore();

  // Not Saturday in Eastern time: one-time TEST message only.
  if (weekday !== "Sat") {
    if (await sent.get("test/once")) return;
    const all = deadlines(ITEMS);
    const due = all.find((d) => toMinutes(d) > minutes) ?? all[0];
    if (!due) return;
    const sample = ITEMS.filter((i: any) => i.due === due).slice(0, 3);
    if (await sendAll(token, users, message(due, sample, { test: true }))) await sent.set("test/once", new Date().toISOString());
    return;
  }

  const checks = await currentChecks(week);

  // 10 minutes before a deadline: warning, or "all done".
  const warnDue = deadlineToWarn(ITEMS, minutes);
  if (warnDue) {
    const key = `${week}/${warnDue}`;
    if (!(await sent.get(key))) {
      const missing = unchecked(ITEMS, checks, warnDue);
      const text = missing.length ? message(warnDue, missing) : allDoneMessage(ITEMS, warnDue);
      if (await sendAll(token, users, text)) {
        await sent.set(key, missing.length ? "warned" : "all-done");
        console.log(`${warnDue}: sent ${missing.length ? `warning (${missing.length} items)` : "all-done note"}.`);
      }
    }
  }

  // At the deadline: if we warned and it's now all done, say so.
  const passedDue = deadlineJustPassed(ITEMS, minutes);
  if (passedDue) {
    const key = `${week}/${passedDue}/caught-up`;
    const warned = (await sent.get(`${week}/${passedDue}`)) === "warned";
    if (warned && !(await sent.get(key)) && !unchecked(ITEMS, checks, passedDue).length) {
      if (await sendAll(token, users, allDoneMessage(ITEMS, passedDue, { caughtUp: true }))) {
        await sent.set(key, new Date().toISOString());
        console.log(`${passedDue}: sent caught-up note.`);
      }
    }
  }
};

export const config: Config = { schedule: "*/5 * * * 6" }; // Saturdays, UTC; the code checks the Eastern weekday
