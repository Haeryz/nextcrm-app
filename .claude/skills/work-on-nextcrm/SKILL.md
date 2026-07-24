---
name: work-on-nextcrm
description: Apply the repository-specific operating rules for nextcrm-app. Use whenever planning, analyzing, editing, debugging, testing, reviewing, or documenting work in the nextcrm-app repository, especially for context-mode usage, skill selection, production storefront E2E tests, staff authorization changes, or user-interface localization.
---

# Work on nextcrm

Follow `AGENTS.md` as the authoritative project guide. Keep this skill procedural and read current repository sources instead of copying details that may become stale.

## Start every task

1. Read the repository-root `AGENTS.md` in full before taking task actions.
2. Apply the precedence order: user instructions, applicable project skills, then default behavior.
3. Inspect the current worktree before relying on paths or capabilities named in documentation.
4. Check for an applicable skill before responding or acting. Load every applicable skill and follow rigid skills exactly.
5. Preserve unrelated user changes in a dirty worktree.

## Manage context and tool output

Use context-mode tools in this order when they are available:

1. Use `ctx_batch_execute` for primary research, command execution, indexing, and initial searches.
2. Use `ctx_search` for follow-up questions, batching multiple queries together.
3. Use `ctx_execute` or `ctx_execute_file` for data processing, API calls, and large-log or large-file analysis.

Do not:

- Run shell commands expected to produce more than 20 lines of direct output.
- Use an ordinary file-reading tool for analysis; reserve it for files about to be edited.
- Use WebFetch.

If context-mode is unavailable, disclose that limitation, use targeted searches and tightly bounded output, and never pretend that a documented tool or skill exists.

Handle context-mode commands exactly:

- For `/ctx-stats`, call `ctx_stats` and display its output verbatim.
- For `/ctx-doctor`, call `ctx_doctor`, run the returned command, and display the results as a checklist.
- For `/ctx-upgrade`, call `ctx_upgrade`, run the returned command, and display the results as a checklist.

## Run production storefront E2E tests safely

Before a production storefront E2E test:

1. Read the current synthetic customer account and URLs from `AGENTS.md`.
2. Reuse that account. Do not create another account unless the documented account is removed or explicitly invalidated.
3. Use only Midtrans sandbox payment cards, simulators, virtual accounts, and QRIS flows.
4. Never enter real payment credentials.
5. Reuse existing completed orders when they are sufficient for regression coverage.

## Protect staff authorization

Before changing staff authentication, admin or sub-admin accounts, navigation, permissions, middleware, or confidential-data access:

1. Read `docs/staff-authorization.md` in full.
2. Preserve `Users.is_admin` as the unrestricted owner key unless the authoritative document explicitly changes that requirement.
3. Treat `Users.staffDivision` as sub-admin metadata.
4. Do not invent or prematurely enforce division-specific restrictions; follow the deferred authorization handoff checklist.

## Apply localization

- Write all user-visible interface copy in Bahasa Indonesia.
- Keep technical identifiers such as variables, database fields, and code conventions in English where appropriate.
- Present technical data through Bahasa Indonesia labels in the interface.
- Communicate with the user in English unless the user requests another language.

## Finish the task

1. Verify behavior in proportion to the change and its risk.
2. Inspect the final diff for scope, accidental secret duplication, and unrelated edits.
3. Confirm user-visible copy follows the localization policy.
4. Report unavailable documented tools or missing referenced files clearly.
