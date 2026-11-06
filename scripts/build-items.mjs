// Turns checklist.md into netlify/lib/items.mjs, which the site reads.
// Netlify runs this on every deploy. Run it yourself with: npm run build
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const src = readFileSync(new URL("../checklist.md", import.meta.url), "utf8");
const items = [];
const seen = new Set();
const problems = [];
let section = "", group = "";
let sectionDue = null, groupDue = null;

// "Done by: 9:00 AM" -> "09:00" (24-hour, Eastern). Returns null if it can't be read.
function parseDue(s) {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = +m[1]; const min = +(m[2] ?? 0);
  if (h < 1 || h > 12 || min > 59) return null;
  if (/pm/i.test(m[3]) && h !== 12) h += 12;
  if (/am/i.test(m[3]) && h === 12) h = 0;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

src.split(/\r?\n/).forEach((line, n) => {
  const t = line.trim();
  if (!t || t.startsWith("<!--")) return;
  if (t.startsWith("# ")) { section = t.slice(2).trim(); group = ""; sectionDue = null; groupDue = null; return; }
  if (t.startsWith("## ")) { group = t.slice(3).trim(); groupDue = null; return; }
  const d = t.match(/^done by:\s*(.+)$/i);
  if (d) {
    const due = parseDue(d[1]);
    if (!due) { problems.push(`line ${n + 1}: can't read the time in "${t}" (use e.g. "Done by: 9:00 AM")`); return; }
    if (!section) { problems.push(`line ${n + 1}: "Done by" before any "# " section heading`); return; }
    if (group) groupDue = due; else sectionDue = due;
    return;
  }
  const m = t.match(/^[-*]\s+(.+)$/);
  if (!m) { problems.push(`line ${n + 1}: not a heading or a "- " item: ${t}`); return; }
  if (!section) { problems.push(`line ${n + 1}: item before any "# " section heading`); return; }
  const text = m[1].trim();
  // The ID comes from the section and wording, so rewording an item clears its checkmark for the week.
  let id = "i" + createHash("sha1").update(section + "\n" + text).digest("hex").slice(0, 12);
  while (seen.has(id)) id += "x";
  seen.add(id);
  items.push({ id, section, group, text, due: groupDue ?? sectionDue });
});

if (problems.length) { console.error("checklist.md has problems:\n" + problems.join("\n")); process.exit(1); }
if (items.length < 5) { console.error(`checklist.md has only ${items.length} items; refusing to publish an almost-empty list.`); process.exit(1); }

const updated = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
mkdirSync(new URL("../netlify/lib/", import.meta.url), { recursive: true });
writeFileSync(new URL("../netlify/lib/items.mjs", import.meta.url),
  `// GENERATED from checklist.md by scripts/build-items.mjs. Do not edit; edit checklist.md.\n` +
  `export const SOURCE_DATE = ${JSON.stringify(updated)};\n` +
  `export const ITEMS = ${JSON.stringify(items, null, 2)};\n` +
  `export const ITEM_IDS = new Set(ITEMS.map((i) => i.id));\n`);
console.log(`Built ${items.length} items in ${new Set(items.map((i) => i.section)).size} sections.`);
