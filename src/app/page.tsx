import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRoleLandingPath, isRole } from "@/lib/authorization";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session || !isRole(role)) {
    redirect("/sign-in");
  }

  redirect(getRoleLandingPath(role));
}
