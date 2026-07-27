import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { StaffDivision } from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import type { StaffCapability } from "@/lib/auth/staff-capabilities";

type UserId = string;

declare module "next-auth/jwt" {
  interface JWT {
    id: UserId;
    isAdmin: boolean;
    mektekRole?: "CS" | "TECHNICIAN" | null;
    staffDivision?: StaffDivision | null;
    logisticsStaffArea?: LogisticsStaffArea | null;
    staffCapabilities?: StaffCapability[];
    phone?: string | null;
    phoneNormalized?: string | null;
    authVersion?: number;
  }
}

declare module "next-auth" {
  interface Session {
    user: User & {
      id: UserId;
      _id: UserId;
      avatar?: string | null | undefined;
      isAdmin: boolean;
      mektekRole?: "CS" | "TECHNICIAN" | null;
      staffDivision?: StaffDivision | null;
      logisticsStaffArea?: LogisticsStaffArea | null;
      staffCapabilities?: StaffCapability[];
      phone?: string | null;
      phoneNormalized?: string | null;
      userLanguage: string;
      userStatus: string;
    };
  }
}
