import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Gecersiz dosya adi" }, { status: 400 })
  }

  // Look in public/updates first, then updates-storage or root/updates
  const candidates = [
    path.join(process.cwd(), "public", "updates", filename),
    path.join(process.cwd(), "updates", filename),
    path.join("/app", "updates", filename),
  ]

  let filePath: string | null = null
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      filePath = candidate
      break
    }
  }

  if (!filePath) {
    return NextResponse.json(
      {
        error: "Guncelleme dosyasi bulunamadi",
        filename,
        message: "Henuz bu surum icin dosya yuklenmedi.",
      },
      { status: 404 }
    )
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const range = request.headers.get("range")

  const isYml = filename.endsWith(".yml") || filename.endsWith(".yaml")
  const isExe = filename.endsWith(".exe")

  const contentType = isYml
    ? "text/yaml; charset=utf-8"
    : isExe
      ? "application/octet-stream"
      : "application/octet-stream"

  const cacheControl = isYml
    ? "no-cache, no-store, must-revalidate"
    : "public, max-age=31536000, immutable"

  // Support HTTP range requests (required by electron-updater for large files)
  if (range && isExe) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = end - start + 1

    const fileStream = fs.createReadStream(filePath, { start, end })

    // @ts-expect-error Node stream to Web ReadableStream
    return new NextResponse(fileStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    })
  }

  const fileStream = fs.createReadStream(filePath)

  // @ts-expect-error Node stream to Web ReadableStream
  return new NextResponse(fileStream, {
    status: 200,
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  })
}
