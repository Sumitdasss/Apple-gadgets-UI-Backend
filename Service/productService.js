import Product from "../Model/Product.js";

/* =========================================================
   REGEX ESCAPE
========================================================= */

function escapeRegex(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* =========================================================
   NORMALIZE TEXT
========================================================= */

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[?!.,:;'"`()[\]{}]/g, " ")
    .replace(/\s+/g, " ");
}

/* =========================================================
   COMMON WORDS
========================================================= */

const STOP_WORDS = new Set([
  // English
  "price",
  "prices",
  "priceis",
  "cost",
  "how",
  "much",
  "is",
  "the",
  "of",
  "this",
  "that",
  "product",
  "products",
  "available",
  "availability",
  "stock",
  "have",
  "has",
  "do",
  "you",
  "got",
  "get",
  "can",
  "i",
  "want",
  "need",
  "buy",
  "buying",
  "purchase",
  "order",
  "please",
  "give",
  "show",
  "tell",
  "me",
  "details",
  "detail",
  "information",
  "info",
  "specification",
  "specifications",
  "spec",
  "specs",
  "feature",
  "features",
  "about",
  "for",
  "with",
  "tellme",

  // Banglish
  "dam",
  "daam",
  "damm",
  "koto",
  "kot",
  "koy",
  "kotodam",
  "taka",
  "tk",
  "ache",
  "ase",
  "achi",
  "acche",
  "ashe",
  "pabo",
  "pawa",
  "jabe",
  "lagbe",
  "chai",
  "nibo",
  "nebo",
  "nite",
  "niye",
  "kinbo",
  "kinte",
  "kintechai",
  "orderkorbo",
  "orderchai",
  "orderkortechai",
  "dekhao",
  "bolen",
  "bolo",
  "bolun",
  "janan",
  "janbo",
  "detailsbolo",
  "detailbolo",
  "informationdao",
  "infochai",
  "acheki",
  "aseki",
  "stockache",
  "stockase",

  // Bangla
  "দাম",
  "কত",
  "কতো",
  "কতদাম",
  "টাকা",
  "মূল্য",
  "আছে",
  "আসছে",
  "স্টক",
  "অ্যাভেইলেবল",
  "পাওয়া",
  "পাব",
  "চাই",
  "নিব",
  "নিতে",
  "কিনব",
  "কিনতে",
  "অর্ডার",
  "অর্ডারকরব",
  "অর্ডারকরতে",
  "দেখাও",
  "বলুন",
  "বলো",
  "জানান",
  "জানতে",
  "বিস্তারিত",
  "তথ্য",
  "তথ্যদাও",
  "ফিচার",
  "স্পেসিফিকেশন",
]);

/* =========================================================
   BANGLISH NORMALIZATION
========================================================= */

function normalizeBanglish(text = "") {
  const value = normalizeText(text);

  const replacements = {
    // price
    daam: "dam",
    damm: "dam",
    pricee: "price",
    pric: "price",
    prce: "price",

    // koto
    kotoo: "koto",
    kotto: "koto",
    kttu: "koto",

    // available
    achee: "ache",
    acce: "ache",
    ase: "ache",
    ashe: "ache",
    availablee: "available",
    availble: "available",
    avaiable: "available",

    // order
    nebo: "nibo",
    neboo: "nibo",
    kintechai: "order",
    orderchai: "order",
    orderkorbo: "order",
    orderkortechai: "order",

    // details
    detailsbolo: "details",
    detailbolo: "details",
    infochai: "info",
  };

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => replacements[word] || word)
    .join(" ");
}

/* =========================================================
   CLEAN USER MESSAGE
========================================================= */

function cleanProductQuery(message = "") {
  let text = normalizeBanglish(message);

  text = text
    .replace(/\b(price|prices|cost)\b/gi, " ")
    .replace(/\b(dam|daam|taka|tk)\b/gi, " ")
    .replace(/\b(koto|koy|kot)\b/gi, " ")
    .replace(/\b(stock|available|availability)\b/gi, " ")
    .replace(/\b(ache|ase|available)\b/gi, " ")
    .replace(/\b(order|buy|buying|purchase)\b/gi, " ")
    .replace(/\b(nibo|nebo|kinbo|nite|kinte)\b/gi, " ")
    .replace(/\b(details?|information|info|specs?|specification)\b/gi, " ")
    .replace(/\b(please|plz|pls|give|show|tell|me)\b/gi, " ")
    .replace(/\b(bolen|bolo|bolun|janan|janbo|dekhao)\b/gi, " ")
    .replace(/\b(ami|i|want|need|chai)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

/* =========================================================
   GET SEARCH WORDS
========================================================= */

function getSearchWords(message = "") {
  const cleaned = cleanProductQuery(message);

  return [
    ...new Set(
      cleaned
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean)
        .filter((word) => !STOP_WORDS.has(word))
    ),
  ];
}

/* =========================================================
   GET PRODUCT SEARCH FIELDS
========================================================= */

function getProductSearchText(product) {
  return [
    product.name || "",
    product.brand || "",
    product.sku || "",
    product.slug || "",
  ]
    .join(" ")
    .toLowerCase();
}

/* =========================================================
   SCORE PRODUCT
========================================================= */

function calculateProductScore(
  product,
  searchWords = [],
  cleanedQuery = ""
) {
  if (!product) {
    return 0;
  }

  const name = normalizeText(product.name || "");
  const brand = normalizeText(product.brand || "");
  const sku = normalizeText(product.sku || "");
  const slug = normalizeText(product.slug || "");

  let score = 0;

  /* Exact product name */
  if (name === cleanedQuery) {
    score += 1000;
  }

  /* Cleaned query exists inside name */
  if (cleanedQuery && name.includes(cleanedQuery)) {
    score += 500;
  }

  /* Exact SKU */
  if (sku && sku === cleanedQuery) {
    score += 1000;
  }

  /* Search words */
  for (const word of searchWords) {
    if (name === word) {
      score += 200;
    }

    if (name.includes(word)) {
      score += 100;
    }

    if (brand.includes(word)) {
      score += 60;
    }

    if (sku.includes(word)) {
      score += 80;
    }

    if (slug.includes(word)) {
      score += 50;
    }
  }

  return score;
}

/* =========================================================
   FIND PRODUCTS BY WORDS
========================================================= */

async function findProductsByWords(searchWords = []) {
  if (!searchWords.length) {
    return [];
  }

  const wordConditions = searchWords.map((word) => {
    const regex = new RegExp(escapeRegex(word), "i");

    return {
      $or: [
        { name: regex },
        { brand: regex },
        { sku: regex },
        { slug: regex },
      ],
    };
  });

  return Product.find({
    isActive: true,
    $and: wordConditions,
  }).limit(100);
}

/* =========================================================
   FIND PRODUCTS BY ANY WORD
========================================================= */

async function findProductsByAnyWord(searchWords = []) {
  if (!searchWords.length) {
    return [];
  }

  const conditions = [];

  for (const word of searchWords) {
    const regex = new RegExp(escapeRegex(word), "i");

    conditions.push(
      { name: regex },
      { brand: regex },
      { sku: regex },
      { slug: regex }
    );
  }

  return Product.find({
    isActive: true,
    $or: conditions,
  }).limit(100);
}

/* =========================================================
   SORT PRODUCTS
========================================================= */

function sortProducts(products, searchWords, cleanedQuery) {
  return [...products].sort((a, b) => {
    const scoreA = calculateProductScore(
      a,
      searchWords,
      cleanedQuery
    );

    const scoreB = calculateProductScore(
      b,
      searchWords,
      cleanedQuery
    );

    return scoreB - scoreA;
  });
}

/* =========================================================
   SEARCH MULTIPLE PRODUCTS
========================================================= */

export async function searchProducts(message) {
  const originalText = normalizeText(message);

  if (!originalText) {
    return [];
  }

  const cleanedQuery = cleanProductQuery(message);
  const searchWords = getSearchWords(message);

  console.log("====================================");
  console.log("[Product Search Multiple]");
  console.log("User:", message);
  console.log("Cleaned:", cleanedQuery);
  console.log("Words:", searchWords);

  if (!searchWords.length) {
    return [];
  }

  /* -------------------------------------------------------
     1. ALL WORDS MATCH
     
     Example:
     "iphone 17"
     
     name must contain iphone + 17
  ------------------------------------------------------- */

  let products = await findProductsByWords(searchWords);

  if (products.length > 0) {
    products = sortProducts(
      products,
      searchWords,
      cleanedQuery
    );

    console.log(
      "[Product Search Multiple] Found:",
      products.length
    );

    return products;
  }

  /* -------------------------------------------------------
     2. ANY WORD MATCH
     
     যদি all words না মিলে,
     তাহলে partial search
  ------------------------------------------------------- */

  products = await findProductsByAnyWord(searchWords);

  if (products.length > 0) {
    products = sortProducts(
      products,
      searchWords,
      cleanedQuery
    );

    console.log(
      "[Product Search Multiple] Partial found:",
      products.length
    );

    return products;
  }

  console.log(
    "[Product Search Multiple] No product found"
  );

  return [];
}

/* =========================================================
   SEARCH SINGLE BEST PRODUCT
========================================================= */

export async function searchProduct(message) {
  const products = await searchProducts(message);

  if (!products.length) {
    return null;
  }

  return products[0];
}

/* =========================================================
   SEARCH BY PRODUCT NAME ONLY
========================================================= */

export async function searchProductsByName(name) {
  const text = normalizeText(name);

  if (!text) {
    return [];
  }

  const regex = new RegExp(
    escapeRegex(text),
    "i"
  );

  return Product.find({
    isActive: true,
    name: regex,
  }).limit(100);
}

/* =========================================================
   SEARCH BY BRAND
========================================================= */

export async function searchProductsByBrand(brand) {
  const text = normalizeText(brand);

  if (!text) {
    return [];
  }

  const regex = new RegExp(
    escapeRegex(text),
    "i"
  );

  return Product.find({
    isActive: true,
    brand: regex,
  }).limit(100);
}

/* =========================================================
   SEARCH BY SKU
========================================================= */

export async function searchProductBySKU(sku) {
  const text = normalizeText(sku);

  if (!text) {
    return null;
  }

  const regex = new RegExp(
    `^${escapeRegex(text)}$`,
    "i"
  );

  return Product.findOne({
    isActive: true,
    sku: regex,
  });
}

/* =========================================================
   GET PRODUCT PRICE
========================================================= */

export function getProductPrice(product) {
  if (!product) {
    return 0;
  }

  /* Variant price */
  if (
    Array.isArray(product.variants) &&
    product.variants.length > 0
  ) {
    const variant = product.variants.find(
      (item) =>
        item &&
        item.price !== undefined &&
        item.price !== null &&
        Number(item.price) > 0
    );

    if (variant) {
      return Number(variant.price);
    }
  }

  /* Discount price */
  if (
    product.discountPrice !== undefined &&
    product.discountPrice !== null &&
    Number(product.discountPrice) > 0
  ) {
    return Number(product.discountPrice);
  }

  /* Regular price */
  return Number(product.price || 0);
}

/* =========================================================
   GET REGULAR PRICE
========================================================= */

export function getRegularProductPrice(product) {
  if (!product) {
    return 0;
  }

  return Number(product.price || 0);
}

/* =========================================================
   GET DISCOUNT PRICE
========================================================= */

export function getDiscountProductPrice(product) {
  if (!product) {
    return 0;
  }

  return Number(product.discountPrice || 0);
}

/* =========================================================
   GET STOCK
========================================================= */

export function getProductStock(product) {
  if (!product) {
    return 0;
  }

  return Number(product.stock || 0);
}

/* =========================================================
   CHECK STOCK
========================================================= */

export function isProductAvailable(product) {
  return getProductStock(product) > 0;
}

/* =========================================================
   GET NAME
========================================================= */

export function getProductName(product) {
  return product?.name || "";
}

/* =========================================================
   GET BRAND
========================================================= */

export function getProductBrand(product) {
  return product?.brand || "";
}

/* =========================================================
   GET SKU
========================================================= */

export function getProductSKU(product) {
  return product?.sku || "";
}

/* =========================================================
   GET DESCRIPTION
========================================================= */

export function getProductDescription(product) {
  if (!product) {
    return "";
  }

  return (
    product.shortDescription ||
    product.description ||
    ""
  );
}

/* =========================================================
   GET SPECIFICATIONS
========================================================= */

export function getProductSpecifications(product) {
  if (!product) {
    return null;
  }

  return product.specifications || null;
}

/* =========================================================
   GET CATEGORY
========================================================= */

export function getProductCategory(product) {
  if (!product) {
    return null;
  }

  return product.category || null;
}

/* =========================================================
   GET IMAGES
========================================================= */

export function getProductImages(product) {
  if (!product) {
    return [];
  }

  return Array.isArray(product.images)
    ? product.images
    : [];
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  searchProduct,
  searchProducts,
  searchProductsByName,
  searchProductsByBrand,
  searchProductBySKU,

  getProductPrice,
  getRegularProductPrice,
  getDiscountProductPrice,
  getProductStock,
  isProductAvailable,

  getProductName,
  getProductBrand,
  getProductSKU,
  getProductDescription,
  getProductSpecifications,
  getProductCategory,
  getProductImages,
};