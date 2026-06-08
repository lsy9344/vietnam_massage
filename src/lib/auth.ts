import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateAccount, isAccountRole, SAFE_AUTH_ERROR_MESSAGE } from "@/modules/masters/account-service";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in"
  },
  providers: [
    CredentialsProvider({
      name: "직원 계정",
      credentials: {
        identity: { label: "이메일 또는 계정 ID", type: "text" },
        password: { label: "비밀번호", type: "password" }
      },
      async authorize(credentials) {
        const identity = credentials?.identity?.trim();
        const password = credentials?.password;
        if (!identity || !password) {
          throw new Error(SAFE_AUTH_ERROR_MESSAGE);
        }

        const account = await authenticateAccount(identity, password);
        if (!account) {
          throw new Error(SAFE_AUTH_ERROR_MESSAGE);
        }

        return {
          id: account.id,
          accountId: account.accountId,
          role: account.role,
          employeeId: account.employeeId
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accountId = user.accountId;
        token.role = user.role;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.accountId !== "string" || !isAccountRole(token.role)) {
        return {
          ...session,
          user: undefined
        };
      }

      return {
        ...session,
        user: {
          accountId: token.accountId,
          role: token.role,
          employeeId: typeof token.employeeId === "string" ? token.employeeId : null
        }
      };
    }
  }
};
