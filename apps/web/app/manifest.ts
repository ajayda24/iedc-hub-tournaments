import type { MetadataRoute } from "next";
import { site } from "@iedc/data/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.defaultTitle,
    short_name: site.shortName,
    description: site.manifestDescription,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: site.themeColor,
    theme_color: site.themeColor,
    categories: ["games", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
