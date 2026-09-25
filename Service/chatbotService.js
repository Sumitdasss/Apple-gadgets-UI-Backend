import Customer from "../Model/Customer.js";
import Conversation from "../Model/Conversation.js";
import Order from "../Model/Order.js";

import { searchProduct, getProductPrice } from "./productService.js";
import  sendMessage  from "./messengerService.js";

// Intl Formatter রি-ইউজ করার জন্য ক্যাশ করা হলো (বারবার নতুন অবজেক্ট তৈরি হবে না)
const priceFormatter = new Intl.NumberFormat("en-BD");

function formatPrice(price) {
  return priceFormatter.format(price || 0);
}

function normalize(text) {
  return text ? text.toLowerCase().trim() : "";
}

// দ্রুত স্ট্রিং ম্যাচিং করার জন্য Regex Helpers
function containsAny(text, words) {
  const pattern = new RegExp(words.join("|"), "i");
  return pattern.test(text);
}

// Customer এবং Conversation একসাথে প্যারালালে হ্যান্ডেল করার ফাংশন
async function getCustomerAndConversation(messengerId) {
  const [customer, conversation] = await Promise.all([
    Customer.findOne({ messengerId }),
    Conversation.findOne({ messengerId }),
  ]);

  let activeCustomer = customer;
  if (!activeCustomer) {
    activeCustomer = await Customer.create({
      messengerId,
      source: "facebook_messenger",
    });
  }

  let activeConversation = conversation;
  if (!activeConversation) {
    activeConversation = await Conversation.create({
      messengerId,
      customer: activeCustomer._id,
      state: "idle",
    });
  }

  return { customer: activeCustomer, conversation: activeConversation };
}

export async function handleMessage(messengerId, message) {
  if (!message || !message.trim()) return;

  const rawText = message.trim();
  const text = normalize(rawText);

  // প্যারালালে কাস্টমার ও কনভারসেশন ফেচ
  const { customer, conversation } = await getCustomerAndConversation(messengerId);

  // ======================================
  // ORDER FLOW
  // ======================================

  if (conversation.state === "waiting_name") {
    customer.name = rawText;
    conversation.state = "waiting_phone";

    await Promise.all([customer.save(), conversation.save()]);

    return sendMessage(
      messengerId,
      `ধন্যবাদ ${customer.name} 😊\n\nএখন আপনার মোবাইল নম্বরটি দিন।`
    );
  }

  if (conversation.state === "waiting_phone") {
    customer.phone = rawText;
    conversation.state = "waiting_address";

    await Promise.all([customer.save(), conversation.save()]);

    return sendMessage(
      messengerId,
      `ধন্যবাদ 😊\n\nএখন আপনার সম্পূর্ণ delivery address দিন।`
    );
  }

  if (conversation.state === "waiting_address") {
    customer.address = rawText;
    conversation.state = "waiting_confirmation";

    const [product] = await Promise.all([
      searchProduct(conversation.productName),
      customer.save(),
      conversation.save(),
    ]);

    const price = product ? getProductPrice(product) : 0;
    const quantity = conversation.quantity || 1;
    const total = price * quantity;

    return sendMessage(
      messengerId,
      `📦 Order Summary\n\nProduct:\n${conversation.productName}\n\nQuantity:\n${quantity}\n\nPrice:\n৳${formatPrice(
        total
      )}\n\nName:\n${customer.name}\n\nPhone:\n${
        customer.phone
      }\n\nAddress:\n${customer.address}\n\nঅর্ডার confirm করতে লিখুন:\n\nYES\n\nঅথবা বাতিল করতে লিখুন:\n\nNO`
    );
  }

  if (conversation.state === "waiting_confirmation") {
    const isYes = ["yes", "হ্যাঁ", "জি", "confirm"].includes(text);
    const isNo = ["no", "না", "cancel"].includes(text);

    if (isYes) {
      const product = await searchProduct(conversation.productName);

      if (!product) {
        conversation.state = "idle";
        await conversation.save();

        return sendMessage(
          messengerId,
          "দুঃখিত, productটি এখন খুঁজে পাওয়া যাচ্ছে না।"
        );
      }

      const price = getProductPrice(product);
      const quantity = conversation.quantity || 1;
      const total = price * quantity;
      const orderId = `ORD-${Date.now()}`;

      // অর্ডার তৈরি এবং কনভারসেশন স্টেট ক্লিয়ার একসাথে করা হচ্ছে
      const orderPromise = Order.create({
        orderId,
        customer: customer._id,
        products: [
          {
            product: product._id,
            name: product.name,
            price,
            quantity,
            color: conversation.color || "",
            size: conversation.size || "",
          },
        ],
        totalAmount: total,
        deliveryAddress: customer.address,
        phone: customer.phone,
        status: "pending",
        source: "facebook_messenger",
      });

      conversation.state = "idle";
      conversation.temporaryOrder = {};

      const [order] = await Promise.all([orderPromise, conversation.save()]);

      return sendMessage(
        messengerId,
        `✅ আপনার Order সফলভাবে নেওয়া হয়েছে।\n\nOrder ID:\n#${
          order.orderId
        }\n\nProduct:\n${product.name}\n\nTotal:\n৳${formatPrice(
          total
        )}\n\nআমাদের team খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে। ❤️`
      );
    }

    if (isNo) {
      conversation.state = "idle";
      await conversation.save();

      return sendMessage(
        messengerId,
        "ঠিক আছে 😊 Order বাতিল করা হয়েছে।"
      );
    }

    return sendMessage(
      messengerId,
      "Order confirm করতে YES অথবা cancel করতে NO লিখুন।"
    );
  }

  // ======================================
  // GREETING
  // ======================================

  if (containsAny(text, ["hi", "hello", "hey", "হাই", "হ্যালো", "আসসালামু", "salam"])) {
    return sendMessage(
      messengerId,
      `Assalamu Alaikum 😊\n\nWelcome to our store.\n\nআমি আপনাকে product price, stock এবং order করতে সাহায্য করতে পারি।\n\নআপনি কোন product খুঁজছেন?`
    );
  }

  // ======================================
  // ORDER INTENT
  // ======================================

  const wantsOrder = containsAny(text, [
    "order",
    "অর্ডার",
    "নিব",
    "নিতে চাই",
    "কিনব",
    "buy",
  ]);

  if (wantsOrder) {
    const product = await searchProduct(rawText);

    if (product) {
      conversation.product = product._id;
      conversation.productName = product.name;
      conversation.quantity = 1;
      conversation.state = "waiting_name";

      await conversation.save();

      const price = getProductPrice(product);

      return sendMessage(
        messengerId,
        `জি অবশ্যই 😊\n\nProduct:\n${product.name}\n\nPrice:\n৳${formatPrice(
          price
        )}\n\nঅর্ডার করতে আপনার নামটি লিখুন।`
      );
    }
  }

  // ======================================
  // PRODUCT SEARCH
  // ======================================

  const product = await searchProduct(rawText);

  if (product) {
    const price = getProductPrice(product);
    const stock = product.stock || 0;

    let reply = `📱 ${product.name}\n\n💰 Price:\n৳${formatPrice(
      price
    )}\n\n📦 Stock:\n${
      stock > 0 ? `Available (${stock} pcs)` : "Out of Stock"
    }`;

    if (product.discountPrice && product.discountPrice > 0) {
      reply += `\n\nRegular Price:\n৳${formatPrice(product.price)}`;
    }

    reply += `\n\nঅর্ডার করতে লিখুন:\n"আমি অর্ডার করব"`;

    return sendMessage(messengerId, reply);
  }

  // ======================================
  // PRICE QUESTION
  // ======================================

  if (containsAny(text, ["price", "দাম", "কত", "মূল্য"])) {
    return sendMessage(
      messengerId,
      `অবশ্যই 😊\n\nআপনি কোন product-এর price জানতে চান?\n\nউদাহরণ:\niPhone 17 Pro Max`
    );
  }

  // ======================================
  // STOCK QUESTION
  // ======================================

  if (containsAny(text, ["stock", "available", "আছে", "অ্যাভেইলেবল"])) {
    return sendMessage(
      messengerId,
      `জি 😊\n\nআপনি কোন product-এর stock জানতে চান?\n\nProduct name লিখুন।`
    );
  }

  // ======================================
  // DEFAULT RESPONSE
  // ======================================

  return sendMessage(
    messengerId,
    `আমি আপনার সাহায্য করতে পারি 😊\n\nআপনি লিখতে পারেন:\n\n• Product price\n• Product stock\n• Product information\n• Order করতে চাই\n\nউদাহরণ:\n"iPhone 17 Pro Max price কত?"`
  );
}

export default {
  handleMessage,
};