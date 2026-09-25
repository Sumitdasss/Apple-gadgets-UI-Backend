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

  console.log("========== FACEBOOK SEND ==========");
  console.log("Recipient ID:", recipientId);
  console.log("Message:", message);
  console.log("API Version:", API_VERSION);
  console.log(
    "PAGE ACCESS TOKEN EXISTS:",
    Boolean(PAGE_ACCESS_TOKEN)
  );
  console.log(
    "PAGE ACCESS TOKEN LENGTH:",
    PAGE_ACCESS_TOKEN?.length || 0
  );

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
          Authorization: `Bearer ${PAGE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Facebook Send Success:",
      response.data
    );

    return response.data;

  } catch (error) {
    const fbError =
      error?.response?.data?.error;

    console.error(
      "========== FACEBOOK SEND ERROR =========="
    );

    console.error(
      "Status:",
      error?.response?.status
    );

    console.error(
      "Facebook Error Message:",
      fbError?.message
    );

    console.error(
      "Facebook Error Type:",
      fbError?.type
    );

    console.error(
      "Facebook Error Code:",
      fbError?.code
    );

    console.error(
      "Facebook Error Subcode:",
      fbError?.error_subcode
    );

    // IMPORTANT:
    // Never log the full Axios error.
    // It may contain the Facebook access token.

    throw error;
  }
}