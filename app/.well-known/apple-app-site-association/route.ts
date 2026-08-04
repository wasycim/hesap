import { NextResponse } from "next/server"

export async function GET() {
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: "W3LUPU3AAL.wasy.system.hesap",
          paths: ["/mesai-qr/*", "/terminal*", "/qr*"]
        }
      ]
    }
  }

  return NextResponse.json(aasa, {
    headers: {
      "Content-Type": "application/json"
    }
  })
}
