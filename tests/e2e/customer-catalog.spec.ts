import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

test.describe.configure({ mode: "serial" });

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const customerUsername = `e2e-customer-${runId}`;
const customerPhone = `+62000${runId.replace(/\D/g, "").slice(-8)}`;
const customerPhoneNormalized = customerPhone;
const itemId = `e2e-catalog-${runId}`;
const machine = `E2E-MACHINE-${runId}`;
const description = `E2E Compressor ${runId}`;
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let imageId = "";

test.beforeAll(async () => {
  await prisma.catalogInquiry.deleteMany({
    where: {
      customer: {
        phoneNormalized: customerPhoneNormalized,
      },
    },
  });
  await prisma.catalogCustomerSession.deleteMany({
    where: {
      customer: {
        phoneNormalized: customerPhoneNormalized,
      },
    },
  });
  await prisma.catalogCustomer.deleteMany({
    where: {
      phoneNormalized: customerPhoneNormalized,
    },
  });
  await prisma.catalogItem.deleteMany({
    where: {
      id: itemId,
    },
  });

  const image = await prisma.catalogImage.create({
    data: {
      mimeType: "image/png",
      bytes: imageBytes,
    },
    select: {
      id: true,
    },
  });
  imageId = image.id;

  await prisma.catalogItem.create({
    data: {
      id: itemId,
      machine,
      rowNumber: 1,
      illustration: "1",
      partNumber: "E2E-ORIGINAL",
      catalogPartNumber: "E2E-MEKTEK",
      description,
      quantity: "1",
      price: 123456,
      remark: "Seeded by Playwright",
      searchText: `${machine} e2e-original e2e-mektek ${description}`.toLowerCase(),
      imageId,
    },
  });

  await prisma.catalogCustomer.create({
    data: {
      username: customerUsername,
      phone: customerPhone,
      phoneNormalized: customerPhoneNormalized,
    },
  });
});

test.afterAll(async () => {
  await prisma.catalogInquiry.deleteMany({
    where: {
      customer: {
        phoneNormalized: customerPhoneNormalized,
      },
    },
  });
  await prisma.catalogCustomerSession.deleteMany({
    where: {
      customer: {
        phoneNormalized: customerPhoneNormalized,
      },
    },
  });
  await prisma.catalogCustomer.deleteMany({
    where: {
      phoneNormalized: customerPhoneNormalized,
    },
  });
  await prisma.catalogItem.deleteMany({
    where: {
      id: itemId,
    },
  });
  if (imageId) {
    await prisma.catalogImage.deleteMany({
      where: {
        id: imageId,
      },
    });
  }
  await prisma.$disconnect();
  await pool.end();
});

test("requires an existing database customer for login", async ({ page }) => {
  await page.goto("/customer");
  await expect(page.getByText("Customer login")).toBeVisible();

  await page.getByLabel("Username").fill(`missing-${runId}`);
  await page.getByLabel("Phone number").fill("+629999999");
  await page.getByRole("button", { name: /^Login$/ }).last().click();

  await expect(page.getByText(/Customer account not found/i)).toBeVisible();
  await expect(page.getByText("Customer login")).toBeVisible();
});

test("logs in, browses DB catalogue, opens detail, submits inquiry, and shows profile history", async ({
  page,
}) => {
  await page.goto("/customer");
  await page.getByLabel("Username").fill(customerUsername);
  await page.getByLabel("Phone number").fill(customerPhone);
  await page.getByRole("button", { name: /^Login$/ }).last().click();

  await expect(page.getByText("Parts catalogue")).toBeVisible();
  await expect(page.getByText(`${customerUsername} · ${customerPhone}`)).toBeVisible();

  await page.getByPlaceholder("Search description or part number").fill(description);
  const itemLink = page.locator(`a[href="/customer/catalog/${itemId}"]`).last();
  await expect(itemLink).toBeVisible();
  await expect(page.getByText("E2E-MEKTEK").first()).toBeVisible();

  const imageResponse = await page.request.get(`/api/catalog/images/${imageId}`);
  expect(imageResponse.ok()).toBeTruthy();
  expect(imageResponse.headers()["content-type"]).toContain("image/png");

  await itemLink.click();
  await expect(page).toHaveURL(new RegExp(`/customer/catalog/${itemId}`));
  await expect(page.getByText(description).first()).toBeVisible();
  await expect(page.getByText("E2E-ORIGINAL")).toBeVisible();

  await page.getByRole("button", { name: /Add to inquiry/i }).click();
  await expect(page.getByText("Added to inquiry list.")).toBeVisible();
  await page.getByPlaceholder("Optional note for admin").fill(`E2E inquiry ${runId}`);
  await page.getByRole("button", { name: /Submit inquiry/i }).click();
  await expect(page.getByText("Inquiry submitted. Admin will follow up.")).toBeVisible();

  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/customer\/profile/);
  await expect(page.getByText("Profile").first()).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(`E2E inquiry ${runId}`)).toBeVisible();

  const inquiryCount = await prisma.catalogInquiry.count({
    where: {
      customer: {
        phoneNormalized: customerPhoneNormalized,
      },
    },
  });
  expect(inquiryCount).toBe(1);
});
