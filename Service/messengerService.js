
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

  // Check access token
  if (!PAGE_ACCESS_TOKEN) {
    throw new Error(
      "FACEBOOK_PAGE_ACCESS_TOKEN is missing"
    );
  }

  try {
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

    return response.data;

  } catch (error) {
    const fbError =
      error?.response?.data?.error;

    const status =
      error?.response?.status;

    // Safe Facebook error log
    console.error(
      "[Facebook Send Error]",
      {
        status,
        message:
          fbError?.message ||
          "Unknown Facebook error",
        type:
          fbError?.type,
        code:
          fbError?.code,
        subcode:
          fbError?.error_subcode,
      }
    );

    // IMPORTANT:
    // Do not throw the original Axios error.
    // It may contain the Authorization header/token.

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