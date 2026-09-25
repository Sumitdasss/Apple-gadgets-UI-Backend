import { handleMessage } from "../Service/chatbotService.js";

export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log("Facebook Webhook Verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

export async function receiveWebhook(req, res) {
  try {
    const { body } = req;

    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    // ফেসবুককে সাথে সাথে ২০০ ওকে পাঠানো নিশ্চিত করা হচ্ছে যেন টাইমআউট বা রিট্রাই না হয়
    res.status(200).send("EVENT_RECEIVED");

    // ইনকামিং মেসেজ ব্যাকগ্রাউন্ডে প্রসেস করা
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        // Echo বা অন্য কোন স্পেশাল ইভেন্ট এড়িয়ে চলা
        if (!event.message || event.message.is_echo) {
          continue;
        }

        const senderId = event.sender?.id;
        const message = event.message?.text;

        if (senderId && message) {
          console.log(`[Messenger] Sender: ${senderId} | Text: ${message}`);

          // অ্যাসিঙ্ক ফাংশনটি ব্যাকগ্রাউন্ডে রান করবে
          handleMessage(senderId, message).catch((err) =>
            console.error("Error in handleMessage:", err)
          );
        }
      }
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    // যদি রেসপন্স আগেই সেন্ট না হয়ে থাকে
    if (!res.headersSent) {
      return res.status(500).send("Webhook Error");
    }
  }
}

export default {
  verifyWebhook,
  receiveWebhook,
};