import { prismadb } from "@/lib/prisma";
import resendHelper from "@/lib/resend";

import { passwordReset } from "@/actions/auth/password-reset";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/resend", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  generateRandomPassword: jest.fn(() => "generated-password"),
}));

jest.mock("@/emails/PasswordReset", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async () => "hashed-password"),
}));

const mockedPrisma = prismadb as unknown as {
  users: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};
const mockedResendHelper = resendHelper as jest.Mock;

describe("passwordReset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not reset admin account passwords from the public flow", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue({
      id: "admin-id",
      email: "admin@example.com",
      is_admin: true,
    });

    const result = await passwordReset("admin@example.com");

    expect(result).toEqual({
      error: "Admin passwords cannot be reset from the public reset flow",
    });
    expect(mockedResendHelper).not.toHaveBeenCalled();
    expect(mockedPrisma.users.update).not.toHaveBeenCalled();
  });
});
