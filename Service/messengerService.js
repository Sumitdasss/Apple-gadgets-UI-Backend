import axios from "axios"

const PAGE_ACCESS_TOKEN =
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

const API_VERSION =
  process.env.FACEBOOK_API_VERSION || "v23.0";

const GRAPH_URL =
  `https://graph.facebook.com/${API_VERSION}/me/messages`;

async function sendMessage(recipientId, message) {
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

    return response.data;
  } catch (error) {
    console.error(
      "Facebook Send Message Error:",
      error.response?.data || error.message
    );

    throw error;
  }
}

  export default sendMessage
 