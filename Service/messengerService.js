import axios from "axios";

const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const API_VERSION = process.env.FACEBOOK_API_VERSION || "v22.0";

const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}/me/messages`;

export async function sendMessage(recipientId, message) {
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

    console.log("Message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Facebook Send Message Error Details:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    // error throw না করে শুধু লগ করা ভালো যেন অন্য কোড ক্র্যাশ না করে
    return null;
  }
}

export default {
  sendMessage,
};