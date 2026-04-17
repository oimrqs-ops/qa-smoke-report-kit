# QA Smoke Report Kit

Small browser QA kit for checking a public page before handoff. It runs a
focused smoke pass with Playwright, records console/page errors, checks common
links, catches horizontal overflow, and writes a concise Markdown report.

This is the kind of artifact I use for a 1-day QA/debugging pass: clear inputs,
repeatable checks, evidence, and a short list of risks instead of vague notes.

## What It Checks

- page loads with a successful HTTP status
- title and URL are captured for evidence
- console errors and page errors
- horizontal overflow on desktop and mobile widths
- missing or empty links
- selected proof/CTA links return a successful status
- screenshot path for manual review

## Run

```bash
npm install
npm run smoke -- https://example.com
```

The report is written to `out/smoke-report.md`.

## Output Shape

The generated report includes:

- target URL
- check timestamp
- pass/fail summary
- issue table
- evidence notes
- recommended next actions

See `sample-report.md` for the expected handoff format.

## Scope Boundary

This is a smoke/audit helper, not a replacement for a full test suite. It is
useful for first-pass website QA, pre-launch checks, debugging intake, and
agency overflow work where the goal is to find actionable issues quickly.
