import { redirect } from "next/navigation";

/** Evidence gaps now live on the Technology Map ("Coverage gaps" tab). */
export default function EvidenceGapsRedirectPage() {
  redirect("/technology-map?tab=gaps");
}
