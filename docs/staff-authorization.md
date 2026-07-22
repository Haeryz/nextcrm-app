# Staff Divisions and Deferred Authorization

> **Mandatory status:** the role foundation and owner CRUD are implemented.
> Logistics-specific authorization is enforced; the other division matrices remain
> deferred. Read this document before changing authentication, staff pages,
> middleware, or permissions.

## Current contract

- `Users.is_admin` is the main-admin/owner master key. An active main admin must
  retain unrestricted access and is the only account allowed to manage sub-admins.
- `Users.staffDivision` identifies a sub-admin's business division. Initial values
  are `OPERATIONS`, `CUSTOMER_SERVICE`, `TECHNICAL`, `LOGISTICS`, `FINANCE`, and
  `HUMAN_RESOURCES`.
- `Users.logisticsStaffArea` narrows Logistics sub-admins to `MONITORING_PO` or
  `RECEIVING`. Both areas can access Catalog / Item. Main admins bypass this scope.
- `Users.mektekRole` (`CS` / `TECHNICIAN`) is the older task-level operational role
  and remains in place for compatibility. Do not silently merge it into the new
  division field during unrelated work.
- Division staff can authenticate at `/[locale]/sign-in`. The division is refreshed
  from Postgres into the server session and request-handler session on every session
  resolution; it is also present in the JWT for middleware routing.
- Main-admin CRUD lives at `/[locale]/mektek/staff` and in
  `actions/auth/sub-admins.ts`. Server-side `requireAdmin()` plus `is_admin: false`
  mutation predicates protect the owner account from forged form submissions.
- The separate service technician directory (Mekanik / Helper / OJT) lives at
  `/[locale]/mektek/technicians` and in `actions/mektek/technicians.ts`. It is not
  a login-role table. Its CRUD page and mutations are main-admin-only, while active
  directory records can be assigned to service orders in groups of one to three.
- Division accounts are excluded from customer authentication/session flows and
  protected from customer-account edit/delete actions.

## Deliberately temporary behavior

`lib/mektek/permissions.ts` enforces the approved Logistics subset: Logistics staff
can access Catalog / Item plus exactly one assigned area (`MONITORING_PO` or
`RECEIVING`). The restriction covers navigation, pages, server actions, route
handlers, exports, documents, receipt images, and service-order reads.

Other divisions still use the deliberate broad-access scaffolding. **Do not
interpret those remaining policies as finished or onboard other limited-access
divisions yet.** Hiding a sidebar link alone is never authorization; every new
division policy must follow the server-side pattern established for Logistics.

## Required final authorization phase

Implement this only when the owner approves the final route/data matrix:

1. Inventory every authenticated page, server action, route handler, API route,
   export/download, and sensitive field. Classify both page access and data scope.
2. Agree on a permission matrix. Suggested starting responsibilities—not a final
   policy—are:

   | Division | Likely scope to confirm |
   | --- | --- |
   | Operations | service workflow and scheduling |
   | Customer Service | customer communication and intake |
   | Technical | diagnostics, parts used, and progress updates |
   | Logistics | inventory, purchasing, suppliers, and delivery |
   | Finance | payments, invoices, refunds, and financial reports |
   | Human Resources | staff directory, employment records, and attendance |

3. Replace the transitional `isDivisionStaff()` broad-access branch in
   `lib/mektek/permissions.ts` with named capabilities backed by one exhaustive
   central policy map. Preserve `isAdmin` as an unconditional allow for active
   owner accounts.
4. Enforce each capability on the server at the query/action/route boundary before
   using it to filter navigation. Scope database selects so confidential fields are
   never fetched for an unauthorized division.
5. Update `proxy.ts` only as defense in depth; JWT middleware is not sufficient
   because role changes must take effect from current database state.
6. Add denial tests for direct URLs, forged server-action posts, APIs, exports,
   cross-division records, suspended users, and stale JWTs. Add positive tests that
   prove the owner can access every capability.
7. Remove the temporary warning from the staff-management page only after the full
   matrix is enforced and the tests above pass.

## Key files

- `prisma/schema.prisma`, migration `20260720120000_staff_division_foundation`,
  and migration `20260722200000_logistics_staff_area`
- `lib/auth/staff-divisions.ts` — canonical values and labels
- `lib/auth/logistics-staff-areas.ts` — Logistics scope values and labels
- `lib/auth.ts`, `lib/session.ts`, `lib/request-session.ts` — session propagation
- `lib/mektek/staff-auth.ts`, `lib/mektek/post-login-destination.ts` — staff sign-in
- `lib/mektek/permissions.ts` — future central enforcement seam
- `actions/auth/sub-admins.ts` and `app/[locale]/(routes)/mektek/staff/page.tsx`
- `actions/mektek/technicians.ts`, `lib/mektek/technicians.ts`, and
  `app/[locale]/(routes)/mektek/technicians/page.tsx`
