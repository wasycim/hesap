import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hesap Rapor Sistemi",
    short_name: "Hesap Rapor",
    description: "Hesap ve finansal rapor yönetim sistemi",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: "/w-logo-light.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/w-logo-dark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/iconw.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        src: "/iconw2.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  }
}
