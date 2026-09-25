
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

export async function receiveWebhook(req, res) {
  try {
    const body = req.body;

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
      const entry of body.entry || []
    ) {

      /* ===================================================
         LOOP MESSAGING EVENTS
      =================================================== */

      for (
        const event of entry.messaging || []
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

        try {
          await handleMessage(
            senderId,
            message
          );

        } catch (error) {

          /*
            Production-এ পুরো error log করছি না।
            Access token leak এড়ানোর জন্য
            কোনো Axios error object log করা হচ্ছে না।
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

    /*
      কোনো unexpected error হলেও
      Facebook-কে 200 response দেওয়া হবে।
    */

    return res
      .status(200)
      .send("EVENT_RECEIVED");
  }
}

