export type Kit = {
  id: string;
  name: string;
  contents: string;
  description: string;
  price: number;
  oldPrice: number;
  img: string;
  badge?: {
    text: string;
    colorClass: string;
  };
};

export const kits: Kit[] = [
  {
    id: "basico",
    name: "Starter Kit",
    contents: "Album + 10 Packs",
    description: "Hardcover album + starter collection (~70 stickers)",
    price: 16.99,
    oldPrice: 24.99,
    img: "/assets/kit-basico-new.png",
  },
  {
    id: "iniciante",
    name: "Collector Kit",
    contents: "Album + 30 Packs",
    description: "Hardcover album + 1 sealed box (~210 stickers)",
    price: 34.99,
    oldPrice: 49.99,
    img: "/assets/kit-iniciante-new.png",
  },
  {
    id: "campeao",
    name: "Champion Kit",
    contents: "Album + 60 Packs",
    description: "Hardcover album + 2 sealed boxes (~420 stickers)",
    price: 64.99,
    oldPrice: 89.99,
    img: "/assets/kit-campeao-new.png",
    badge: {
      text: "BEST SELLER",
      colorClass: "bg-red-600 text-white",
    },
  },
  {
    id: "colecionador",
    name: "Mega Collector",
    contents: "Album + 90 Packs",
    description: "Hardcover album + 3 sealed boxes (~630 stickers)",
    price: 89.99,
    oldPrice: 129.99,
    img: "/assets/kit-colecionador-new.png",
    badge: {
      text: "BEST VALUE",
      colorClass: "bg-green-600 text-white",
    },
  },
  {
    id: "dourada",
    name: "Golden Edition",
    contents: "Gold Album + 180 Packs",
    description: "Gold hardcover album + 6 sealed boxes (~1,260 stickers)",
    price: 179.99,
    oldPrice: 249.99,
    img: "/assets/kit-capa-dourada.png",
    badge: {
      text: "EXCLUSIVE",
      colorClass: "bg-gradient-to-r from-yellow-500 to-yellow-300 text-black font-bold",
    },
  },
  {
    id: "estadio",
    name: "Stadium Limited Edition",
    contents: "Stadium Box + 250 Packs",
    description: "Numbered limited edition box + 250 sealed packs (~1,750 stickers)",
    price: 249.99,
    oldPrice: 349.99,
    img: "/assets/kit-estadio-new.png",
    badge: {
      text: "LIMITED EDITION",
      colorClass: "bg-gradient-to-r from-amber-700 to-yellow-400 text-white font-bold",
    },
  },
];
