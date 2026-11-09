# FLAME Data Dictionary — Contract Draft

This document defines the frontend's provisional typed boundary. It is not the backend API contract. Confirm names, identifiers, enum values, and paging envelopes with the data engineering team before connecting a real service.

## Collection records

### Investigation

| Field | Meaning | Missing semantics |
|---|---|---|
| `id` | Stable application record identifier | Required by boundary. |
| `name` | Source-backed investigation name | Required; preserve source wording. |
| `acronym`, `family` | Short name and parent research family | `null` when absent; do not infer. |
| `objective`, `summary` | Source-grounded objective or checked summary | `null` means not supplied in the indexed collection. |
| `safetyDomains` | Prevention, Detection, Suppression, Other | Empty means not classified; never imply absence in source. |
| `gravityEnvironments` | Source's gravity labels | Empty means currently unclassified. |
| `provenanceStatus` | NASA verified, demo, illustrative, not reported, inferred/unverified | Required, never default to verified. |
| `evidenceLevel` | Direct, analogous, mechanism-only, planned, unavailable | Required for relevance context. |
| `source` | Document and locator metadata | `null` when the record has no attached locator. Verified NASA records must have a source before acceptance. |
| `testRuns` | Run records attached to this investigation | Empty means none indexed, not that none exist. |

### Test run

| Field | Meaning |
|---|---|
| `id` | Stable application test-run record ID. |
| `sourceRunKey` | Exact run key used by the source, nullable. |
| `label` | Human-readable source-backed run label. |
| `objectiveVariant` | What differs for this run, if documented. |
| `conditions` | Original and optionally normalized condition values with missing status and source locator. |
| `measurements` | Reported/measured/derived values. Inferred values are not measurements. |
| `provenanceStatus` | Explicit source/demo status for the run. |

### Measurement and condition values

| Field | Meaning |
|---|---|
| `valueOriginal`, `textOriginal`, `unitOriginal` | Preserve the source expression and unit. No conversion should erase it. |
| `valueSi`, `unitSi` | Optional documented conversion; null if not safely normalized. |
| `missingStatus` | `PRESENT`, `NOT_REPORTED`, `NOT_APPLICABLE`, `UNKNOWN`, or `AMBIGUOUS`. Missing fields never become zero. |
| `source` | Page, section, table/figure, row/run key, and verification status where available. |

### Source locator

`sourceDocumentId`, `sourceTitle`, optional `sourceUrl`, 1-based `pageNumber`, optional `sectionHeading`, `tableFigureLabel`, `rowOrRecordKey`, and `verificationStatus` (`UNVERIFIED`, `VERIFIED`, `REJECTED`).

## Status labels

- `NASA_VERIFIED_DATA`: human-checked against the cited primary source; source locator required for import acceptance.
- `DEMO_FIXTURE`: product/demo fixture; must remain visibly marked and must not be described as NASA measurement.
- `ILLUSTRATIVE_SIMULATION`: visual or conceptual output only, not measurement.
- `NOT_REPORTED`: source explicitly does not report a field.
- `INFERRED_UNVERIFIED`: extracted or interpreted content awaiting source check.

## Import preview

`previewInvestigationImport` validates JSON records against Zod schemas and returns row-level parse errors and integrity warnings. It does not write to a database, accept uploads, verify NASA sources, or establish a final API. CSV/PDF/XLSX parsing is deferred until the official resource package and mapping contract are available.

