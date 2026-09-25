import Product from "../Model/Product.js";

/* =========================================================
   REGEX ESCAPE
========================================================= */

function escapeRegex(text = "") {
  return String(text).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
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
   COMMON STOP WORDS
========================================================= */

const STOP_WORDS = new Set([
  /* =========================
     English
  ========================= */

  "a",
  "an",
  "the",

  "price",
  "prices",
  "priceis",
  "cost",

  "how",
  "much",
  "is",
  "are",
  "was",
  "were",

  "of",
  "this",
  "that",
  "these",
  "those",

  "product",
  "products",

  "available",
  "availability",

  "stock",
  "stocks",

  "have",
  "has",
  "do",
  "does",
  "did",

  "you",
  "your",
  "got",
  "get",
  "can",

  "i",
  "me",
  "my",
  "we",
  "our",

  "want",
  "need",

  "buy",
  "buying",
  "purchase",
  "purchasing",

  "order",
  "ordering",

  "please",
  "plz",
  "pls",

  "give",
  "show",
  "tell",

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

  /* =========================
     Banglish
  ========================= */

  "dam",
  "daam",
  "damm",

  "koto",
  "kotto",
  "kotoo",

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
  "acheki",
  "aseki",

  "pabo",
  "pawa",
  "jabe",

  "lagbe",

  "chai",

  "nibo",
  "nebo",
  "neboo",

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
  "jante",

  "detailsbolo",
  "detailbolo",

  "informationdao",
  "infochai",

  "stockache",
  "stockase",

  "availableki",

  /* =========================
     Bangla
  ========================= */

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
  "পাওয়া",
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
    /* price */

    daam: "dam",
    damm: "dam",

    pricee: "price",
    pric: "price",
    prce: "price",

    /* koto */

    kotoo: "koto",
    kotto: "koto",
    kttu: "koto",

    /* available */

    achee: "ache",
    acce: "ache",
    ase: "ache",
    ashe: "ache",

    availablee: "available",
    availble: "available",
    avaiable: "available",

    /* order */

    nebo: "nibo",
    neboo: "nibo",

    kintechai: "order",
    orderchai: "order",
    orderkorbo: "order",
    orderkortechai: "order",

    /* details */

    detailsbolo: "details",
    detailbolo: "details",

    infochai: "info",
  };

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        replacements[word] || word
    )
    .join(" ");
}

/* =========================================================
   CLEAN USER MESSAGE
========================================================= */

function cleanProductQuery(message = "") {
  let text = normalizeBanglish(message);

  text = text
    /* =========================
       English intent words
    ========================= */

    .replace(
      /\b(price|prices|cost)\b/gi,
      " "
    )

    .replace(
      /\b(stock|stocks|available|availability)\b/gi,
      " "
    )

    .replace(
      /\b(order|ordering|buy|buying|purchase|purchasing)\b/gi,
      " "
    )

    .replace(
      /\b(details?|information|info|specs?|specification|features?)\b/gi,
      " "
    )

    .replace(
      /\b(please|plz|pls|give|show|tell|me)\b/gi,
      " "
    )

    .replace(
      /\b(i|ami|want|need|can|you)\b/gi,
      " "
    )

    /* =========================
       Banglish intent words
    ========================= */

    .replace(
      /\b(dam|daam|taka|tk)\b/gi,
      " "
    )

    .replace(
      /\b(koto|koy|kot|kotodam)\b/gi,
      " "
    )

    .replace(
      /\b(ache|ase|available)\b/gi,
      " "
    )

    .replace(
      /\b(nibo|nebo|kinbo|nite|kinte)\b/gi,
      " "
    )

    .replace(
      /\b(bolen|bolo|bolun|janan|janbo|dekhao)\b/gi,
      " "
    )

    .replace(
      /\b(ami|chai)\b/gi,
      " "
    )

    /* =========================
       Bangla intent words
    ========================= */

    .replace(
      /দাম|কত|কতো|কতদাম|টাকা|মূল্য/g,
      " "
    )

    .replace(
      /স্টক|আছে|অ্যাভেইলেবল/g,
      " "
    )

    .replace(
      /অর্ডার|নিব|নিতে|কিনব|কিনতে/g,
      " "
    )

    .replace(
      /বিস্তারিত|তথ্য|ফিচার|স্পেসিফিকেশন/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();

  return text;
}

/* =========================================================
   GET SEARCH WORDS
========================================================= */

function getSearchWords(message = "") {
  const cleaned =
    cleanProductQuery(message);

  return [
    ...new Set(
      cleaned
        .split(/\s+/)
        .map((word) =>
          word.trim()
        )
        .filter(Boolean)
        .filter(
          (word) =>
            !STOP_WORDS.has(word)
        )
    ),
  ];
}

/* =========================================================
   PRODUCT SEARCH TEXT
========================================================= */

function getProductSearchText(product) {
  return normalizeText(
    [
      product?.name || "",
      product?.brand || "",
      product?.sku || "",
      product?.slug || "",
    ].join(" ")
  );
}

/* =========================================================
   GET PRODUCT NAME WORDS
========================================================= */

function getProductNameWords(product) {
  const name = normalizeText(
    product?.name || ""
  );

  return name
    .split(/\s+/)
    .filter(Boolean);
}

/* =========================================================
   IMPORTANT SEARCH WORD
========================================================= */

function isStrongSearchWord(word = "") {
  const value =
    normalizeText(word);

  if (!value) {
    return false;
  }

  /*
    Number/model থাকলে strong

    যেমন:
    17
    285k
    5090
    s25
  */

  if (/\d/.test(value)) {
    return true;
  }

  /*
    3+ character product word
  */

  if (value.length >= 3) {
    return true;
  }

  return false;
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

  const name =
    normalizeText(product.name || "");

  const brand =
    normalizeText(product.brand || "");

  const sku =
    normalizeText(product.sku || "");

  const slug =
    normalizeText(product.slug || "");

  const productSearchText =
    getProductSearchText(product);

  let score = 0;

  /* =====================================================
     EXACT FULL NAME
  ===================================================== */

  if (
    name ===
    normalizeText(cleanedQuery)
  ) {
    score += 5000;
  }

  /* =====================================================
     QUERY INSIDE PRODUCT NAME
  ===================================================== */

  if (
    cleanedQuery &&
    name.includes(
      normalizeText(cleanedQuery)
    )
  ) {
    score += 2500;
  }

  /* =====================================================
     PRODUCT NAME STARTS WITH QUERY
  ===================================================== */

  if (
    cleanedQuery &&
    name.startsWith(
      normalizeText(cleanedQuery)
    )
  ) {
    score += 1500;
  }

  /* =====================================================
     EXACT SKU
  ===================================================== */

  if (
    sku &&
    sku ===
      normalizeText(cleanedQuery)
  ) {
    score += 5000;
  }

  /* =====================================================
     WORD MATCH
  ===================================================== */

  let matchedWords = 0;

  for (const word of searchWords) {
    const normalizedWord =
      normalizeText(word);

    if (!normalizedWord) {
      continue;
    }

    if (
      name
        .split(/\s+/)
        .includes(normalizedWord)
    ) {
      score += 500;
      matchedWords++;
      continue;
    }

    if (
      name.includes(
        normalizedWord
      )
    ) {
      score += 350;
      matchedWords++;
      continue;
    }

    if (
      brand.includes(
        normalizedWord
      )
    ) {
      score += 250;
      matchedWords++;
      continue;
    }

    if (
      sku.includes(
        normalizedWord
      )
    ) {
      score += 300;
      matchedWords++;
      continue;
    }

    if (
      slug.includes(
        normalizedWord
      )
    ) {
      score += 200;
      matchedWords++;
    }
  }

  /* =====================================================
     ALL WORDS MATCH BONUS
  ===================================================== */

  if (
    searchWords.length > 0 &&
    matchedWords ===
      searchWords.length
  ) {
    score += 2000;
  }

  /* =====================================================
     STRONG MODEL WORD BONUS
  ===================================================== */

  for (const word of searchWords) {
    if (
      isStrongSearchWord(word) &&
      productSearchText.includes(
        normalizeText(word)
      )
    ) {
      score += 400;
    }
  }

  return score;
}

/* =========================================================
   FIND EXACT PRODUCT NAME
========================================================= */

async function findExactProductName(
  cleanedQuery
) {
  if (!cleanedQuery) {
    return [];
  }

  const regex = new RegExp(
    `^${escapeRegex(
      cleanedQuery
    )}$`,
    "i"
  );

  return Product.find({
    isActive: true,
    name: regex,
  }).limit(20);
}

/* =========================================================
   FIND EXACT SKU
========================================================= */

async function findExactSKU(
  cleanedQuery
) {
  if (!cleanedQuery) {
    return null;
  }

  const regex = new RegExp(
    `^${escapeRegex(
      cleanedQuery
    )}$`,
    "i"
  );

  return Product.findOne({
    isActive: true,
    sku: regex,
  });
}

/* =========================================================
   FIND PRODUCTS WHERE ALL WORDS MATCH
========================================================= */

async function findProductsByWords(
  searchWords = []
) {
  if (!searchWords.length) {
    return [];
  }

  const wordConditions =
    searchWords.map((word) => {
      const regex = new RegExp(
        escapeRegex(word),
        "i"
      );

      return {
        $or: [
          {
            name: regex,
          },
          {
            brand: regex,
          },
          {
            sku: regex,
          },
          {
            slug: regex,
          },
        ],
      };
    });

  return Product.find({
    isActive: true,

    $and: wordConditions,
  }).limit(100);
}

/* =========================================================
   FIND PRODUCTS BY STRONG WORDS
========================================================= */

async function findProductsByStrongWords(
  searchWords = []
) {
  const strongWords =
    searchWords.filter(
      isStrongSearchWord
    );

  if (!strongWords.length) {
    return [];
  }

  const conditions =
    strongWords.map((word) => {
      const regex = new RegExp(
        escapeRegex(word),
        "i"
      );

      return {
        $or: [
          {
            name: regex,
          },
          {
            brand: regex,
          },
          {
            sku: regex,
          },
          {
            slug: regex,
          },
        ],
      };
    });

  return Product.find({
    isActive: true,

    $and: conditions,
  }).limit(100);
}

/* =========================================================
   FIND PRODUCTS BY SINGLE STRONG WORD
========================================================= */

async function findProductsBySingleStrongWord(
  searchWords = []
) {
  const strongWords =
    searchWords.filter(
      isStrongSearchWord
    );

  if (
    strongWords.length !== 1
  ) {
    return [];
  }

  const word =
    strongWords[0];

  const regex = new RegExp(
    escapeRegex(word),
    "i"
  );

  return Product.find({
    isActive: true,

    $or: [
      {
        name: regex,
      },
      {
        brand: regex,
      },
      {
        sku: regex,
      },
      {
        slug: regex,
      },
    ],
  }).limit(100);
}

/* =========================================================
   SORT PRODUCTS
========================================================= */

function sortProducts(
  products,
  searchWords,
  cleanedQuery
) {
  return [...products].sort(
    (a, b) => {
      const scoreA =
        calculateProductScore(
          a,
          searchWords,
          cleanedQuery
        );

      const scoreB =
        calculateProductScore(
          b,
          searchWords,
          cleanedQuery
        );

      return (
        scoreB - scoreA
      );
    }
  );
}

/* =========================================================
   REMOVE DUPLICATES
========================================================= */

function removeDuplicateProducts(
  products = []
) {
  const map =
    new Map();

  for (const product of products) {
    if (!product) {
      continue;
    }

    const id =
      String(product._id);

    if (!map.has(id)) {
      map.set(id, product);
    }
  }

  return [
    ...map.values(),
  ];
}

/* =========================================================
   SEARCH MULTIPLE PRODUCTS
========================================================= */

export async function searchProducts(
  message
) {
  const originalText =
    normalizeText(message);

  if (!originalText) {
    return [];
  }

  const normalizedMessage =
    normalizeBanglish(message);

  const cleanedQuery =
    cleanProductQuery(
      normalizedMessage
    );

  const searchWords =
    getSearchWords(
      normalizedMessage
    );

  /* =====================================================
     NOTHING TO SEARCH
  ===================================================== */

  if (
    !searchWords.length ||
    !cleanedQuery
  ) {
    return [];
  }

  /* =====================================================
     1. EXACT PRODUCT NAME

     Example:
     Intel Core Ultra 9 285K Arrow Lake Processor
  ===================================================== */

  let products =
    await findExactProductName(
      cleanedQuery
    );

  if (products.length > 0) {
    return products;
  }

  /* =====================================================
     2. EXACT SKU
  ===================================================== */

  const skuProduct =
    await findExactSKU(
      cleanedQuery
    );

  if (skuProduct) {
    return [
      skuProduct,
    ];
  }

  /* =====================================================
     3. ALL SEARCH WORDS MATCH

     Example:
     iphone 17 pro max

     Must match:
     iphone
     17
     pro
     max
  ===================================================== */

  products =
    await findProductsByWords(
      searchWords
    );

  if (products.length > 0) {
    products =
      sortProducts(
        products,
        searchWords,
        cleanedQuery
      );

    return products;
  }

  /* =====================================================
     4. STRONG WORD MATCH

     Example:
     Intel 285K

     Both Intel + 285K
     must exist.
  ===================================================== */

  products =
    await findProductsByStrongWords(
      searchWords
    );

  if (products.length > 0) {
    products =
      sortProducts(
        products,
        searchWords,
        cleanedQuery
      );

    return products;
  }

  /* =====================================================
     5. SINGLE STRONG WORD

     Example:
     iphone
     samsung
     macbook
     ipad
     airpods
     intel

     This allows category/family search.
  ===================================================== */

  const strongWords =
    searchWords.filter(
      isStrongSearchWord
    );

  if (
    strongWords.length === 1
  ) {
    products =
      await findProductsBySingleStrongWord(
        searchWords
      );

    if (
      products.length > 0
    ) {
      products =
        sortProducts(
          products,
          searchWords,
          cleanedQuery
        );

      return products;
    }
  }

  /* =====================================================
     IMPORTANT

     এখানে ANY WORD SEARCH নেই।

     তাই:

     Intel Core Ultra 9 285K Arrow Lake Processor

     না পেলে TP-Link যেন না আসে।
  ===================================================== */

  return [];
}

/* =========================================================
   SEARCH SINGLE BEST PRODUCT
========================================================= */

export async function searchProduct(
  message
) {
  const products =
    await searchProducts(
      message
    );

  if (
    !products.length
  ) {
    return null;
  }

  return products[0];
}

/* =========================================================
   SEARCH BY PRODUCT NAME ONLY
========================================================= */

export async function searchProductsByName(
  name
) {
  const text =
    normalizeText(name);

  if (!text) {
    return [];
  }

  const regex =
    new RegExp(
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

export async function searchProductsByBrand(
  brand
) {
  const text =
    normalizeText(brand);

  if (!text) {
    return [];
  }

  const regex =
    new RegExp(
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

export async function searchProductBySKU(
  sku
) {
  const text =
    normalizeText(sku);

  if (!text) {
    return null;
  }

  const regex =
    new RegExp(
      `^${escapeRegex(
        text
      )}$`,
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

export function getProductPrice(
  product
) {
  if (!product) {
    return 0;
  }

  /* =====================================================
     VARIANT PRICE
  ===================================================== */

  if (
    Array.isArray(
      product.variants
    ) &&
    product.variants.length > 0
  ) {
    const variant =
      product.variants.find(
        (item) =>
          item &&
          item.price !==
            undefined &&
          item.price !==
            null &&
          Number(
            item.price
          ) > 0
      );

    if (variant) {
      return Number(
        variant.price
      );
    }
  }

  /* =====================================================
     DISCOUNT PRICE
  ===================================================== */

  if (
    product.discountPrice !==
      undefined &&
    product.discountPrice !==
      null &&
    Number(
      product.discountPrice
    ) > 0
  ) {
    return Number(
      product.discountPrice
    );
  }

  /* =====================================================
     REGULAR PRICE
  ===================================================== */

  return Number(
    product.price || 0
  );
}

/* =========================================================
   GET REGULAR PRICE
========================================================= */

export function getRegularProductPrice(
  product
) {
  if (!product) {
    return 0;
  }

  return Number(
    product.price || 0
  );
}

/* =========================================================
   GET DISCOUNT PRICE
========================================================= */

export function getDiscountProductPrice(
  product
) {
  if (!product) {
    return 0;
  }

  return Number(
    product.discountPrice || 0
  );
}

/* =========================================================
   GET STOCK
========================================================= */

export function getProductStock(
  product
) {
  if (!product) {
    return 0;
  }

  return Number(
    product.stock || 0
  );
}

/* =========================================================
   CHECK STOCK
========================================================= */

export function isProductAvailable(
  product
) {
  return (
    getProductStock(
      product
    ) > 0
  );
}

/* =========================================================
   GET NAME
========================================================= */

export function getProductName(
  product
) {
  return (
    product?.name || ""
  );
}

/* =========================================================
   GET BRAND
========================================================= */

export function getProductBrand(
  product
) {
  return (
    product?.brand || ""
  );
}

/* =========================================================
   GET SKU
========================================================= */

export function getProductSKU(
  product
) {
  return (
    product?.sku || ""
  );
}

/* =========================================================
   GET DESCRIPTION
========================================================= */

export function getProductDescription(
  product
) {
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

export function getProductSpecifications(
  product
) {
  if (!product) {
    return null;
  }

  const specifications =
    product.specifications;

  if (!specifications) {
    return null;
  }

  /* Object হলে সরাসরি return */

  if (
    typeof specifications ===
      "object" &&
    !Array.isArray(
      specifications
    )
  ) {
    return specifications;
  }

  /* JSON string হলে parse */

  if (
    typeof specifications ===
    "string"
  ) {
    try {
      return JSON.parse(
        specifications
      );
    } catch {
      return specifications;
    }
  }

  return specifications;
}

/* =========================================================
   GET CATEGORY
========================================================= */

export function getProductCategory(
  product
) {
  if (!product) {
    return null;
  }

  return (
    product.category ||
    null
  );
}

/* =========================================================
   GET IMAGES
========================================================= */

export function getProductImages(
  product
) {
  if (!product) {
    return [];
  }

  return Array.isArray(
    product.images
  )
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