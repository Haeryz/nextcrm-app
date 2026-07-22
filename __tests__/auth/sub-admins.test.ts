jest.mock("@/lib/auth-guards", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/password", () => ({ hashPassword: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { requireAdmin } from "@/lib/auth-guards";
import { hashPassword } from "@/lib/password";
import { prismadb } from "@/lib/prisma";
import {
  createSubAdmin,
  deleteSubAdmin,
  updateSubAdmin,
} from "@/actions/auth/sub-admins";

const mockedRequireAdmin = requireAdmin as jest.Mock;
const mockedHashPassword = hashPassword as jest.Mock;

describe("sub-admin lifecycle actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue({ id: "owner", isAdmin: true });
    mockedHashPassword.mockResolvedValue("hashed-password");
  });

  it("does not mutate when the current user is not a main admin", async () => {
    mockedRequireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    const form = new FormData();
    form.set("name", "Finance Lead");
    form.set("email", "finance@example.com");
    form.set("password", "StrongPassword123!");
    form.set("staffDivision", "FINANCE");

    await expect(createSubAdmin(form)).rejects.toThrow("NEXT_REDIRECT");
    expect(prismadb.users.create).not.toHaveBeenCalled();
  });

  it("creates a non-admin account with a division", async () => {
    const form = new FormData();
    form.set("name", "Finance Lead");
    form.set("email", "FINANCE@example.com");
    form.set("password", "StrongPassword123!");
    form.set("staffDivision", "FINANCE");

    await createSubAdmin(form);

    expect(mockedRequireAdmin).toHaveBeenCalled();
    expect(prismadb.users.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "finance@example.com",
        is_admin: false,
        is_account_admin: false,
        staffDivision: "FINANCE",
        logisticsStaffArea: null,
        userStatus: "ACTIVE",
      }),
    });
  });

  it("updates only non-admin division accounts", async () => {
    const form = new FormData();
    form.set("id", "staff-id");
    form.set("name", "Logistics Lead");
    form.set("email", "logistics@example.com");
    form.set("staffDivision", "LOGISTICS");
    form.set("logisticsStaffArea", "RECEIVING");
    form.set("userStatus", "INACTIVE");

    await updateSubAdmin(form);

    expect(prismadb.users.updateMany).toHaveBeenCalledWith({
      where: {
        id: "staff-id",
        is_admin: false,
        staffDivision: { not: null },
      },
      data: expect.objectContaining({
        staffDivision: "LOGISTICS",
        logisticsStaffArea: "RECEIVING",
        userStatus: "INACTIVE",
        authVersion: { increment: 1 },
      }),
    });
  });

  it("requires an area when assigning the Logistics division", async () => {
    const form = new FormData();
    form.set("name", "Logistics Lead");
    form.set("email", "logistics@example.com");
    form.set("password", "StrongPassword123!");
    form.set("staffDivision", "LOGISTICS");

    await expect(createSubAdmin(form)).rejects.toThrow(
      "Bagian Logistics wajib dipilih.",
    );
    expect(prismadb.users.create).not.toHaveBeenCalled();
  });

  it("deletes only non-admin division accounts", async () => {
    const form = new FormData();
    form.set("id", "staff-id");

    await deleteSubAdmin(form);

    expect(prismadb.users.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "staff-id",
        is_admin: false,
        staffDivision: { not: null },
      },
    });
  });
});
