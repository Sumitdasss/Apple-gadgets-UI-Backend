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
        params: {
          access_token: PAGE_ACCESS_TOKEN,
        },
      }
    );

    console.log(
      "✅ Facebook Send Success:",
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
      "Facebook Error Message:",
      error.response?.data?.error?.message
    );

    console.error(
      "Facebook Error Type:",
      error.response?.data?.error?.type
    );

    console.error(
      "Facebook Error Code:",
      error.response?.data?.error?.code
    );

    console.error(
      "Facebook Error Subcode:",
      error.response?.data?.error?.error_subcode
    );

    throw error;
  }
}