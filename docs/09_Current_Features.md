# Current Features

This inventory distinguishes working server behavior from UI that is merely visible. It reflects the active source tree, not the `backup-*` snapshots.

## Public and account features

- Marketing landing page composed from `src/app/components/home/`.
- Two-step mosque/imam registration at `/register`; the API can atomically create user, mosque, and default settings.
- Location-based login at `/login` (wilaya → commune → mosque) with password authentication.
- Cookie-based logout from the sidebar.
- Topbar profile menu fast actions open user and settings tabs and support logout.
- Settings page loads and saves current user, mosque profile, and per-mosque settings through working API endpoints, including password changes that require the current password.
- Cookie-driven French/Arabic switching with RTL document direction.
- Local browser light/dark theme switching.

## Donation and donor management

- Create, search, list, view, edit, and conditionally delete mosque donors through the API. The current management UI creates/lists/searches donors and shows donation totals.
- Export the currently filtered donor list to a styled PDF from the donor management page.
- Record anonymous or identified donations; update mosque balance and donor totals transactionally.
- List donations with server-side category/payment method/donor/date filters and client-side category filter/pagination.
- Correct or delete a donation through API routes, with aggregate/balance adjustments. The current donations screen does not expose edit/delete controls.

## Beneficiary-family management

- Create and list beneficiary families, including income, housing, health, CCP, declared household size, and intake notes.
- Filter families by text, status, income, SVF score, priority, employment status, and marital status.
- Automatically create a HEAD member; create, list, edit, and delete household members and child compatibility records through APIs.
- Maintain SVF score and priority after family, child, and member changes.
- Archive a family instead of deleting it, retaining history.
- Upload, list, download, and delete Base64-backed family documents through APIs. No current management-screen integration was found for document upload/download.
- Family details modal displays registered members and warns when fewer individual member rows exist than the declared household size.

## Distribution and financial management

- Calculate a non-persistent Water-Filling distribution preview for active, linked families.
- Apply per-request reserve/minimum/maximum bounds; use persisted reserve/minimum settings as preview defaults.
- Confirm an automated or explicit manual distribution transactionally, store historical headers/items, update balance, and stamp `lastAidAt`.
- Create a single-family manual aid record through the API.
- List distribution history and inspect details; the UI supports item payment-status changes.
- Delete a distribution and restore its allocated total to mosque balance.
- Store current per-item payment status and distribution workflow status.

## Dashboard and settings APIs

- Dashboard cards for families, children, donors, donation count, total received, total distributed, and stored balance.
- Six-month received/distributed chart and donation activity feed.
- Dashboard APIs for monthly, financial, social, and headline aggregates.
- Per-mosque settings API for SVF score parameters, JSON overrides, custom-criteria storage, reserve/minimum, and policy flags. Settings updates recalculate linked families.
- Settings reset API for SVF, Water-Filling, or both.

## What is not counted as implemented

The notification panel, forgotten-password link, reports, and demo mode are not included as completed capabilities because their visible controls do not connect to working workflows or no corresponding route exists. See [Missing Features](10_Missing_Features.md).
