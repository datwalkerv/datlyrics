import type { NextRequest } from "next/server";
import { importList } from "@/lib/import-source";
import { parseImportUrl } from "@/lib/parse-youtube-url";

export async function GET(req: NextRequest) {
  const target = parseImportUrl(req.nextUrl.searchParams.get("url")?.slice(0, 300) ?? "");
  if (!target) return Response.json({ error: "unsupported link" }, { status: 400 });
  try {
    return Response.json(await importList(target));
  } catch {
    return Response.json({ error: "import failed" }, { status: 502 });
  }
}
