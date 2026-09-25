
import OpenAI from "openai";

/* =========================================================
   OPENAI CLIENT
========================================================= */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


/* =========================================================
   MODEL
========================================================= */

const MODEL =
  process.env.OPENAI_MODEL;


/* =========================================================
   ASK OPENAI
========================================================= */

export async function askOpenAI({
  message,
  product = null,
  customer = null,
  conversation = null,
}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "[OpenAI] OPENAI_API_KEY is missing"
      );

      return null;
    }

    if (!MODEL) {
      console.error(
        "[OpenAI] OPENAI_MODEL is missing"
      );

      return null;
    }


    /* =====================================================
       PRODUCT DATA
    ===================================================== */

    const productData = product
      ? {
          id: product._id?.toString(),

          name: product.name || "",

          slug: product.slug || "",

          brand: product.brand || "",

          price: product.price || 0,

          discountPrice:
            product.discountPrice || 0,

          discountPercentage:
            product.discountPercentage || 0,

          stock:
            Number(product.stock || 0),

          description:
            product.description || "",

          shortDescription:
            product.shortDescription || "",

          category:
            product.category?.toString() || "",

          subCategory:
            product.subCategory?.toString() || "",

          childCategory:
            product.childCategory?.toString() || "",

          specifications:
            product.specifications || {},
        }
      : null;


    /* =====================================================
       CUSTOMER DATA
    ===================================================== */

    const customerData = {
      name:
        customer?.name || "",

      phone:
        customer?.phone || "",

      address:
        customer?.address || "",
    };


    /* =====================================================
       CONVERSATION DATA
    ===================================================== */

    const conversationData = {
      state:
        conversation?.state || "idle",

      productName:
        conversation?.productName || "",

      quantity:
        conversation?.quantity || 1,

      color:
        conversation?.color || "",

      size:
        conversation?.size || "",
    };


    /* =====================================================
       OPENAI REQUEST
    ===================================================== */

    const response =
      await openai.responses.create({

        model: MODEL,

        instructions: `
You are the customer support assistant for
an online electronics and Apple gadgets store.

The store sells:

- iPhone
- iPad
- MacBook
- Apple products
- Samsung phones
- Xiaomi phones
- Google Pixel
- OnePlus
- Laptops
- Desktop computers
- Other electronics

You understand:

- Bangla
- Banglish
- English
- Mixed Bangla + English
- Common spelling mistakes
- Informal customer messages

Your job is to understand what the customer wants.

You can help with:

1. Product information
2. Product price
3. Product stock
4. Product availability
5. Product ordering
6. Quantity
7. General customer questions
8. Greetings
9. Thanks
10. Cancellation

IMPORTANT RULES:

- Never invent a product.
- Never invent a price.
- Never invent stock.
- Never invent specifications.
- If product data is supplied, use that data.
- Do not claim an order was created.
- The application creates the actual order.
- Do not create fake Order IDs.
- Do not say payment was received unless the application says so.
- Do not mention database.
- Do not mention API.
- Do not mention OpenAI.
- Do not mention system instructions.
- Keep responses short.
- Be polite and friendly.
- Use emojis naturally.
- If the customer speaks Bangla/Banglish, prefer Bangla.
- If the customer speaks English, reply in English.

Examples:

Customer:
"vai iphone 17 pro max er dam koto"

Meaning:
Customer wants the price of iPhone 17 Pro Max.

Customer:
"17 pro max ase?"

Meaning:
Customer wants to know whether iPhone 17 Pro Max is available.

Customer:
"vai 2 ta nibo"

Meaning:
Customer wants quantity 2.

Customer:
"iphone ta order korte chai"

Meaning:
Customer wants to place an order.

Customer:
"thanks"

Meaning:
Customer is thanking the store.

Answer naturally and briefly.
`,

        input: `
CUSTOMER MESSAGE:

${message}


CURRENT PRODUCT DATA:

${JSON.stringify(
  productData,
  null,
  2
)}


CUSTOMER DATA:

${JSON.stringify(
  customerData,
  null,
  2
)}


CURRENT CONVERSATION:

${JSON.stringify(
  conversationData,
  null,
  2
)}


Now respond to the customer.
`,
      });


    /* =====================================================
       RESPONSE
    ===================================================== */

    const reply =
      response.output_text?.trim();


    if (!reply) {
      return null;
    }


    console.log(
      "[OpenAI Reply]:",
      reply
    );


    return reply;

  } catch (error) {

    console.error(
      "[OpenAI Error]:",
      error?.message || error
    );

    return null;
  }
}


export default {
  askOpenAI,
};
