import axios from "axios";

export async function checkFacebookToken(req, res) {
  const token =
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!token) {
    return res.status(500).json({
      success: false,
      message: "FACEBOOK_PAGE_ACCESS_TOKEN missing",
    });
  }

  try {
    const response = await axios.get(
      "https://graph.facebook.com/v26.0/me",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          fields: "id,name",
        },
      }
    );

    return res.status(200).json({
      success: true,
      page: {
        id: response.data.id,
        name: response.data.name,
      },
    });

  } catch (error) {
    const fbError =
      error?.response?.data?.error;

    return res.status(500).json({
      success: false,
      error: {
        message: fbError?.message,
        type: fbError?.type,
        code: fbError?.code,
        subcode: fbError?.error_subcode,
      },
    });
  }
}