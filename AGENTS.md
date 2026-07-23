# AGENTS.md

This file is the authoritative guide for AI agents (Claude Code and other LLM agents) working in the `nextcrm-app` project. It covers context management, available superpowers/skills, current repo status, and available MCP servers.

---

## 1. Context-Mode

**What it is**: The `context-mode` MCP plugin intercepts large tool outputs and stores them in a local FTS5 SQLite sandbox, returning only a compact reference instead of flooding the context window.

### Tool Hierarchy

| Priority | Tool                                                                      | Use When                                                             |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1        | `mcp__plugin_context-mode_context-mode__ctx_batch_execute`                | Primary research — runs commands, auto-indexes, searches in one call |
| 2        | `mcp__plugin_context-mode_context-mode__ctx_search`                       | Follow-up questions — pass multiple queries in one call              |
| 3        | `mcp__plugin_context-mode_context-mode__ctx_execute` / `ctx_execute_file` | Data processing, API calls, large log analysis                       |

### Forbidden Actions

- **Never** use `Bash` for commands producing >20 lines of output
- **Never** use `Read` for analysis (use `ctx_execute_file` instead; `Read` is correct only for files you intend to `Edit`)
- **Never** use `WebFetch` — use `ctx_fetch_and_index` instead

### Trigger Commands

| Command        | Action                                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| `/ctx-stats`   | Call `ctx_stats` MCP tool, display output verbatim                                |
| `/ctx-doctor`  | Call `ctx_doctor` MCP tool, execute returned shell command, display as checklist  |
| `/ctx-upgrade` | Call `ctx_upgrade` MCP tool, execute returned shell command, display as checklist |

---

## 2. Superpowers (Skills System)

**What it is**: The `.claude/skills/` directory contains `SKILL.md` files that define rigid and flexible agent behaviors.

**Core rule**: Check for applicable skills **before** any response. Invoke via the `Skill` tool.

**Priority order**: User instructions > Superpowers skills > Default behavior

### Available Skills

| Skill                          | Path                                             | Type     |
| ------------------------------ | ------------------------------------------------ | -------- |
| using-superpowers              | `.claude/skills/using-superpowers/`              | Rigid    |
| brainstorming                  | `.claude/skills/brainstorming/`                  | Rigid    |
| test-driven-development        | `.claude/skills/test-driven-development/`        | Rigid    |
| systematic-debugging           | `.claude/skills/systematic-debugging/`           | Rigid    |
| writing-plans                  | `.claude/commands/write-plan.md`                 | Flexible |
| executing-plans                | `.claude/skills/executing-plans/`                | Flexible |
| dispatching-parallel-agents    | `.claude/skills/dispatching-parallel-agents/`    | Flexible |
| subagent-driven-development    | `.claude/skills/subagent-driven-development/`    | Flexible |
| using-git-worktrees            | `.claude/skills/using-git-worktrees/`            | Flexible |
| finishing-a-development-branch | `.claude/skills/finishing-a-development-branch/` | Flexible |
| requesting-code-review         | `.claude/skills/requesting-code-review/`         | Flexible |
| receiving-code-review          | `.claude/skills/receiving-code-review/`          | Flexible |

---

## 3. Production E2E Customer Account

Use this existing synthetic customer account for production storefront E2E tests.
Do not create another customer account unless this account has been removed or
explicitly invalidated.

- Production URL: `https://mektek-bice.vercel.app`
- Customer login URL: `https://mektek-bice.vercel.app/en/customer/access`
- Phone: `+6200798201014`
- Password: `CodexE2E!98201014`
- Customer name: `Codex E2E 98201014`

This account is test-only. The production storefront currently connects to
Midtrans Sandbox, so use only Midtrans sandbox cards, simulators, virtual
accounts, and QRIS flows. Never enter real payment credentials for this account.

The account already has completed BCA virtual-account, credit-card, and
QRIS/GoPay E2E orders. Reuse it for regression testing login, direct purchase,
cart checkout, payment reconciliation, invoices, and receipts.

---

## 4. Staff Roles and Deferred Authorization

Before changing staff authentication, admin/sub-admin accounts, navigation,
permissions, middleware, or confidential-data access, **read
[`docs/staff-authorization.md`](docs/staff-authorization.md) in full**.

The division-role foundation and main-admin CRUD exist, but division-specific
restrictions are intentionally deferred. `Users.is_admin` is the unrestricted
owner key; `Users.staffDivision` is sub-admin metadata. The linked document is the
authoritative handoff checklist for implementing the final server-side permission
matrix later.

---

## 5. Localisation policy

All language must use Bahasa Indonesia in the interface, with the exception of technical / coding are allowed to use english name convention such as variable name, database, etc while preserving the interface of that data in Bahasa Indonesia.