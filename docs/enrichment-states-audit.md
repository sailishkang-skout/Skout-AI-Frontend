# Enrichment screens — empty, loading, error and retry states (ENR-06)

Audit date: 2026-10-12. Every enrichment screen was checked for four states: what it shows
while loading, when there is nothing, when a load fails, and how the user retries. "Retry" means
a control on the screen that repeats the failed request — not a page reload.

| Screen | Loading | Empty | Load error + retry | Action errors |
| --- | --- | --- | --- | --- |
| Overview — research summary (`/enrichment`) | Skeleton **(added)** | "Nothing has been captured yet" with a link to Capture **(added)** | Alert with Try again **(added; it used to disappear)**. A failed job-change feed shows its own alert **(added)** | — |
| People (`/enrichment/people`) | Skeleton rows | "No people match" with what to do | Alert with Try again; permission errors explain instead | Add-URL dialog shows the error |
| Person (`/enrichment/people/:id`) | Skeleton | Each section says what was not captured | Alert with Try again; a missing person says so with a way back | One alert for attach / CSV / delete / lookup |
| Person — provider enrichment | "No provider run yet." once loaded | same | Alert with Try again **(added)** | Alert on a refused start |
| Person — contact data | "Loading…" | "No email on record." / "No phone number on record." | Alert with Try again | Alert on a failed verification |
| Companies (`/enrichment/companies`) | Skeleton rows | Empty card with what to do | Alert with Try again | — |
| Company (`/enrichment/companies/:id`) | Skeleton | Per-group empty text; "No evidence recorded yet" | Alert with Try again, per people group as well | One alert for CSV / delete |
| Job changes (`/enrichment/job-changes`) | Skeleton | "Nothing to review" / "No job changes" | Alert with Try again | Alert on a failed review |
| Capture (`/enrichment/capture`) | Skeleton | "No captures yet" | Alert with Try again for status and for the run log | Alert on a failed settings change. Company suggestions that fail to load fall back to free text, with a note **(added)** |
| Add profile (`/enrichment/add`) | "Loading status…" | "No runs yet" | Alert with Try again for the run and for recent runs | Alert on a refused start |
| Providers (`/enrichment/providers`) | Skeleton | "No provider account is connected" | Alert with Try again; permission errors explain instead | One alert for connect / check / disconnect |
| Campaigns (`/enrichment/campaigns`) | "Counting…", "Loading…" | Empty text for the audience, the queue and the list | Alert with Try again for each of the three sections | Alerts on build and dismiss |
| Campaign (`/enrichment/campaigns/:id`) | Skeleton | "No supported talking point" per recipient | Alert with Try again; a missing campaign says so with a way back | One alert for every action; a refused launch reloads the status |
| Any gated screen, feature not released | Skeleton while checking | — | "Not available in this workspace yet" with the reason **(added)** | — |

## What changed in this pass

- The research summary on the Enrichment overview returned nothing while loading and nothing
  on failure. It now has a skeleton, an empty state, and an error with a retry.
- The last provider run on person and company pages now reports a failed load.
- The capture page notes when saved-company suggestions could not be loaded.
- Screens behind the internal release show one explanation instead of a set of failed requests.

## Not changed

- The Workbooks screen and the contact-enrichment form on the overview predate this feature and
  were not part of the audit.
- Polling screens (job status) keep showing the last known status if a poll fails, and show the
  error only when the first load fails. A job that stops updating is covered on the backend by
  the queue-lag alert.

## How it is checked

`e2e/enrichment-acceptance.spec.ts` covers a failed load with a working retry, empty states on
each list, a missing record, and the not-released notice. Component tests cover the rest
(`research.test.tsx`, `provider.test.tsx`, `campaigns.test.tsx`, `release-gate.test.tsx`).
