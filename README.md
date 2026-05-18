# Mektek Core

This app now contains only the Mektek workflow:

- Dashboard
- Orders
- WhatsApp

Supporting code remains only where those features need it: authentication, customer tracking links, invoice/receipt generation, catalog-item lookup, and WhatsApp delivery.

## Development

```bash
pnpm install
pnpm dev
```

## Verification

```bash
pnpm exec prisma validate
pnpm exec tsc --noEmit
pnpm test -- --runTestsByPath __tests__/mektek/permissions.test.ts __tests__/mektek/items.test.ts __tests__/mektek/loyalty.test.ts __tests__/mektek/public-status.test.ts __tests__/mektek/dashboard.test.ts
```
