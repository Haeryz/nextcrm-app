import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const customerName = `E2E MekTek ${runId}`;
const customerPhone = `+62001${runId.replace(/\D/g, "").slice(-8)}`;
const customerPhoneNormalized = customerPhone;
const vehicle = `E2E Vehicle ${runId}`;
const serviceName = `Tune up ${runId}`;
const manualPartName = `Manual filter ${runId}`;
const catalogItemId = `e2e-mektek-part-${runId}`;
const catalogPartName = `Catalog brake pad ${runId}`;
const machine = `E2E-MEKTEK-${runId}`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let createdOrderId = "";

test.beforeAll(async () => {
  await prisma.catalogItem.create({
    data: {
      id: catalogItemId,
      machine,
      rowNumber: 1,
      description: catalogPartName,
      quantity: "1",
      price: 125000,
      searchText: `${machine} ${catalogPartName}`.toLowerCase(),
    },
  });
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

  await prisma.catalogCustomer.deleteMany({
    where: { phoneNormalized: customerPhoneNormalized },
  });
  await prisma.catalogItem.deleteMany({
    where: { id: catalogItemId },
  });
  await prisma.$disconnect();
  await pool.end();
});

test("creates split MekTek items and streams tracking updates live", async ({ page, browser }) => {
  await page.goto("/mektek");

  await page.getByPlaceholder("Customer name").fill(customerName);
  await page.getByPlaceholder(/Vehicle/).fill(vehicle);
  await page.getByPlaceholder("Phone").fill(customerPhone);
  await page.getByPlaceholder(/Kerusakan #1/).fill(serviceName);
  await page.getByPlaceholder("Estimasi biaya (Rp)").first().fill("200000");

  await page.getByPlaceholder("Search catalog item...").fill(machine);
  await page
    .getByPlaceholder("Search catalog item...")
    .locator("..")
    .getByRole("button", { name: /^Search$/ })
    .click();
  await expect(page.getByText(catalogPartName)).toBeVisible();
  await page.getByRole("button", { name: /^Add$/ }).click();

  await page.getByRole("button", { name: "Tambah sparepart" }).click();
  const sparepartInputs = page.getByPlaceholder(/Sparepart #/);
  await sparepartInputs.last().fill(manualPartName);
  await page.getByPlaceholder("Estimasi biaya (Rp)").last().fill("50000");

  await page.getByRole("button", { name: "Add Service" }).click();
  await expect(page.getByText("Service order created")).toBeVisible();

  const trackingLinkValue = await page
    .locator('input[readonly]')
    .last()
    .inputValue();
  expect(trackingLinkValue).toContain("/s/");

  const order = await prisma.crm_Accounts_Tasks.findFirst({
    where: {
      title: `MEKTEK Service - ${vehicle}`,
    },
    select: {
      id: true,
      tags: true,
    },
  });
  expect(order?.id).toBeTruthy();
  createdOrderId = order!.id;

  const tags = order?.tags as Record<string, unknown>;
  expect(Array.isArray(tags.serviceItems)).toBeTruthy();
  expect(Array.isArray(tags.sparepartItems)).toBeTruthy();

  await page.goto(`/mektek/${createdOrderId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Service & Sparepart")).toBeVisible();
  await expect(page.getByText(serviceName, { exact: true })).toBeVisible();
  await expect(page.getByText(catalogPartName, { exact: true })).toBeVisible();
  await expect(page.getByText(manualPartName, { exact: true })).toBeVisible();

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const customerConsoleErrors: string[] = [];
  customerPage.on("console", (message) => {
    if (message.type() === "error") {
      customerConsoleErrors.push(message.text());
    }
  });

  const streamRequestPromise = customerPage.waitForRequest((request) =>
    request.url().includes(`/api/mektek/service-orders/${createdOrderId}/stream`)
  );
  await customerPage.goto(trackingLinkValue);
  await expect(customerPage.getByText("MEKTEK Service Status")).toBeVisible();
  await expect(customerPage.getByText("Subtotal sparepart")).toBeVisible();
  const streamRequest = await streamRequestPromise;
  expect(streamRequest.url()).toContain("/stream?token=");
  expect(customerConsoleErrors).toEqual([]);

  const updateText = `Live update ${runId}`;
  await page.getByPlaceholder("Contoh: Sparepart sudah dipasang").fill(updateText);
  await page.getByRole("button", { name: "Add timeline" }).click();

  await expect(customerPage.getByText(updateText)).toHaveCount(2, {
    timeout: 10000,
  });
  await customerContext.close();
});
