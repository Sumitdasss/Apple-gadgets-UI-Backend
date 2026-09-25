
import axios from "axios";

const API_VERSION =
  process.env.FACEBOOK_API_VERSION || "v26.0";

export default async function sendMessage(
  recipientId,
  message
) {
  const PAGE_ACCESS_TOKEN =
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  const GRAPH_URL =
    `https://graph.facebook.com/${API_VERSION}/me/messages`;

  console.log(
    "========== FACEBOOK SEND =========="
  );

  console.log(
    "Recipient ID:",
    recipientId
  );

  console.log(
    "Message:",
    message
  );

  console.log(
    "API Version:",
    API_VERSION
  );

  console.log(
    "PAGE ACCESS TOKEN EXISTS:",
    Boolean(PAGE_ACCESS_TOKEN)
  );

  console.log(
    "PAGE ACCESS TOKEN LENGTH:",
    PAGE_ACCESS_TOKEN?.length || 0
  );

  // ==========================================
  // CHECK ACCESS TOKEN
  // ==========================================

  if (!PAGE_ACCESS_TOKEN) {
    throw new Error(
      "FACEBOOK_PAGE_ACCESS_TOKEN is missing"
    );
  }

  try {
    // ==========================================
    // SEND MESSAGE TO FACEBOOK
    // ==========================================

    const response = await axios.post(
      GRAPH_URL,
      {
        recipient: {
          id: String(recipientId),
        },

        messaging_type: "RESPONSE",

        message: {
          text: String(message),
        },
      },
      {
        headers: {
          Authorization:
            `Bearer ${PAGE_ACCESS_TOKEN}`,

          "Content-Type":
            "application/json",
        },

        timeout: 15000,
      }
    );

    // ==========================================
    // SUCCESS
    // ==========================================

    console.log(
      "========== FACEBOOK SEND SUCCESS =========="
    );

    console.log(
      "Facebook Response:",
      response.data
    );

    return response.data;

  } catch (error) {
    // ==========================================
    // FACEBOOK ERROR
    // ==========================================

    const fbError =
      error?.response?.data?.error;

    const status =
      error?.response?.status;

    console.error(
      "========== FACEBOOK SEND ERROR =========="
    );

    console.error(
      "HTTP Status:",
      status || "Unknown"
    );

    console.error(
      "Facebook Error Message:",
      fbError?.message ||
        "Unknown Facebook error"
    );

    console.error(
      "Facebook Error Type:",
      fbError?.type ||
        "Unknown"
    );

    console.error(
      "Facebook Error Code:",
      fbError?.code ||
        "Unknown"
    );

    console.error(
      "Facebook Error Subcode:",
      fbError?.error_subcode ||
        "None"
    );

    // ==========================================
    // SAFE ERROR
    // ==========================================
    // IMPORTANT:
    // Never do:
    //
    // console.error(error)
    //
    // or:
    //
    // throw error
    //
    // because Axios error may contain
    // Authorization header / access token.
    // ==========================================

    const safeError =
      new Error(
        fbError?.message ||
          "Facebook message sending failed"
      );

    safeError.code =
      fbError?.code;

    safeError.subcode =
      fbError?.error_subcode;

    safeError.status =
      status;

    throw safeError;
  }
}

