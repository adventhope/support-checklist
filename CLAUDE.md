# Support Team Checklist (Church of the Advent Hope)

The volunteer checklist at https://ah-support-checklist.netlify.app. Volunteers open it on their phones, no login, and check items off. Checkmarks are shared live across phones and clear every Sunday at midnight Eastern.

## The one file to edit: `checklist.md`

Every change to the list happens in `checklist.md`. The format is strict:

- `# Section name` starts a section (for example `# Post-Service Breakdown (After 11:30 AM)`).
- `## Group name` starts an optional sub-group inside a section.
- `- Item text` is one checkbox. One line per item.
- Blank lines are fine. Any other kind of line makes the deploy fail on purpose, so the live site never breaks.

Order in the file is the order on the site.

## How to make a change someone asks for

1. Edit `checklist.md` only. Keep the person's wording unless they ask you to improve it.
2. Commit to `main` with a plain message, e.g. "Add hand sanitizer refill to Cleanup".
3. Netlify rebuilds and publishes automatically from `main` in about a minute. Nothing else to run.
4. Tell the person what changed and that the site will update in about a minute.

Notes:
- Rewording or moving an item to another section clears its checkmark for the current week (its ID comes from the section and text). Mention this if someone asks mid-Sabbath.
- `netlify/lib/items.mjs` is generated from `checklist.md` at deploy time. Never edit it.
- To check a change before committing: `npm run build` reports the item count or the exact line that's wrong.

## Never put in this repo

This repo is public. Never add passwords, Zoom passcodes, meeting IDs, logins, door codes or phone numbers, even if they appear in the Support Team Guide Google Doc. The checklist lists tasks only.

## Where the list came from

The Support Team Guide Google Doc ("Support Team Guide (Editable)", owned by Nick Zork) is the reference manual. This checklist started as a copy of its task lists on 2026-11-05 and is now maintained here. If someone says "update it from the Guide", read the doc, change only the task lists in `checklist.md`, and skip the logins section entirely.

## Everything else (rarely needed)

- `public/index.html`: the page volunteers see.
- `netlify/functions/checks.mts`: saves and reads checkmarks (Netlify Blobs store `support-checks`, one entry per checked item, keyed by week).
- Netlify project `ah-support-checklist`, team Advent Hope Staff. Owner: Todd Stout.
