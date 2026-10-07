import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brain Arena · IEDC",
    short_name: "Brain Arena",
    description: "Live logic-game tournaments for IEDC events.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffbf2",
    theme_color: "#fffbf2",
    categories: ["games", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
