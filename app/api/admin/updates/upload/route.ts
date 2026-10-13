import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { pipeline } from "stream/promises"
import { Readable } from "stream"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("x-admin-token")
    const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || !secretKey || !authHeader.includes(secretKey)) {
      return NextResponse.json({ error: "Yetkisiz erisim." }, { status: 401 })
    }

    const filename = request.nextUrl.searchParams.get("filename") || "Hesap-Setup-9.9.5.exe"
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ error: "Gecersiz dosya adi." }, { status: 400 })
    }

    const chunkParam = request.nextUrl.searchParams.get("chunk")
    const chunkIndex = chunkParam !== null ? parseInt(chunkParam, 10) : null

    if (!request.body) {
      return NextResponse.json({ error: "Gonderilen veri bos." }, { status: 400 })
    }

    const targetDir = path.join(process.cwd(), "public", "updates")
    fs.mkdirSync(targetDir, { recursive: true })

    const targetPath = path.join(targetDir, filename)
    // @ts-expect-error Readable.fromWeb Web ReadableStream compatibility
    const nodeReadable = Readable.fromWeb(request.body)

    const flags = chunkIndex !== null && chunkIndex > 0 ? "a" : "w"
    await pipeline(nodeReadable, fs.createWriteStream(targetPath, { flags }))

    const stats = fs.statSync(targetPath)
    return NextResponse.json({
      ok: true,
      filename,
      chunk: chunkIndex,
      currentSize: stats.size,
      message: "Chunk basariyla kaydedildi.",
    })
  } catch (error) {
    console.error("Updates upload failed:", error)
    return NextResponse.json(
      { error: "Yukleme basarisiz oldu", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
