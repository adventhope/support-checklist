import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { ITEMS, ITEM_IDS, SOURCE_DATE } from "../lib/items.mjs";

// One blob per checked item: key "<weekStart>/<itemId>", value { by, at }.
// Separate keys mean two volunteers ticking different items never overwrite each other.
// Weeks run Sunday 00:00 to Saturday 23:59, America/New_York, so ticks clear Sunday at midnight.

const TZ = "America/New_York";

function weekStart(now = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - dow));
  return d.toISOString().slice(0, 10);
}

const store = () => getStore({ name: "support-checks", consistency: "strong" });

async function currentChecks(week: string) {
  const s = store();
  const { blobs } = await s.list({ prefix: `${week}/` });
  const entries = await Promise.all(
    blobs.map(async (b) => {
      const v = await s.get(b.key, { type: "json" });
      return v ? [b.key.slice(week.length + 1), v] : null;
    }),
  );
  return Object.fromEntries(entries.filter(Boolean) as [string, unknown][]);
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default async (req: Request) => {
  const week = weekStart();
  try {
    if (req.method === "GET") {
      const full = new URL(req.url).searchParams.get("items") === "1";
      return json({ week, checks: await currentChecks(week), ...(full ? { items: ITEMS, sourceDate: SOURCE_DATE } : {}) });
    }

    if (req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
      const id = String(body?.id ?? "");
      if (!ITEM_IDS.has(id)) return json({ error: "Unknown item" }, 400);
      const key = `${week}/${id}`;
      if (body.checked) {
        const by = String(body.by ?? "").trim().slice(0, 40);
        await store().setJSON(key, { by, at: new Date().toISOString() });
      } else {
        await store().delete(key);
      }
      return json({ week, checks: await currentChecks(week) });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Storage error" }, 500);
  }
};

export const config: Config = { path: "/api/checks", method: ["GET", "POST"] };
