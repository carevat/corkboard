import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
const MAX_BYTES = 18 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.includes(":")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const parts = host.split(".").map(Number);
      if (parts.some((n) => n > 255) || parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 ||
        (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)) return null;
    }
    return url;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  let target = safeUrl(request.nextUrl.searchParams.get("url") ?? "");
  if (!target) return Response.json({ error: "A public HTTP image URL is required." }, { status: 400 });
  try {
    for (let redirects = 0; redirects < 4; redirects++) {
      const response: Response = await fetch(target.toString(), {
        redirect: "manual", signal: AbortSignal.timeout(12000),
        headers: { Accept: "image/png,image/jpeg,image/webp,image/gif;q=0.9,*/*;q=0.1", "User-Agent": "TheBlackArchive/1.0 (image evidence import)" },
        cache: "no-store",
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        target = location ? safeUrl(new URL(location, target).toString()) : null;
        if (!target) return Response.json({ error: "The image redirected to an unsafe address." }, { status: 400 });
        continue;
      }
      if (!response.ok) return Response.json({ error: `The image host responded with ${response.status}.` }, { status: 422 });
      const type = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
      if (!ACCEPTED.has(type)) return Response.json({ error: "That URL did not return a PNG, JPEG, WebP, or GIF image." }, { status: 415 });
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_BYTES) return Response.json({ error: "The image is over the 18 MB limit." }, { status: 413 });
      if (!response.body) throw new Error("The image response was empty.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); return Response.json({ error: "The image is over the 18 MB limit." }, { status: 413 }); }
        chunks.push(value);
      }
      const blob = new Blob(chunks.map((chunk) => Uint8Array.from(chunk).buffer), { type });
      return new Response(blob, { headers: { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return Response.json({ error: "The image redirected too many times." }, { status: 422 });
  } catch {
    return Response.json({ error: "Could not retrieve that image. Try downloading it and uploading the file instead." }, { status: 422 });
  }
}
