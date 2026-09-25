
import { handleMessage } from "../Service/chatbotService.js";

/* =========================================================
   VERIFY FACEBOOK WEBHOOK
========================================================= */

export function verifyWebhook(req, res) {
  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token ===
      process.env.FACEBOOK_VERIFY_TOKEN
  ) {
    return res
      .status(200)
      .send(challenge);
  }

  return res.sendStatus(403);
}

/* =========================================================
   RECEIVE FACEBOOK WEBHOOK
========================================================= */

export async function receiveWebhook(
  req,
  res
) {
  try {
    const body = req.body;

    // Only accept Facebook Page webhook events
    if (
      !body ||
      body.object !== "page"
    ) {
      return res.sendStatus(404);
    }

    for (
      const entry of body.entry || []
    ) {
      for (
        const event of
          entry.messaging || []
      ) {
        // Ignore invalid events and echo messages
        if (
          !event?.message ||
          event.message.is_echo
        ) {
          continue;
        }

        const senderId =
          event?.sender?.id;

        const message =
          event?.message?.text;

        // Ignore events without sender/message
        if (
          !senderId ||
          !message
        ) {
          continue;
        }

        try {
          await handleMessage(
            senderId,
            message
          );
        } catch {
          // Do not log raw errors.
          // This prevents sensitive Axios/token data
          // from appearing in production logs.
          continue;
        }
      }
    }

    // Facebook requires a successful response
    return res
      .status(200)
      .send("EVENT_RECEIVED");

  } catch {
    // Always acknowledge the webhook
    return res
      .status(200)
      .send("EVENT_RECEIVED");
  }
}