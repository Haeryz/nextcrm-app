jest.mock("@/lib/prisma", () => ({
  prismadb: {
    catalogInquiry: {
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/session", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import { updateCatalogInquiryDiscount } from "@/actions/catalog/admin";

describe("updateCatalogInquiryDiscount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "admin-1",
        isAdmin: true,
      },
    });
  });

  it("stores a valid whole-number discount and revalidates admin/customer pages", async () => {
    (prismadb.catalogInquiry.update as jest.Mock).mockResolvedValue({});

    const result = await updateCatalogInquiryDiscount({
      inquiryId: "inquiry-1",
      discountPercent: "15",
    });

    expect(result).toEqual({ data: true });
    expect(prismadb.catalogInquiry.update).toHaveBeenCalledWith({
      where: {
        id: "inquiry-1",
      },
      data: {
        discountPercent: 15,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/catalog-inquiries");
    expect(revalidatePath).toHaveBeenCalledWith("/customer/profile");
  });

  it.each(["-1", "101", "2.5"])("rejects invalid discount %s", async (discountPercent) => {
    const result = await updateCatalogInquiryDiscount({
      inquiryId: "inquiry-1",
      discountPercent,
    });

    expect(result).toEqual({
      error: "Discount must be a whole number from 0 to 100.",
    });
    expect(prismadb.catalogInquiry.update).not.toHaveBeenCalled();
  });
});
