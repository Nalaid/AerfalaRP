import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing image id." }, { status: 400 });

  try {
    const img = await db.generatedImage.findUnique({ where: { id } });
    if (!img) return NextResponse.json({ error: "Image not found." }, { status: 404 });

    const bytes = Buffer.from(img.data, "base64");
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": img.mimeType || "image/png",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load image." },
      { status: 500 }
    );
  }
}
