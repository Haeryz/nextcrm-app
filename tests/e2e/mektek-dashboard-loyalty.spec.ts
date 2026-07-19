import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const customerPhone = `+62008${runId.replace(/\D/g, "").slice(-8)}`;
const customerName = `Dashboard Loyalty ${runId}`;
const vehicle = `Dashboard Vehicle ${runId}`;
const completedOrderIds: string[] = [];
let createdOrderId = "";

test.beforeAll(async () => {
  const customer = await prisma.catalogCustomer.create({
    data: {
      username: customerName,
      phone: customerPhone,
      phoneNormalized: customerPhone,
    },
  });

  for (let index = 0; index < 3; index++) {
    const order = await prisma.crm_Accounts_Tasks.create({
      data: {
        v: 0,
        title: `MEKTEK Service - Seed ${index}`,
        content: "Completed seed order",
        priority: "medium",
        taskStatus: "COMPLETE",
        tags: {
          module: "mektek",
          vehicle: `Seed ${index}`,
          customerName,
          phone: customerPhone,
          phoneNormalized: customerPhone,
          customerToken: `seed-token-${index}`,
          customerCode: `seed-code-${index}`,
          timeline: [],
          serviceItems: [
            {
              kind: "service",
              source: "manual",
              catalogItemId: null,
              name: "Seed service",
              machine: null,
              partNumber: null,
              catalogPartNumber: null,
              quantity: 1,
              unit: "JOB",
              unitPrice: 100000,
              total: 100000,
            },
          ],
          sparepartItems: [],
        },
      },
    });
    completedOrderIds.push(order.id);
    await prisma.catalogServiceLink.create({
      data: {
        customerId: customer.id,
        serviceOrderId: order.id,
        source: "ADMIN_ASSIGN",
      },
    });
  }
});

test.afterAll(async () => {
  if (createdOrderId) {
    await prisma.catalogServiceLink.deleteMany({
      where: { serviceOrderId: createdOrderId },
    });
    await prisma.crm_Accounts_Tasks.deleteMany({
      where: { id: createdOrderId },
    });
  }
  await prisma.catalogServiceLink.deleteMany({
    where: { serviceOrderId: { in: completedOrderIds } },
  });
  await prisma.crm_Accounts_Tasks.deleteMany({
    where: { id: { in: completedOrderIds } },
  });
  await prisma.catalogCustomer.deleteMany({
    where: { phoneNormalized: customerPhone },
  });
  await prisma.$disconnect();
  await pool.end();
});

test("dashboard loads and loyalty discount applies automatically", async ({ page }) => {
  await page.goto("/en/mektek/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "MEKTEK Dashboard" })).toBeVisible();
  await expect(page.getByText("Open orders")).toBeVisible();
  await expect(page.getByText("Unpaid balance")).toBeVisible();

  await page.goto("/en/mektek", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.getByPlaceholder("Customer name").fill(customerName);
  await page.getByPlaceholder(/Vehicle/).fill(vehicle);
  await page.getByPlaceholder("Phone").fill(customerPhone);
  await page.getByPlaceholder(/Kerusakan #1/).fill("Brake inspection");
  await page.getByPlaceholder(" (Rp)").first().fill("200000");
  await page.getByRole("button", { name: "Add Service" }).click();

  await expect(page.getByText("Service order created")).toBeVisible();
  await expect(
    page.getByText("Silver discount applied automatically: 5%")
  ).toBeVisible();

  const createdOrder = await prisma.crm_Accounts_Tasks.findFirst({
    where: { title: `MEKTEK Service - ${vehicle}` },
    select: { id: true, tags: true },
  });
  expect(createdOrder?.id).toBeTruthy();
  createdOrderId = createdOrder!.id;
  const tags = createdOrder?.tags as Record<string, unknown>;
  expect(tags.completedVisitCount).toBe(3);
  expect(tags.loyaltyTier).toBe("Silver");
  expect(tags.loyaltyDiscountRate).toBe(5);
  expect(tags.discount).toBe(10000);
});
