jest.mock("@/lib/auth-guards", () => ({ requireAdmin: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    logisticsPic: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    logisticsReceipt: { count: jest.fn() },
  },
}));

import {
  createMektekLogisticsPic,
  deleteMektekLogisticsPic,
  updateMektekLogisticsPic,
} from "@/actions/mektek/logistics-pics";
import { requireAdmin } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mockedRequireAdmin = requireAdmin as jest.Mock;

describe("MekTek Logistics PIC directory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue({ id: "owner", isAdmin: true });
    (prismadb.logisticsReceipt.count as jest.Mock).mockResolvedValue(0);
  });

  it("creates and updates PICs after main-admin authorization", async () => {
    const createForm = new FormData();
    createForm.set("name", "PIC 4");
    await createMektekLogisticsPic(createForm);
    expect(prismadb.logisticsPic.create).toHaveBeenCalledWith({
      data: { name: "PIC 4", isActive: true },
    });

    const updateForm = new FormData();
    updateForm.set("id", "pic-4");
    updateForm.set("name", "Warehouse Lead");
    updateForm.set("isActive", "false");
    await updateMektekLogisticsPic(updateForm);
    expect(prismadb.logisticsPic.update).toHaveBeenCalledWith({
      where: { id: "pic-4" },
      data: { name: "Warehouse Lead", isActive: false },
    });
    expect(mockedRequireAdmin).toHaveBeenCalledTimes(2);
  });

  it("deletes only unused PICs and preserves shipment history", async () => {
    const form = new FormData();
    form.set("id", "pic-4");
    await deleteMektekLogisticsPic(form);
    expect(prismadb.logisticsPic.delete).toHaveBeenCalledWith({
      where: { id: "pic-4" },
    });

    jest.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue({ id: "owner", isAdmin: true });
    (prismadb.logisticsReceipt.count as jest.Mock).mockResolvedValue(2);
    await expect(deleteMektekLogisticsPic(form)).rejects.toThrow("Nonaktifkan PIC");
    expect(prismadb.logisticsPic.delete).not.toHaveBeenCalled();
  });

  it("does not mutate when the current user is not the main admin", async () => {
    mockedRequireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    const form = new FormData();
    form.set("name", "Unauthorized PIC");

    await expect(createMektekLogisticsPic(form)).rejects.toThrow("NEXT_REDIRECT");
    expect(prismadb.logisticsPic.create).not.toHaveBeenCalled();
  });

  it("makes the PIC save action prominent and shows pending feedback", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/[locale]/(routes)/mektek/logistics/pics/page.tsx"),
      "utf8",
    );

    expect(source).toContain('idleLabel="Simpan Perubahan"');
    expect(source).toContain('pendingLabel="Menyimpan..."');
    expect(source).not.toContain('variant="secondary">Simpan');
  });
});
