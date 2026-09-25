import { handleMessage } from "../Service/chatbotService.js";

export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.FACEBOOK_VERIFY_TOKEN
  ) {
    console.log("Facebook Webhook Verified");

    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}


export async function receiveWebhook(req, res) {
  try {
    const body = req.body;

    console.log(
      "========== FACEBOOK WEBHOOK =========="
    );

    console.log(
      JSON.stringify(body, null, 2)
    );

    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    for (const entry of body.entry || []) {

      for (const event of entry.messaging || []) {

        if (
          !event.message ||
          event.message.is_echo
        ) {
          continue;
        }

        const senderId = event.sender?.id;
        const message = event.message?.text;

        console.log(
          "[Messenger] Sender:",
          senderId
        );

        console.log(
          "[Messenger] Text:",
          message
        );

        if (senderId && message) {

          console.log(
            "[Messenger] Calling handleMessage..."
          );

          await handleMessage(
            senderId,
            message
          );

          console.log(
            "[Messenger] handleMessage completed"
          );
        }
      }
    }

    return res
      .status(200)
      .send("EVENT_RECEIVED");

  } catch (error) {

    console.error(
      "========== WEBHOOK ERROR =========="
    );

    console.error(error);

    return res
      .status(500)
      .send("Webhook Error");
  }
}