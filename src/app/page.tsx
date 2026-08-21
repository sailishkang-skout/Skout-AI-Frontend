import { redirect } from "next/navigation";

export default async function HomePage() {
  if (process.env.E2E_AUTH_BYPASS === "true") {
    redirect("/dashboard");
  }
  redirect("/signin");
}
