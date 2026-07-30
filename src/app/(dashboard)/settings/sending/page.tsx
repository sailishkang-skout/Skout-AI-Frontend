import { redirect } from "next/navigation";

/** Docs historically used /settings/sending — Deliverability owns inboxes + domains. */
export default function SettingsSendingRedirectPage() {
  redirect("/deliverability");
}
