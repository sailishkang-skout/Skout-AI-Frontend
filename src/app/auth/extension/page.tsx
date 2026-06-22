import { redirect } from "next/navigation";

/** Legacy URL — extension sync now runs automatically on every signed-in Skout page. */
export default function ExtensionAuthRedirectPage() {
  redirect("/dashboard");
}
