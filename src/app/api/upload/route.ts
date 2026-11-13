import { handleUpload } from "@/lib/server/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleUpload;
