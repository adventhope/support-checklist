import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { ITEMS } from "../lib/items.mjs";
import { weekStart, nowET, toMinutes } from "../lib/time.mjs";
import { deadlines, deadlineToWarn, unchecked, message } from "../lib/alerts.mjs";

// Every 5 minutes on Saturdays: ten minutes before each "Done by" time in checklist.md,
// DM the people in SLACK_ALERT_USERS the items in that group that are still unchecked.
// Nothing is sent if everything is done. Each warning goes out at most once per week.
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

export default async () => {
  const token = Netlify.env.get("SLACK_BOT_TOKEN");
  const users = (Netlify.env.get("SLACK_ALERT_USERS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !users.length) { console.log("SLACK_BOT_TOKEN or SLACK_ALERT_USERS not set; nothing sent."); return; }

  const week = weekStart();
  const { weekday, minutes } = nowET();
  const test = weekday !== "Sat";

  let due: string | null;
  if (test) {
    const all = deadlines(ITEMS);
    due = all.find((d) => toMinutes(d) > minutes) ?? all[0] ?? null;
  } else {
    due = deadlineToWarn(ITEMS, minutes);
  }
  if (!due) return;

  // The schedule is in UTC, so it also fires Friday evening Eastern. Outside Saturday Eastern,
  // only one TEST message is ever sent (delete the "test/once" key in the support-alerts store to test again).
  const sentKey = test ? "test/once" : `${week}/${due}`;
  if (await sentStore().get(sentKey)) return; // already sent

  const checks = await currentChecks(week);
  let missing = unchecked(ITEMS, checks, due);
  if (test) missing = (missing.length ? missing : ITEMS.filter((i: any) => i.due === due)).slice(0, 3);
  if (!missing.length) { await sentStore().set(sentKey, "nothing-missing"); return; }

  const text = message(due, missing, { test });
  const results = await Promise.allSettled(users.map((u) => dm(token, u, text)));
  results.forEach((r) => r.status === "rejected" && console.error(r.reason));
  if (results.some((r) => r.status === "fulfilled")) {
    await sentStore().set(sentKey, new Date().toISOString());
    console.log(`Sent ${test ? "test " : ""}warning for ${due}: ${missing.length} item(s) to ${users.length} people.`);
  }
};

export const config: Config = { schedule: "*/5 * * * 6" }; // Saturdays, UTC; covers the Eastern morning
