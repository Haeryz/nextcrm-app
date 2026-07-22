import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const csEmail = `cs-${runId}@nextcrm.app`;
const technicianEmail = `tech-${runId}@nextcrm.app`;
const password = "password";
const customerPhone = `+62009${runId.replace(/\D/g, "").slice(-8)}`;
const customerName = `Loyalty Customer ${runId}`;
const vehicle = `Loyalty Vehicle ${runId}`;
const completedOrderIds: string[] = [];
let createdOrderId = "";

async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(
    (url) => /^\/(en|cs|de|uk)(\/|$)/.test(url.pathname) && !url.pathname.includes("sign-in"),
    { timeout: 15000 }
  );
}

async function freshContextLogin(
  browserContextFactory: () => Promise<BrowserContext>,
  email: string
) {
  const context = await browserContextFactory();
  const page = await context.newPage();
  await login(page, email);
  return { context, page };
}

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.users.createMany({
    data: [
      {
        email: csEmail,
        name: "MekTek CS",
        password: passwordHash,
        userStatus: "ACTIVE",
        is_admin: false,
        is_account_admin: false,
        mektekRole: "CS",
      },
      {
        email: technicianEmail,
        name: "MekTek Technician",
        password: passwordHash,
        userStatus: "ACTIVE",
        is_admin: false,
        is_account_admin: false,
        mektekRole: "TECHNICIAN",
      },
    ],
  });

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
        title: `MEKTEK Service - Prior ${index}`,
        content: "Prior completed service",
        priority: "medium",
        taskStatus: "COMPLETE",
        tags: {
          module: "mektek",
          vehicle: `Prior ${index}`,
          customerName,
          phone: customerPhone,
          phoneNormalized: customerPhone,
          customerToken: `prior-token-${index}`,
          customerCode: `prior-code-${index}`,
          timeline: [],
          serviceItems: [
            {
              kind: "service",
              source: "manual",
              catalogItemId: null,
              name: "Prior service",
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
  await prisma.users.deleteMany({
    where: {
      email: {
        in: [csEmail, technicianEmail],
      },
    },
  });
  await prisma.$disconnect();
  await pool.end();
});

test("admin sees the dedicated MekTek dashboard", async ({ page }) => {
  await login(page, "admin@nextcrm.app");
  await page.goto("/en/mektek/dashboard");
  await expect(page.getByRole("heading", { name: "MEKTEK Dashboard" })).toBeVisible();
  await expect(page.getByText("Open orders")).toBeVisible();
  await expect(page.getByText("Unpaid balance")).toBeVisible();
});

test("CS creates an order and receives automatic loyalty discount", async ({ browser }) => {
  const { context, page } = await freshContextLogin(() => browser.newContext(), csEmail);
  await page.goto("/en/mektek");
  await expect(page.getByRole("heading", { name: "Buat Order Servis" })).toBeVisible();

  await page.getByLabel("Nama pelanggan").fill(customerName);
  await page.getByLabel("Kendaraan").fill(vehicle);
  await page.getByLabel("Teknisi utama").click();
  await page.getByRole("option", { name: "MekTek Technician" }).click();
  await page.getByLabel("Nomor telepon").fill(customerPhone);
  await page.getByLabel("Keluhan / pekerjaan").fill("Brake inspection");
  await page
    .getByLabel("Harga satuan pekerjaan 1 dalam Rupiah")
    .fill("200000");
  await page.getByRole("button", { name: "Buat Order Servis" }).click();

  await expect(page.getByText("Service order created")).toBeVisible();
  await expect(
    page.getByText("Silver discount applied automatically: 5%")
  ).toBeVisible();

  const createdOrder = await prisma.crm_Accounts_Tasks.findFirst({
    where: {
      title: `MEKTEK Service - ${vehicle}`,
    },
    select: {
      id: true,
      tags: true,
      assigned_user: {
        select: {
          email: true,
        },
      },
    },
  });
  expect(createdOrder?.id).toBeTruthy();
  createdOrderId = createdOrder!.id;
  const tags = createdOrder?.tags as Record<string, unknown>;
  expect(tags.completedVisitCount).toBe(3);
  expect(tags.loyaltyTier).toBe("Silver");
  expect(tags.loyaltyDiscountRate).toBe(5);
  expect(tags.discount).toBe(10000);
  expect(createdOrder?.assigned_user?.email).toBe(technicianEmail);

  await page.goto(`/en/mektek/${createdOrderId}`);
  await expect(page.getByText("MekTek Technician")).toBeVisible();
  await expect(page.getByText("Docs")).toBeVisible();
  await expect(page.getByText("WhatsApp")).toBeVisible();
  await expect(page.getByText("Payment")).toHaveCount(0);
  await expect(page.getByText("kunjungan selesai")).toBeVisible();
  await context.close();
});

test("technician can update progress but cannot create orders or edit payment", async ({ browser }) => {
  const { context, page } = await freshContextLogin(() => browser.newContext(), technicianEmail);

  await page.goto("/en/mektek");
  await expect(page.getByText("Only MekTek admin or CS can add new service records.")).toBeVisible();

  await page.goto(`/en/mektek/${createdOrderId}`);
  await expect(page.getByRole("heading", { name: "Service Order" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add timeline" })).toBeVisible();
  await expect(page.getByText("Payment")).toHaveCount(0);
  await expect(page.getByText("WhatsApp")).toHaveCount(0);
  await context.close();
});
