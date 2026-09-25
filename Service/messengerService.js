import axios from "axios";

const API_VERSION = process.env.FACEBOOK_API_VERSION || "v23.0";

export default async function sendMessage(recipientId, message) {
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
    !!PAGE_ACCESS_TOKEN
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
          id: recipientId,
        },
        messaging_type: "RESPONSE",
        message: {
          text: message,
        },
      },
      {
        params: {
          access_token: PAGE_ACCESS_TOKEN,
        },
      }
    );

    console.log(
      "Facebook Send Success:",
      response.data
    );

    return response.data;

  } catch (error) {
    console.error(
      "========== FACEBOOK SEND ERROR =========="
    );

    console.error(
      "Status:",
      error.response?.status
    );

    console.error(
      "Facebook Error:",
      JSON.stringify(
        error.response?.data,
        null,
        2
      )
    );

    console.error(
      "Message:",
      error.message
    );

    throw error;
  }
}