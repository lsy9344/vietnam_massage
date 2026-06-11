import { redirect } from "next/navigation";
import { getRoleLandingPath, getAuthorizedAccount } from "@/lib/authorization";

export default async function Home() {
  const account = await getAuthorizedAccount();
  const role = account?.role;

  if (!role || !account) {
    redirect("/sign-in");
  }

  redirect(getRoleLandingPath(role));
}
