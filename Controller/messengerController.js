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
    console.log(
      "Facebook Webhook Verified"
    );

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

    console.log(
      "========== FACEBOOK WEBHOOK =========="
    );

    console.log(
      "Webhook Object:",
      body?.object
    );

    /* =====================================================
       CHECK FACEBOOK PAGE OBJECT
    ===================================================== */

    if (
      !body ||
      body.object !== "page"
    ) {
      return res.sendStatus(404);
    }

    /* =====================================================
       LOOP ENTRIES
    ===================================================== */

    for (
      const entry of
      body.entry || []
    ) {

      /* ===================================================
         LOOP MESSAGING EVENTS
      =================================================== */

      for (
        const event of
        entry.messaging || []
      ) {

        /* =================================================
           IGNORE ECHO MESSAGE
        ================================================= */

        if (
          !event?.message ||
          event.message.is_echo
        ) {
          continue;
        }

        /* =================================================
           GET SENDER
        ================================================= */

        const senderId =
          event?.sender?.id;

        /* =================================================
           GET MESSAGE
        ================================================= */

        const message =
          event?.message?.text;

        console.log(
          "[Messenger] Sender:",
          senderId
        );

        console.log(
          "[Messenger] Text:",
          message
        );

        /* =================================================
           EMPTY MESSAGE CHECK
        ================================================= */

        if (
          !senderId ||
          !message
        ) {
          continue;
        }

        /* =================================================
           HANDLE MESSAGE
        ================================================= */

        console.log(
          "[Messenger] Calling handleMessage..."
        );

        try {

          await handleMessage(
            senderId,
            message
          );

          console.log(
            "[Messenger] handleMessage completed"
          );

        } catch (error) {

          /*
            IMPORTANT:

            পুরো Axios error কখনো console.error(error)
            করবে না।

            কারণ Axios error-এর ভিতরে Facebook
            access token থাকতে পারে।
          */

          console.error(
            "========== HANDLE MESSAGE ERROR =========="
          );

          console.error(
            "Error Name:",
            error?.name
          );

          console.error(
            "Error Message:",
            error?.message
          );

          console.error(
            "Facebook Code:",
            error?.code
          );

          console.error(
            "Facebook Subcode:",
            error?.subcode
          );

          /*
            এই error-এর কারণে Facebook webhook
            request-কে 500 করব না।
          */

          continue;
        }
      }
    }

    /* =====================================================
       FACEBOOK EXPECTS 200
    ===================================================== */

    return res
      .status(200)
      .send("EVENT_RECEIVED");

  } catch (error) {

    console.error(
      "========== WEBHOOK ERROR =========="
    );

    console.error(
      "Error Name:",
      error?.name
    );

    console.error(
      "Error Message:",
      error?.message
    );

    return res
      .status(200)
      .send("EVENT_RECEIVED");
  }
}