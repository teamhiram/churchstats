# Security Checklist

Use this checklist for changes involving authentication, authorization, Supabase, RLS, personal data, migrations, deletion, imports, exports, or release operations.

## Secrets And Personal Data

- Do not commit real tokens, API keys, service role keys, database dumps, or real user data.
- Do not log secrets, emails, personal details, auth tokens, or raw request payloads unless explicitly safe and necessary.
- Redact sensitive values in screenshots, debug logs, release notes, and issue comments.
- Remember that files ignored by Git can still be risky if they were previously committed.

## Supabase Auth And RLS

- Treat RLS as the authorization source of truth.
- UI hiding is not enough; server actions, API routes, and database policies must enforce access.
- For every new or changed table, confirm whether `anon`, `authenticated`, and service-role access are intended.
- Prefer locality-scoped checks for locality data.
- Keep service role usage on the server only.
- When changing helper functions used by policies, identify all dependent policies before editing.

## Roles And Permissions

- Confirm whether the change uses global roles, local roles, or both.
- Check `viewer`, `reporter`, `co_admin`, and `admin` behavior when relevant.
- Verify both allowed and denied paths.
- Include empty-state and cross-locality behavior when local access is involved.

## Migrations

- New SQL migration files must start with a filename comment.
- Identify whether the migration is additive, destructive, or backfill-related.
- For destructive changes, require explicit user approval and a rollback or recovery plan.
- Check whether existing rows need default values, backfill, indexes, constraints, or policy updates.
- Avoid running migrations against production without explicit confirmation.

## Data Deletion, Import, And Export

- Confirm the exact scope before deleting, importing, or exporting data.
- Prefer preview/dry-run behavior for bulk operations.
- Validate CSV/import mappings before write operations.
- Avoid exporting personal data unless the user explicitly requests it and the destination is clear.

## Verification

- Run the smallest meaningful verification first.
- For auth/RLS changes, include denied-access checks where feasible.
- For UI changes involving permissions, verify both visible and unavailable states.
- If a check cannot be run locally, report what was not verified and why.
