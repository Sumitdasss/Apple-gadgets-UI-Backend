import axios from "axios";

const API_VERSION =
  process.env.FACEBOOK_API_VERSION || "v26.0";

export default async function sendMessage(
  recipientId,
  message
) {
  const PAGE_ACCESS_TOKEN =
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!PAGE_ACCESS_TOKEN) {
    throw new Error(
      "FACEBOOK_PAGE_ACCESS_TOKEN is missing"
    );
  }

  const url =
    `https://graph.facebook.com/${API_VERSION}/me/messages`;

  try {
    const response = await axios.post(
      url,
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
      error?.response?.status;

    console.error(
      "[Facebook Send Error]",
      {
        status:
          error?.response?.status,

        message:
          fbError?.message,

        type:
          fbError?.type,

        code:
          fbError?.code,

        subcode:
          fbError?.error_subcode,
      }
    );

    throw safeError;
  }
}