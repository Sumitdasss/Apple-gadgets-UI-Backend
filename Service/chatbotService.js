
import Customer from "../Model/Customer.js";
import Conversation from "../Model/Conversation.js";
import Order from "../Model/Order.js";
import Product from "../Model/Product.js";

import {
  searchProduct,
  getProductPrice,
} from "./productService.js";

import sendMessage from "./messengerService.js";

import {
  askOpenAI,
} from "./openaiService.js";


/* =========================================================
   CONFIG
========================================================= */

const priceFormatter =
  new Intl.NumberFormat("en-BD");

const MAX_NAME_LENGTH = 80;
const MAX_PHONE_LENGTH = 20;
const MAX_ADDRESS_LENGTH = 500;
const MAX_QUANTITY = 20;


/* =========================================================
   HELPERS
========================================================= */

function formatPrice(price) {
  return priceFormatter.format(
    Number(price) || 0
  );
}


function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}


function containsAny(text, words = []) {
  const normalizedText =
    normalize(text);

  return words.some((word) =>
    normalizedText.includes(
      normalize(word)
    )
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
  ]);
}


function isConfirmation(text) {
  const value =
    normalize(text);

  return [
    "yes",
    "হ্যাঁ",
    "হ্যা",
    "জি",
    "জ্বি",
    "confirm",
    "confirmed",
    "ঠিক আছে",
    "অর্ডার করুন",
    "নিশ্চিত",
    "নিশ্চিত করুন",
  ].includes(value);
}


function isNegativeConfirmation(text) {
  const value =
    normalize(text);

  return [
    "no",
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
    "কিনব",
    "কিনতে চাই",
    "buy",
    "purchase",
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
  ]);
}


function asksProductInfo(text) {
  return containsAny(text, [
    "details",
    "detail",
    "information",
    "info",
    "specification",
    "specs",
    "বিস্তারিত",
    "তথ্য",
    "ফিচার",
    "স্পেসিফিকেশন",
  ]);
}


/* =========================================================
   CUSTOMER + CONVERSATION
========================================================= */

async function getCustomerAndConversation(
  messengerId
) {
  let customer =
    await Customer.findOne({
      messengerId,
    });

  if (!customer) {
    customer =
      await Customer.create({
        messengerId,
        source:
          "facebook_messenger",
      });
  }


  let conversation =
    await Conversation.findOne({
      messengerId,
    });

  if (!conversation) {
    conversation =
      await Conversation.create({
        messengerId,
        customer:
          customer._id,
        state: "idle",
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

async function resetConversation(
  conversation
) {
  conversation.state =
    "idle";

  conversation.product =
    null;

  conversation.productName =
    "";

  conversation.quantity =
    1;

  conversation.color =
    "";

  conversation.size =
    "";

  conversation.temporaryOrder =
    {};

  await conversation.save();
}


/* =========================================================
   PRODUCT PRICE
========================================================= */

function getProductDisplayPrice(
  product
) {
  return getProductPrice(
    product
  );
}


/* =========================================================
   PRODUCT REPLY
========================================================= */

function buildProductReply(
  product
) {
  const price =
    getProductDisplayPrice(
      product
    );

  const stock =
    Number(product.stock || 0);


  let reply =
    `📱 ${product.name}\n\n` +
    `💰 Price: ৳${formatPrice(price)}\n`;


  if (
    product.discountPrice &&
    product.discountPrice > 0 &&
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


  reply +=
    `\nআপনি চাইলে এখনই অর্ডার করতে পারেন। 😊\n\n` +
    `লিখুন: "আমি অর্ডার করতে চাই"`;


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
    getProductDisplayPrice(
      product
    );

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
    `${customer.name}\n\n` +

    `📞 Phone:\n` +
    `${customer.phone}\n\n` +

    `📍 Delivery Address:\n` +
    `${customer.address}\n\n` +

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
   PHONE VALIDATION
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

  return bdPhoneRegex.test(
    value
  );
}


/* =========================================================
   QUANTITY PARSER
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
       WAITING NAME
    ===================================================== */

    if (
      conversation.state ===
      "waiting_name"
    ) {

      if (
        !isValidName(
          rawText
        )
      ) {

        return sendMessage(
          messengerId,

          `দুঃখিত 😊\n\n` +
          `আপনার নামটি একটু পরিষ্কারভাবে লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `Sumit Das`
        );
      }


      customer.name =
        rawText;


      conversation.state =
        "waiting_phone";


      await Promise.all([
        customer.save(),
        conversation.save(),
      ]);


      return sendMessage(
        messengerId,

        `ধন্যবাদ, ${customer.name} 😊\n\n` +
        `এখন আপনার ১১ সংখ্যার মোবাইল নম্বরটি দিন।\n\n` +
        `উদাহরণ:\n` +
        `01712345678`
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
          `উদাহরণ:\n` +
          `01712345678`
        );
      }


      customer.phone =
        phone;


      conversation.state =
        "waiting_address";


      await Promise.all([
        customer.save(),
        conversation.save(),
      ]);


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
        await Product.findById(
          conversation.product
        );


      if (!product) {

        await resetConversation(
          conversation
        );


        return sendMessage(
          messengerId,

          `দুঃখিত 😔\n\n` +
          `এই productটি এখন আর available নেই।\n\n` +
          `আপনি চাইলে অন্য কোনো product-এর নাম লিখে চেষ্টা করতে পারেন।`
        );
      }


      const price =
        getProductDisplayPrice(
          product
        );


      const quantity =
        conversation.quantity ||
        1;


      const stock =
        Number(
          product.stock || 0
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
          await Product.findById(
            conversation.product
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
          Number(
            product.stock || 0
          );


        const quantity =
          conversation.quantity ||
          1;


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
          getProductDisplayPrice(
            product
          );


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


        /* =================================================
           DECREASE STOCK
        ================================================= */

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
       QUANTITY REQUEST
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

          `দয়া করে ১ থেকে ${MAX_QUANTITY}-এর মধ্যে একটি quantity লিখুন।\n\n` +
          `উদাহরণ:\n` +
          `2`
        );
      }


      const product =
        await Product.findById(
          conversation.product
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
        Number(
          product.stock || 0
        );


      if (
        stock < quantity
      ) {

        return sendMessage(
          messengerId,

          `দুঃখিত 😊\n\n` +
          `এই product-এর available stock হলো ${stock} pcs।\n\n` +
          `আপনি সর্বোচ্চ ${stock} pcs নিতে পারবেন।`
        );
      }


      conversation.quantity =
        quantity;


      conversation.state =
        "waiting_name";


      await conversation.save();


      return sendMessage(
        messengerId,

        `ঠিক আছে 😊\n\n` +
        `Quantity: ${quantity} pcs\n\n` +
        `এখন আপনার নামটি লিখুন।`
      );
    }


    /* =====================================================
       ORDER INTENT
    ===================================================== */

    if (
      wantsOrder(text)
    ) {

      const product =
        await searchProduct(
          rawText
        );


      if (product) {

        const stock =
          Number(
            product.stock || 0
          );


        if (
          stock <= 0
        ) {

          return sendMessage(
            messengerId,

            `দুঃখিত 😔\n\n` +
            `${product.name} বর্তমানে Out of Stock।\n\n` +
            `অন্য কোনো product-এর নাম লিখে চেষ্টা করতে পারেন।`
          );
        }


        conversation.product =
          product._id;


        conversation.productName =
          product.name;


        conversation.quantity =
          1;


        conversation.state =
          "waiting_name";


        await conversation.save();


        const price =
          getProductDisplayPrice(
            product
          );


        return sendMessage(
          messengerId,

          `জি অবশ্যই! 😊\n\n` +

          `📱 Product:\n` +
          `${product.name}\n\n` +

          `💰 Price:\n` +
          `৳${formatPrice(price)}\n\n` +

          `📦 Available Stock:\n` +
          `${stock} pcs\n\n` +

          `অর্ডারটি শুরু করতে আপনার নামটি লিখুন।`
        );
      }


      return sendMessage(
        messengerId,

        `অবশ্যই 😊\n\n` +

        `আপনি কোন productটি অর্ডার করতে চান?\n\n` +

        `Product-এর নাম লিখুন।\n\n` +

        `উদাহরণ:\n` +
        `iPhone 17 Pro Max`
      );
    }


    /* =====================================================
       PRODUCT SEARCH
    ===================================================== */

    const product =
      await searchProduct(
        rawText
      );


    if (product) {

      return sendMessage(
        messengerId,

        buildProductReply(
          product
        )
      );
    }


    /* =====================================================
       PRICE QUESTION
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
       STOCK QUESTION
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
       PRODUCT INFORMATION
    ===================================================== */

    if (
      asksProductInfo(text)
    ) {

      return sendMessage(
        messengerId,

        `অবশ্যই 😊\n\n` +

        `আপনি কোন product-এর information জানতে চান?\n\n` +

        `Product-এর নাম লিখুন।`
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
       OPENAI FALLBACK
    ===================================================== */

    console.log(
      "[Chatbot] Sending message to OpenAI..."
    );


    const aiReply =
      await askOpenAI({

        message:
          rawText,

        product:
          null,

        customer,

        conversation,
      });


    if (aiReply) {

      return sendMessage(
        messengerId,
        aiReply
      );
    }


    /* =====================================================
       FINAL FALLBACK
    ===================================================== */

    return sendMessage(
      messengerId,

      `দুঃখিত 😊\n\n` +

      `আমি আপনার কথাটি বুঝতে পারিনি।\n\n` +

      `আপনি product-এর নাম, price, stock অথবা order সম্পর্কে জানতে পারেন।\n\n` +

      `উদাহরণ:\n` +

      `iPhone 17 Pro Max price কত?`
    );

  } catch (error) {

    console.error(
      "[Chatbot Error]",
      error
    );


    return sendMessage(
      messengerId,

      `দুঃখিত 😔\n\n` +

      `এই মুহূর্তে আপনার requestটি process করতে সমস্যা হচ্ছে।\n\n` +

      `কিছুক্ষণ পরে আবার চেষ্টা করুন।`
    );
  }
}


export default {
  handleMessage,
};

