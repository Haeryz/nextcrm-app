jest.mock("@/lib/auth-guards", () => ({
  requireMektekCustomerServiceStaff: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    mektekTechnician: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { requireMektekCustomerServiceStaff } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";
import {
  createMektekTechnician,
  deleteMektekTechnician,
  updateMektekTechnician,
} from "@/actions/mektek/technicians";
import {
  INITIAL_MEKTEK_TECHNICIANS,
  MEKTEK_TECHNICIAN_ROLE_LABELS,
  validateMektekTechnicianIds,
} from "@/lib/mektek/technicians";

const mockedRequireStaff = requireMektekCustomerServiceStaff as jest.Mock;

describe("Mektek technician directory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireStaff.mockResolvedValue({ id: "owner", isAdmin: true });
  });

  it("defines the supplied initial roster exactly", () => {
    expect(INITIAL_MEKTEK_TECHNICIANS).toEqual([
      { name: "Winarto", role: "MECHANIC" },
      { name: "Ahmad", role: "MECHANIC" },
      { name: "Dicko", role: "MECHANIC" },
      { name: "Saryanto", role: "HELPER" },
      { name: "Widodo", role: "MECHANIC" },
      { name: "Yudha", role: "MECHANIC" },
      { name: "Rizki Ridwan", role: "MECHANIC" },
      { name: "Wildan", role: "OJT" },
    ]);
    expect(MEKTEK_TECHNICIAN_ROLE_LABELS.MECHANIC).toBe("Mekanik");
  });

  it("requires one to three unique technician assignments", () => {
    expect(validateMektekTechnicianIds(["a"])).toEqual(["a"]);
    expect(validateMektekTechnicianIds(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(() => validateMektekTechnicianIds([])).toThrow("minimal 1");
    expect(() => validateMektekTechnicianIds(["a", "b", "c", "d"])).toThrow("maksimal 3");
    expect(() => validateMektekTechnicianIds(["a", "a"])).toThrow("berbeda");
  });

  it("creates directory entries without creating login accounts", async () => {
    const form = new FormData();
    form.set("name", "Budi");
    form.set("role", "HELPER");

    await createMektekTechnician(form);

    expect(mockedRequireStaff).toHaveBeenCalled();
    expect(prismadb.mektekTechnician.create).toHaveBeenCalledWith({
      data: { name: "Budi", role: "HELPER", isActive: true },
    });
  });

  it("updates and deletes only directory records after admin authorization", async () => {
    const updateForm = new FormData();
    updateForm.set("id", "technician-id");
    updateForm.set("name", "Budi Updated");
    updateForm.set("role", "MECHANIC");
    updateForm.set("isActive", "false");
    await updateMektekTechnician(updateForm);

    expect(prismadb.mektekTechnician.updateMany).toHaveBeenCalledWith({
      where: { id: "technician-id" },
      data: { name: "Budi Updated", role: "MECHANIC", isActive: false },
    });

    const deleteForm = new FormData();
    deleteForm.set("id", "technician-id");
    await deleteMektekTechnician(deleteForm);
    expect(prismadb.mektekTechnician.deleteMany).toHaveBeenCalledWith({
      where: { id: "technician-id" },
    });
  });

  it("does not mutate when the current user is not authorized", async () => {
    mockedRequireStaff.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    const form = new FormData();
    form.set("name", "Budi");
    form.set("role", "HELPER");

    await expect(createMektekTechnician(form)).rejects.toThrow("NEXT_REDIRECT");
    expect(prismadb.mektekTechnician.create).not.toHaveBeenCalled();
  });
});
