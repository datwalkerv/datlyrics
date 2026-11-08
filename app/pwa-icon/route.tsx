import { renderIcon } from "./render";

export async function GET(req: Request) {
  const size = new URL(req.url).searchParams.get("size") === "512" ? 512 : 192;
  return renderIcon(size);
}
