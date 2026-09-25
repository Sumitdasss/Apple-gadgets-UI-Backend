import Customer from "../Model/Customer.js";
import Conversation from "../Model/Conversation.js";
import Order from "../Model/Order.js";
import Product from "../Model/Product.js";

import {
  searchProduct,
  searchProducts,
  getProductPrice,
  getProductStock,
  getProductDescription,
  getProductSpecifications,
} from "./productService.js";

import sendMessage from "./messengerService.js";

/* =========================================================
   CONFIG
========================================================= */

const priceFormatter = new Intl.NumberFormat("en-BD");

const MAX_NAME_LENGTH = 80;
const MAX_PHONE_LENGTH = 20;
const MAX_ADDRESS_LENGTH = 500;

const MAX_QUANTITY = 20;
const MAX_PRODUCT_RESULTS = 10;

/* =========================================================
   BASIC HELPERS
========================================================= */

function formatPrice(price) {
  return priceFormatter.format(Number(price) || 0);
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function containsAny(text, words = []) {
  const normalizedText = normalize(text);

  return words.some((word) =>
    normalizedText.includes(normalize(word))
  );
}

/* =========================================================
   INTENT HELPERS
========================================================= */

function isGreeting(text) {
  return containsAny(text, [
    "hi",
    "hello",
    "hey",
    "হাই",
    "হ্যালো",
    "আসসালামু",
    "আসসালামু আলাইকুম",
    "salam",
    "assalamualaikum",
  ]);
}

function isCancel(text) {
  return containsAny(text, [
    "cancel",
    "বাতিল",
    "বাদ",
    "থাক",
    "না লাগবে",
    "order cancel",
    "অর্ডার বাতিল",
    "cancel order",
  ]);
}

function isConfirmation(text) {
  const value = normalize(text);

  return [
    "yes",
    "y",
    "হ্যাঁ",
    "হ্যা",
    "জি",
    "জ্বি",
    "confirm",
    "confirmed",
    "ok",
    "okay",
    "ঠিক আছে",
    "ঠিকআছে",
    "অর্ডার করুন",
    "নিশ্চিত",
    "নিশ্চিত করুন",
  ].includes(value);
}

function isNegativeConfirmation(text) {
  const value = normalize(text);

  return [
    "no",
    "n",
    "না",
    "cancel",
    "বাতিল",
    "বাদ",
  ].includes(value);
}

function wantsOrder(text) {
  return containsAny(text, [
    "order",
    "অর্ডার",
    "নিব",
    "নিতে চাই",
    "আমি order করতে চাই",
    "আমি অর্ডার করতে চাই",
    "কিনব",
    "কিনতে চাই",
    "buy",
    "purchase",
    "buying",
    "kinbo",
    "kinte chai",
    "nibo",
    "nite chai",
  ]);
}

function asksPrice(text) {
  return containsAny(text, [
    "price",
    "দাম",
    "কত",
    "মূল্য",
    "টাকা",
    "cost",
    "dam",
    "daam",
    "koto",
  ]);
}

function asksStock(text) {
  return containsAny(text, [
    "stock",
    "available",
    "availability",
    "আছে",
    "অ্যাভেইলেবল",
    "স্টক",
    "মজুদ",
    "ache",
    "ase",
  ]);
}

function asksProductInfo(text) {
  return containsAny(text, [
    "details",
    "detail",
    "information",
    "info",
    "specification",
    "specifications",
    "specs",
    "বিস্তারিত",
    "তথ্য",
    "ফিচার",
    "স্পেসিফিকেশন",
  ]);
}

/* =========================================================
   PURE INTENT CHECK
========================================================= */

function isOnlyDetailsRequest(text) {
  return [
    "details",
    "detail",
    "info",
    "information",
    "spec",
    "specs",
    "specification",
    "specifications",
    "বিস্তারিত",
    "তথ্য",
    "ফিচার",
    "স্পেসিফিকেশন",
  ].includes(normalize(text));
}

function isOnlyPriceRequest(text) {
  return [
    "price",
    "দাম",
    "মূল্য",
    "cost",
    "dam",
    "daam",
    "koto",
    "কত",
  ].includes(normalize(text));
}

function isOnlyStockRequest(text) {
  return [
    "stock",
    "available",
    "availability",
    "আছে",
    "স্টক",
    "ache",
    "ase",
  ].includes(normalize(text));
}

/* =========================================================
   CUSTOMER + CONVERSATION
========================================================= */

async function getCustomerAndConversation(messengerId) {
  let customer = await Customer.findOne({
    messengerId,
  });

  if (!customer) {
    customer = await Customer.create({
      messengerId,
      source: "facebook_messenger",
    });
  }

  let conversation = await Conversation.findOne({
    messengerId,
  });

  if (!conversation) {
    conversation = await Conversation.create({
      messengerId,
      customer: customer._id,
      state: "idle",
      product: null,
      productName: "",
      quantity: 1,
      color: "",
      size: "",
      temporaryOrder: {},
    });
  }

  return {
    customer,
    conversation,
  };
}

/* =========================================================
   RESET CONVERSATION
========================================================= */

async function resetConversation(conversation) {
  conversation.state = "idle";

  conversation.product = null;
  conversation.productName = "";

  conversation.quantity = 1;

  conversation.color = "";
  conversation.size = "";

  conversation.temporaryOrder = {};

  await conversation.save();
}

/* =========================================================
   CURRENT PRODUCT
========================================================= */

async function getConversationProduct(conversation) {
  if (!conversation?.product) {
    return null;
  }

  const product = await Product.findOne({
    _id: conversation.product,
    isActive: true,
  });

  return product || null;
}

/* =========================================================
   SAVE SELECTED PRODUCT
========================================================= */

async function saveSelectedProduct(
  conversation,
  product
) {
  if (!product) {
    return;
  }

  conversation.product = product._id;

  conversation.productName =
    product.name;

  if (
    !conversation.quantity ||
    Number(conversation.quantity) < 1
  ) {
    conversation.quantity = 1;
  }

  await conversation.save();
}

/* =========================================================
   PRODUCT PRICE
========================================================= */

function getProductDisplayPrice(product) {
  return getProductPrice(product);
}

/* =========================================================
   PRODUCT REPLY
========================================================= */

function buildProductReply(product) {
  const price = getProductDisplayPrice(product);
  const stock = getProductStock(product);

  let reply =
    `📱 ${product.name}\n\n` +
    `💰 Price: ৳${formatPrice(price)}\n`;

  if (
    product.discountPrice &&
    product.discountPrice > 0 &&
    product.price &&
    product.discountPrice < product.price
  ) {
    reply +=
      `🏷️ Regular Price: ৳${formatPrice(
        product.price
      )}\n`;
  }

  reply +=
    `📦 Stock: ${
      stock > 0
        ? `Available (${stock} pcs)`
        : "Out of Stock"
    }\n`;

  if (product.brand) {
    reply +=
      `🏷️ Brand: ${product.brand}\n`;
  }

  if (product.sku) {
    reply +=
      `🔖 SKU: ${product.sku}\n`;
  }

  reply +=
    `\nআপনি চাইলে এই product-এর details জানতে পারেন অথবা order করতে পারেন। 😊\n\n` +
    `উদাহরণ:\n` +
    `"details"\n` +
    `"আমি order করতে চাই"`;

  return reply;
}

/* =========================================================
   MULTIPLE PRODUCTS
========================================================= */

function buildMultipleProductReply(products) {
  const limitedProducts =
    products.slice(
      0,
      MAX_PRODUCT_RESULTS
    );

  let reply =
    `📱 Product Found\n\n`;

  limitedProducts.forEach(
    (product, index) => {
      const price =
        getProductPrice(product);

      const stock =
        getProductStock(product);

      reply +=
        `${index + 1}. ${product.name}\n` +
        `💰 Price: ৳${formatPrice(price)}\n` +
        `📦 Stock: ${
          stock > 0
            ? `${stock} pcs`
            : "Out of Stock"
        }\n`;

      if (product.brand) {
        reply +=
          `🏷️ Brand: ${product.brand}\n`;
      }

      reply += `\n`;
    }
  );

  if (
    products.length >
    MAX_PRODUCT_RESULTS
  ) {
    reply +=
      `আরও product আছে। নির্দিষ্ট product-এর নাম লিখুন।\n\n`;
  }

  reply +=
    `কোন product সম্পর্কে জানতে চান তার নাম লিখুন। 😊`;

  return reply;
}

/* =========================================================
   PRODUCT DETAILS
========================================================= */

function buildProductDetailsReply(product) {
  const price =
    getProductPrice(product);

  const stock =
    getProductStock(product);

  let reply =
    `📱 ${product.name}\n\n` +
    `💰 Price: ৳${formatPrice(price)}\n`;

  if (
    product.discountPrice &&
    product.price &&
    product.discountPrice <
      product.price
  ) {
    reply +=
      `🏷️ Regular Price: ৳${formatPrice(
        product.price
      )}\n`;
  }

  reply +=
    `📦 Stock: ${
      stock > 0
        ? `Available (${stock} pcs)`
        : "Out of Stock"
    }\n`;

  if (product.brand) {
    reply +=
      `🏷️ Brand: ${product.brand}\n`;
  }

  if (product.sku) {
    reply +=
      `🔖 SKU: ${product.sku}\n`;
  }

  const description =
    getProductDescription(product);

  if (description) {
    reply +=
      `\n📝 Description:\n${description}\n`;
  }

  const specifications =
    getProductSpecifications(product);

  if (specifications) {
    reply +=
      `\n⚙️ Specifications:\n`;

    if (
      typeof specifications ===
        "object" &&
      !Array.isArray(specifications)
    ) {
      Object.entries(
        specifications
      ).forEach(
        ([key, value]) => {
          reply +=
            `• ${key}: ${value}\n`;
        }
      );
    } else if (
      Array.isArray(specifications)
    ) {
      specifications.forEach(
        (item) => {
          if (
            item &&
            typeof item ===
              "object"
          ) {
            const key =
              item.key ||
              item.name ||
              item.title;

            const value =
              item.value ||
              item.description ||
              "";

            if (key) {
              reply +=
                `• ${key}: ${value}\n`;
            } else {
              reply +=
                `• ${JSON.stringify(
                  item
                )}\n`;
            }
          } else {
            reply +=
              `• ${item}\n`;
          }
        }
      );
    } else {
      reply +=
        `${specifications}\n`;
    }
  }

  reply +=
    `\n🛒 Order করতে চাইলে লিখুন:\n` +
    `"আমি order করতে চাই"`;

  return reply;
}

/* =========================================================
   ORDER SUMMARY
========================================================= */

function buildOrderSummary({
  product,
  quantity,
  customer,
}) {
  const price =
    getProductDisplayPrice(product);

  const total =
    price * quantity;

  return (
    `🧾 Order Summary\n\n` +

    `📱 Product:\n` +
    `${product.name}\n\n` +

    `🔢 Quantity:\n` +
    `${quantity}\n\n` +

    `💰 Unit Price:\n` +
    `৳${formatPrice(price)}\n\n` +

    `💵 Total:\n` +
    `৳${formatPrice(total)}\n\n` +

    `👤 Name:\n` +
    `${customer.name || ""}\n\n` +

    `📞 Phone:\n` +
    `${customer.phone || ""}\n\n` +

    `📍 Delivery Address:\n` +
    `${customer.address || ""}\n\n` +

    `-------------------------\n\n` +

    `অর্ডারটি confirm করতে লিখুন:\n` +
    `YES\n\n` +

    `অথবা বাতিল করতে লিখুন:\n` +
    `NO`
  );
}

/* =========================================================
   NAME VALIDATION
========================================================= */

function isValidName(name) {
  const value =
    String(name || "").trim();

  if (!value) {
    return false;
  }

  if (value.length < 2) {
    return false;
  }

  if (
    value.length >
    MAX_NAME_LENGTH
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   PHONE
========================================================= */

function normalizePhone(phone) {
  return String(phone || "")
    .replace(/[^\d+]/g, "")
    .trim();
}

function isValidPhone(phone) {
  const value =
    normalizePhone(phone);

  const bdPhoneRegex =
    /^(?:\+?880|0)1[3-9]\d{8}$/;

  return bdPhoneRegex.test(value);
}

/* =========================================================
   QUANTITY
========================================================= */

function extractQuantity(text) {
  const value =
    normalize(text);

  const match =
    value.match(/\d+/);

  if (!match) {
    return null;
  }

  const quantity =
    Number(match[0]);

  if (
    !Number.isInteger(quantity)
  ) {
    return null;
  }

  if (
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    return null;
  }

  return quantity;
}

/* =========================================================
   MAIN CHATBOT
========================================================= */

export async function handleMessage(
  messengerId,
  message
) {
  try {
    /* =====================================================
       EMPTY MESSAGE
    ===================================================== */

    if (
      !message ||
      !message.trim()
    ) {
      return;
    }

    const rawText =
      message.trim();

    const text =
      normalize(rawText);

    console.log(
      "===================================="
    );

    console.log(
      `[Chatbot] ${messengerId}: ${rawText}`
    );

    /* =====================================================
       CUSTOMER + CONVERSATION
    ===================================================== */

    const {
      customer,
      conversation,
    } =
      await getCustomerAndConversation(
        messengerId
      );

    console.log(
      "[Chatbot State Before]:",
      conversation.state
    );

    console.log(
      "[Chatbot Selected Product]:",
      conversation.product
        ? String(
            conversation.product
          )
        : "NONE"
    );

    /* =====================================================
       GLOBAL CANCEL
    ===================================================== */

    if (
      conversation.state !==
        "idle" &&
      isCancel(text)
    ) {
      await resetConversation(
        conversation
      );

      return sendMessage(
        messengerId,

        `ঠিক আছে 😊\n\n` +
          `আপনার বর্তমান order process বাতিল করা হয়েছে।\n\n` +
          `আপনি চাইলে আবার যেকোনো product-এর নাম লিখে শুরু করতে পারেন।`
      );
    }

    /* =====================================================
       WAITING QUANTITY
    ===================================================== */

    if (
      conversation.state ===
      "waiting_quantity"
    ) {
      const quantity =
        extractQuantity(
          rawText
        );

      if (!quantity) {
        return sendMessage(
          messengerId,

          `দয়া করে ১ থেকে ${MAX_QUANTITY}-এর মধ্যে একটি quantity লিখুন। 😊\n\n` +
            `উদাহরণ:\n2`
        );
      }

      const product =
        await getConversationProduct(
          conversation
        );

      if (!product) {
        await resetConversation(
          conversation
        );

        return sendMessage(
          messengerId,

          `দুঃখিত 😔\n\n` +
            `এই productটি এখন পাওয়া যাচ্ছে না।`
        );
      }

      const stock =
        getProductStock(product);

      if (stock <= 0) {
        await resetConversation(
          conversation
        );

        return sendMessage(
          messengerId,

          `দুঃখিত 😔\n\n` +
            `${product.name} বর্তমানে Out of Stock।`
        );
      }

      if (
        quantity > stock
      ) {
        return sendMessage(
          messengerId,

          `দুঃখিত 😊\n\n` +
            `${product.name}-এর available stock হলো ${stock} pcs।\n\n` +
            `আপনি সর্বোচ্চ ${Math.min(
              stock,
              MAX_QUANTITY
            )} pcs নিতে পারবেন।\n\n` +
            `আবার quantity লিখুন।`
        );
      }

      conversation.quantity =
        quantity;

      conversation.state =
        "waiting_name";

      await conversation.save();

      const price =
        getProductPrice(product);

      const total =
        price * quantity;

      return sendMessage(
        messengerId,

        `ঠিক আছে! 😊\n\n` +

          `📱 Product:\n` +
          `${product.name}\n\n` +

          `🔢 Quantity:\n` +
          `${quantity} pcs\n\n` +

          `💰 Unit Price:\n` +
          `৳${formatPrice(price)}\n\n` +

          `💵 Product Total:\n` +
          `৳${formatPrice(total)}\n\n` +

          `এখন আপনার নামটি লিখুন।\n\n` +

          `উদাহরণ:\n` +
          `Sumit Das`
      );
    }

    /* =====================================================
       WAITING NAME
    ===================================================== */

    if (
      conversation.state ===
      "waiting_name"
    ) {
      if (
        !isValidName(rawText)
      ) {
        return sendMessage(
          messengerId,

          `দুঃখিত 😊\n\n` +
            `আপনার নামটি একটু পরিষ্কারভাবে লিখুন।\n\n` +
            `উদাহরণ:\nSumit Das`
        );
      }

      customer.name =
        rawText;

      conversation.state =
        "waiting_phone";

      await customer.save();
      await conversation.save();

      return sendMessage(
        messengerId,

        `ধন্যবাদ, ${customer.name} 😊\n\n` +
          `এখন আপনার মোবাইল নম্বরটি দিন।\n\n` +
          `উদাহরণ:\n01712345678`
      );
    }

    /* =====================================================
       WAITING PHONE
    ===================================================== */

    if (
      conversation.state ===
      "waiting_phone"
    ) {
      const phone =
        normalizePhone(
          rawText
        );

      if (
        phone.length >
          MAX_PHONE_LENGTH ||
        !isValidPhone(phone)
      ) {
        return sendMessage(
          messengerId,

          `দুঃখিত 😊\n\n` +
            `একটি সঠিক বাংলাদেশি মোবাইল নম্বর দিন।\n\n` +
            `উদাহরণ:\n01712345678`
        );
      }

      customer.phone =
        phone;

      conversation.state =
        "waiting_address";

      await customer.save();
      await conversation.save();

      return sendMessage(
        messengerId,

        `ধন্যবাদ 😊\n\n` +
          `এখন আপনার সম্পূর্ণ delivery address লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `House 10, Road 5, Dhanmondi, Dhaka`
      );
    }

    /* =====================================================
       WAITING ADDRESS
    ===================================================== */

    if (
      conversation.state ===
      "waiting_address"
    ) {
      if (
        rawText.length < 5 ||
        rawText.length >
          MAX_ADDRESS_LENGTH
      ) {
        return sendMessage(
          messengerId,

          `দয়া করে আপনার সম্পূর্ণ delivery address লিখুন। 😊\n\n` +
            `উদাহরণ:\n` +
            `House 10, Road 5, Dhanmondi, Dhaka`
        );
      }

      customer.address =
        rawText;

      const product =
        await getConversationProduct(
          conversation
        );

      if (!product) {
        await resetConversation(
          conversation
        );

        return sendMessage(
          messengerId,

          `দুঃখিত 😔\n\n` +
            `এই productটি এখন আর available নেই।`
        );
      }

      const quantity =
        Number(
          conversation.quantity ||
            1
        );

      const stock =
        getProductStock(product);

      if (
        stock < quantity
      ) {
        await resetConversation(
          conversation
        );

        return sendMessage(
          messengerId,

          `দুঃখিত 😔\n\n` +
            `${product.name}-এর বর্তমানে পর্যাপ্ত stock নেই।\n\n` +
            `Available stock: ${stock} pcs`
        );
      }

      await customer.save();

      conversation.state =
        "waiting_confirmation";

      await conversation.save();

      return sendMessage(
        messengerId,

        buildOrderSummary({
          product,
          quantity,
          customer,
        })
      );
    }

    /* =====================================================
       WAITING CONFIRMATION
    ===================================================== */

    if (
      conversation.state ===
      "waiting_confirmation"
    ) {
      if (
        isConfirmation(text)
      ) {
        const product =
          await getConversationProduct(
            conversation
          );

        if (!product) {
          await resetConversation(
            conversation
          );

          return sendMessage(
            messengerId,

            `দুঃখিত 😔\n\n` +
              `এই productটি এখন আর available নেই।`
          );
        }

        const stock =
          getProductStock(product);

        const quantity =
          Number(
            conversation.quantity ||
              1
          );

        if (
          stock < quantity
        ) {
          await resetConversation(
            conversation
          );

          return sendMessage(
            messengerId,

            `দুঃখিত 😔\n\n` +
              `${product.name}-এর পর্যাপ্ত stock নেই।\n\n` +
              `Available stock: ${stock} pcs`
          );
        }

        const price =
          getProductPrice(product);

        const total =
          price * quantity;

        const orderId =
          `ORD-${Date.now()}`;

        const order =
          await Order.create({
            orderId,

            customer:
              customer._id,

            products: [
              {
                product:
                  product._id,

                name:
                  product.name,

                price,

                quantity,

                color:
                  conversation.color ||
                  "",

                size:
                  conversation.size ||
                  "",
              },
            ],

            totalAmount:
              total,

            deliveryAddress:
              customer.address,

            phone:
              customer.phone,

            status:
              "pending",

            source:
              "facebook_messenger",
          });

        console.log(
          "[Chatbot] Order Created:",
          order.orderId
        );

        /* -----------------------------------------------
           DECREASE STOCK
        ------------------------------------------------ */

        product.stock =
          Math.max(
            0,
            stock - quantity
          );

        await product.save();

        await resetConversation(
          conversation
        );

        return sendMessage(
          messengerId,

          `✅ Order Successfully Placed!\n\n` +

            `🆔 Order ID:\n` +
            `#${order.orderId}\n\n` +

            `📱 Product:\n` +
            `${product.name}\n\n` +

            `🔢 Quantity:\n` +
            `${quantity}\n\n` +

            `💰 Total Amount:\n` +
            `৳${formatPrice(total)}\n\n` +

            `📦 Status:\n` +
            `Pending\n\n` +

            `ধন্যবাদ আমাদের সাথে অর্ডার করার জন্য। ❤️\n\n` +

            `আমাদের team খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে।`
        );
      }

      if (
        isNegativeConfirmation(
          text
        )
      ) {
        await resetConversation(
          conversation
        );

        return sendMessage(
          messengerId,

          `ঠিক আছে 😊\n\n` +
            `আপনার order বাতিল করা হয়েছে।\n\n` +
            `আপনি চাইলে অন্য কোনো product-এর নাম লিখে নতুন করে শুরু করতে পারেন।`
        );
      }

      return sendMessage(
        messengerId,

        `আপনার orderটি confirm করতে:\n\n` +
          `✅ YES\n\n` +
          `অথবা\n\n` +
          `❌ NO\n\n` +
          `লিখুন।`
      );
    }

    /* =====================================================
       GREETING
    ===================================================== */

    if (
      isGreeting(text)
    ) {
      return sendMessage(
        messengerId,

        `Assalamu Alaikum! 😊\n\n` +
          `স্বাগতম আমাদের store-এ। ❤️\n\n` +
          `আমি আপনাকে সাহায্য করতে পারি:\n\n` +
          `📱 Product Information\n` +
          `💰 Product Price\n` +
          `📦 Stock Availability\n` +
          `🛒 Product Order\n\n` +
          `আপনি যে productটি খুঁজছেন তার নাম লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `iPhone 17 Pro Max`
      );
    }

    /* =====================================================
       DETAILS OF SELECTED PRODUCT
    ===================================================== */

    if (
      isOnlyDetailsRequest(
        text
      )
    ) {
      const currentProduct =
        await getConversationProduct(
          conversation
        );

      if (currentProduct) {
        return sendMessage(
          messengerId,

          buildProductDetailsReply(
            currentProduct
          )
        );
      }

      return sendMessage(
        messengerId,

        `অবশ্যই 😊\n\n` +
          `আপনি কোন product-এর information জানতে চান?\n\n` +
          `Product-এর নাম লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `iPhone 17 Pro Max`
      );
    }

    /* =====================================================
       PRICE OF SELECTED PRODUCT
    ===================================================== */

    if (
      isOnlyPriceRequest(
        text
      )
    ) {
      const currentProduct =
        await getConversationProduct(
          conversation
        );

      if (currentProduct) {
        const price =
          getProductPrice(
            currentProduct
          );

        const stock =
          getProductStock(
            currentProduct
          );

        return sendMessage(
          messengerId,

          `📱 ${currentProduct.name}\n\n` +
            `💰 Price: ৳${formatPrice(
              price
            )}\n\n` +
            `📦 Stock: ${
              stock > 0
                ? `Available (${stock} pcs)`
                : "Out of Stock"
            }`
        );
      }

      return sendMessage(
        messengerId,

        `অবশ্যই 😊\n\n` +
          `আপনি কোন product-এর price জানতে চান?\n\n` +
          `উদাহরণ:\n` +
          `iPhone 17 Pro Max`
      );
    }

    /* =====================================================
       STOCK OF SELECTED PRODUCT
    ===================================================== */

    if (
      isOnlyStockRequest(
        text
      )
    ) {
      const currentProduct =
        await getConversationProduct(
          conversation
        );

      if (currentProduct) {
        const stock =
          getProductStock(
            currentProduct
          );

        return sendMessage(
          messengerId,

          `📱 ${currentProduct.name}\n\n` +
            `📦 Stock: ${
              stock > 0
                ? `Available (${stock} pcs)`
                : "Out of Stock"
            }`
        );
      }

      return sendMessage(
        messengerId,

        `জি 😊\n\n` +
          `আপনি কোন product-এর stock জানতে চান?\n\n` +
          `Product-এর নাম লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `iPhone 17 Pro Max`
      );
    }

    /* =====================================================
       ORDER INTENT
    ===================================================== */

    if (
      wantsOrder(text)
    ) {
      console.log(
        "[Chatbot] ORDER INTENT"
      );

      let product = null;

      /* Existing selected product */

      if (
        conversation.product
      ) {
        product =
          await getConversationProduct(
            conversation
          );

        console.log(
          "[Order] Existing product:",
          product?.name ||
            "NOT FOUND"
        );
      }

      /* Search product */

      if (!product) {
        product =
          await searchProduct(
            rawText
          );

        console.log(
          "[Order] Search product:",
          product?.name ||
            "NOT FOUND"
        );
      }

      /* Product not found */

      if (!product) {
        return sendMessage(
          messengerId,

          `অবশ্যই 😊\n\n` +
            `আপনি কোন productটি অর্ডার করতে চান?\n\n` +
            `Product-এর নাম লিখুন।\n\n` +
            `উদাহরণ:\n` +
            `iPhone 17 Pro Max`
        );
      }

      const stock =
        getProductStock(product);

      if (stock <= 0) {
        return sendMessage(
          messengerId,

          `দুঃখিত 😔\n\n` +
            `${product.name} বর্তমানে Out of Stock।\n\n` +
            `অন্য কোনো product-এর নাম লিখে চেষ্টা করতে পারেন।`
        );
      }

      /* Save product */

      conversation.product =
        product._id;

      conversation.productName =
        product.name;

      conversation.quantity =
        1;

      conversation.state =
        "waiting_quantity";

      await conversation.save();

      const price =
        getProductPrice(product);

      return sendMessage(
        messengerId,

        `জি অবশ্যই! 😊\n\n` +

          `📱 Product:\n` +
          `${product.name}\n\n` +

          `💰 Unit Price:\n` +
          `৳${formatPrice(price)}\n\n` +

          `📦 Available Stock:\n` +
          `${stock} pcs\n\n` +

          `🔢 আপনি কতটি নিতে চান?\n\n` +

          `১ থেকে ${Math.min(
            stock,
            MAX_QUANTITY
          )} এর মধ্যে quantity লিখুন।\n\n` +

          `উদাহরণ:\n2`
      );
    }

    /* =====================================================
       PRODUCT SEARCH
    ===================================================== */

    console.log(
      "[Chatbot] PRODUCT SEARCH:",
      rawText
    );

    const products =
      await searchProducts(
        rawText
      );

    console.log(
      "[Chatbot] Products Found:",
      products.map(
        (p) => ({
          id: p?._id,
          name: p?.name,
          price: p?.price,
          discountPrice:
            p?.discountPrice,
          stock: p?.stock,
          isActive:
            p?.isActive,
        })
      )
    );

    /* =====================================================
       SINGLE PRODUCT
    ===================================================== */

    if (
      products.length === 1
    ) {
      const product =
        products[0];

      await saveSelectedProduct(
        conversation,
        product
      );

      console.log(
        "[Chatbot] Selected Product Saved:",
        product.name
      );

      if (
        asksProductInfo(text)
      ) {
        return sendMessage(
          messengerId,

          buildProductDetailsReply(
            product
          )
        );
      }

      if (
        asksStock(text)
      ) {
        const stock =
          getProductStock(
            product
          );

        return sendMessage(
          messengerId,

          `📱 ${product.name}\n\n` +
            `📦 Stock: ${
              stock > 0
                ? `Available (${stock} pcs)`
                : "Out of Stock"
            }`
        );
      }

      if (
        asksPrice(text)
      ) {
        const price =
          getProductPrice(
            product
          );

        const stock =
          getProductStock(
            product
          );

        return sendMessage(
          messengerId,

          `📱 ${product.name}\n\n` +
            `💰 Price: ৳${formatPrice(
              price
            )}\n\n` +
            `📦 Stock: ${
              stock > 0
                ? `Available (${stock} pcs)`
                : "Out of Stock"
            }`
        );
      }

      return sendMessage(
        messengerId,

        buildProductReply(
          product
        )
      );
    }

    /* =====================================================
       MULTIPLE PRODUCTS
    ===================================================== */

    if (
      products.length > 1
    ) {
      return sendMessage(
        messengerId,

        buildMultipleProductReply(
          products
        )
      );
    }

    /* =====================================================
       PRICE WITHOUT PRODUCT
    ===================================================== */

    if (
      asksPrice(text)
    ) {
      return sendMessage(
        messengerId,

        `অবশ্যই 😊\n\n` +
          `আপনি কোন product-এর price জানতে চান?\n\n` +
          `উদাহরণ:\n\n` +
          `📱 iPhone 17 Pro Max\n` +
          `📱 Samsung S25 Ultra\n` +
          `💻 MacBook Air`
      );
    }

    /* =====================================================
       STOCK WITHOUT PRODUCT
    ===================================================== */

    if (
      asksStock(text)
    ) {
      return sendMessage(
        messengerId,

        `জি 😊\n\n` +
          `আপনি কোন product-এর stock জানতে চান?\n\n` +
          `Product-এর নাম লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `iPhone 17 Pro Max`
      );
    }

    /* =====================================================
       INFO WITHOUT PRODUCT
    ===================================================== */

    if (
      asksProductInfo(text)
    ) {
      return sendMessage(
        messengerId,

        `অবশ্যই 😊\n\n` +
          `আপনি কোন product-এর information জানতে চান?\n\n` +
          `Product-এর নাম লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `iPhone 17 Pro Max`
      );
    }

    /* =====================================================
       THANK YOU
    ===================================================== */

    if (
      containsAny(text, [
        "thanks",
        "thank you",
        "ধন্যবাদ",
        "অনেক ধন্যবাদ",
      ])
    ) {
      return sendMessage(
        messengerId,

        `আপনাকেও ধন্যবাদ। ❤️\n\n` +
          `যেকোনো সময় আমাদের message করতে পারেন। আমরা সাহায্য করতে প্রস্তুত। 😊`
      );
    }

    /* =====================================================
       BYE
    ===================================================== */

    if (
      containsAny(text, [
        "bye",
        "বিদায়",
        "আবার কথা হবে",
      ])
    ) {
      return sendMessage(
        messengerId,

        `ঠিক আছে 😊\n\n` +
          `আবারও আসবেন। ❤️\n\n` +
          `আমাদের store-এ message করার জন্য ধন্যবাদ।`
      );
    }

    /* =====================================================
       FINAL FALLBACK
    ===================================================== */

    return sendMessage(
      messengerId,

      `দুঃখিত 😊\n\n` +
        `আমি আপনার কথাটি বুঝতে পারিনি।\n\n` +
        `আপনি আমাদের database-এ থাকা product-এর নাম লিখে জানতে পারেন:\n\n` +
        `📱 Product Price\n` +
        `📦 Stock\n` +
        `📝 Details\n` +
        `🛒 Order\n\n` +
        `উদাহরণ:\n` +
        `iPhone 17 Pro Max price কত?\n\n` +
        `অথবা শুধু লিখুন:\n` +
        `iPhone`
    );
  } catch (error) {
    /* =====================================================
       SAFE ERROR LOG
       NEVER LOG FULL AXIOS ERROR
    ===================================================== */

    console.error(
      "===================================="
    );

    console.error(
      "[Chatbot Error]"
    );

    console.error(
      "Messenger ID:",
      messengerId
    );

    console.error(
      "Message:",
      message
    );

    console.error(
      "Error Name:",
      error?.name
    );

    console.error(
      "Error Message:",
      error?.message
    );

    /*
      IMPORTANT:

      Do NOT use:

      console.error(error);
      console.error("Full Error:", error);
      console.error(error.config);
      console.error(error.response);
      console.log(process.env.FACEBOOK_PAGE_ACCESS_TOKEN);

      These can expose sensitive Facebook credentials.
    */

    console.error(
      "===================================="
    );

    /* =====================================================
       SAFE ERROR MESSAGE TO CUSTOMER
    ===================================================== */

    try {
      await sendMessage(
        messengerId,

        `দুঃখিত 😔\n\n` +
          `এই মুহূর্তে আপনার requestটি process করতে সমস্যা হচ্ছে।\n\n` +
          `কিছুক্ষণ পরে আবার চেষ্টা করুন।`
      );
    } catch (sendError) {
      /*
        Only log safe information.
        Never log the complete Axios error.
      */

      console.error(
        "[Send Error Name]:",
        sendError?.name
      );

      console.error(
        "[Send Error Message]:",
        sendError?.message
      );
    }
  }
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  handleMessage,
};