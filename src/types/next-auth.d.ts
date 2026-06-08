import type { Role } from "@/lib/authorization";

declare module "next-auth" {
  interface Session {
    user?: {
      accountId: string;
      role: Role;
      employeeId: string | null;
    };
  }

  interface User {
    accountId: string;
    role: Role;
    employeeId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountId?: string;
    role?: Role;
    employeeId?: string | null;
  }
}
