import { redirect } from "next/navigation";

/** Canonical login is /app (this app's "/"). */
export default function LoginAliasPage() {
  redirect("/");
}
