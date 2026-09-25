import Product from "../Model/Product.js";

// Regex Special Characters Escape করার ফাংশন
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchProduct(message) {
  const text = message?.trim();

  if (!text) {
    return null;
  }

  // ১. পুরো নাম, ব্র্যান্ড অথবা SKU দিয়ে সার্চ
  const exactRegex = new RegExp(escapeRegex(text), "i");

  let product = await Product.findOne({
    isActive: true,
    $or: [
      { name: exactRegex },
      { brand: exactRegex },
      { sku: exactRegex },
      { "variants.sku": exactRegex },
    ],
  });

  if (product) {
    return product;
  }

  // ২. পৃথক শব্দগুলো দিয়ে Multi-field Search
  const words = text.split(/\s+/).filter((word) => word.length > 2);

  if (words.length > 0) {
    const wordConditions = words.map((word) => {
      const wordRegex = new RegExp(escapeRegex(word), "i");
      return {
        $or: [
          { name: wordRegex },
          { brand: wordRegex },
          { sku: wordRegex },
          { sizes: wordRegex },
          { ram: wordRegex },
          { "colors.name": wordRegex },
          { "variants.ram": wordRegex },
          { "variants.storage": wordRegex },
        ],
      };
    });

    product = await Product.findOne({
      isActive: true,
      $and: wordConditions,
    });
  }

  return product;
}

export function getProductPrice(product) {
  if (!product) return 0;

  // যদি ভ্যারিয়েন্টের আলাদা প্রাইস থেকে থাকে
  if (product.variants && product.variants.length > 0 && product.variants[0].price) {
    return product.variants[0].price;
  }

  // ডিসকাউন্ট প্রাইস থাকলে
  if (product.discountPrice && product.discountPrice > 0) {
    return product.discountPrice;
  }

  return product.price || 0;
}

export default {
  searchProduct,
  getProductPrice,
};