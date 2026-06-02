import type { Kit } from "./kits";

const PANINI_CDN = "https://www.panini.co.uk/media/catalog/product";

export const stickerPackets: Kit[] = [
  {
    id: "box50",
    name: "Box of 50 Packets",
    contents: "50 Packets · ~350 stickers",
    description: "50 sealed packets, 7 stickers each",
    price: 49.99,
    oldPrice: 62.50,
    img: `${PANINI_CDN}/0/0/005460box50uk.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "bigbox",
    name: "Big Collector's Box",
    contents: "144 Packets · ~1,008 stickers",
    description: "144 sealed packets, 7 stickers each",
    price: 149.99,
    oldPrice: 185.00,
    img: `${PANINI_CDN}/0/0/005460box144oe_0_en_copy.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "pocketbundle",
    name: "Pocket Tin Bundle",
    contents: "4 Pocket Tins · 32 Packets",
    description: "4 pocket tins, 8 packets each",
    price: 34.99,
    oldPrice: 43.96,
    img: `${PANINI_CDN}/b/u/bundle005460tinp1-4_0.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "tin2",
    name: "Classic Tin — Design 2",
    contents: "16 Packets · ~112 stickers",
    description: "Classic tin with 16 sealed packets",
    price: 14.99,
    oldPrice: 19.99,
    img: `${PANINI_CDN}/0/0/005460tinuk2_1.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "tin3",
    name: "Classic Tin — Design 3",
    contents: "16 Packets · ~112 stickers",
    description: "Classic tin with 16 sealed packets",
    price: 14.99,
    oldPrice: 19.99,
    img: `${PANINI_CDN}/0/0/005460tinuk3_0.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "tin4",
    name: "Classic Tin — Design 4",
    contents: "16 Packets · ~112 stickers",
    description: "Classic tin with 16 sealed packets",
    price: 14.99,
    oldPrice: 19.99,
    img: `${PANINI_CDN}/0/0/005460tinuk4_0.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "tinbundle",
    name: "Classic Tin Bundle",
    contents: "4 Classic Tins · 64 Packets",
    description: "4 classic tins, 16 packets each",
    price: 59.99,
    oldPrice: 79.96,
    img: `${PANINI_CDN}/b/u/bundle005460tinuk1-4_0.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
  {
    id: "ultimatetinbundle",
    name: "Ultimate Tin Bundle",
    contents: "4 Pocket + 4 Classic Tins",
    description: "4 pocket tins + 4 classic tins",
    price: 99.99,
    oldPrice: 123.92,
    img: `${PANINI_CDN}/b/u/bundle005460tinpc8_0.png?quality=80&bg-color=255,255,255&fit=bounds&height=700&width=700&canvas=700:700`,
  },
];

export const packetExtraStickers = new Set(["bigbox"]);
