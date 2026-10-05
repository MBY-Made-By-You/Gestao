import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MBY Gestão",
    short_name: "Gestão",
    description: "Projetos, finanças e equipe da MBY — Made By You.",
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070b",
    theme_color: "#05070b",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Projetos", url: "/projects", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Calendário", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Financeiro", url: "/finance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
