
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,

  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpEmail = async (email, otp, userName, purpose = "verify") => {
  const isLogin = purpose === "login";


await transporter.sendMail({
  from: `"Apple Gadgets" <${process.env.MAIL_FROM || process.env.SMTP_USER}>`,
  to: email,

  subject: isLogin
    ? "🔐 Your Apple Gadgets Login Verification Code"
    : "Welcome to Apple Gadgets — Verify Your Email",

  text: `Hello ${userName || "there"},

${
  isLogin
    ? "We received a request to sign in to your Apple Gadgets account."
    : "Welcome to Apple Gadgets! Please verify your email address to complete your registration."
}

Your verification code is: ${otp}

This code expires in 5 minutes. Never share this code with anyone.

If you did not request this code, please ignore this email.

Apple Gadgets Team`,

  html: `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apple Gadgets Verification</title>
  </head>

  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d1d1f;">

    <!-- Preview Text -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your Apple Gadgets verification code is ${otp}. It expires in 5 minutes.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
      style="background:#f5f5f7;padding:35px 12px;">

      <tr>
        <td align="center">

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;">

            <!-- Premium Header -->
            <tr>
              <td align="center"
                style="padding:35px 24px 30px;background:#111111;">

                <div style="font-size:25px;font-weight:800;letter-spacing:-1px;color:#ffffff;">
                  APPLE <span style="color:#b6b6b6;">GADGETS</span>
                </div>

                <p style="margin:12px 0 0;font-size:11px;letter-spacing:3px;color:#b8b8b8;">
                  YOUR TECH. YOUR WORLD.
                </p>

                <div style="margin:24px auto 0;width:48px;height:3px;background:#a5a5a5;border-radius:5px;"></div>

              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:36px 30px 25px;">

                <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:2px;color:#86868b;">
                  ${isLogin ? "SECURE ACCOUNT LOGIN" : "EMAIL ADDRESS VERIFICATION"}
                </p>

                <h1 style="margin:0 0 18px;font-size:28px;line-height:1.3;letter-spacing:-0.7px;color:#1d1d1f;">
                  ${
                    isLogin
                      ? "Welcome back"
                      : "Welcome to Apple Gadgets"
                  }${userName ? `, ${userName}` : ""}.
                </h1>

                <p style="margin:0 0 26px;font-size:15px;line-height:1.8;color:#6e6e73;">
                  ${
                    isLogin
                      ? "We received a request to sign in to your account. Enter the verification code below to continue."
                      : "Thank you for joining Apple Gadgets. Verify your email address with the code below to complete your registration."
                  }
                </p>

                <!-- OTP Card -->
                <div style="padding:28px 16px;text-align:center;background:#f5f5f7;border:1px solid #e5e5e7;border-radius:16px;">

                  <p style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:2px;color:#6e6e73;">
                    YOUR VERIFICATION CODE
                  </p>

                  <div style="display:inline-block;padding:15px 18px;background:#ffffff;border:1px solid #dedee2;border-radius:12px;font-size:32px;font-weight:750;letter-spacing:8px;color:#1d1d1f;">
                    ${otp}
                  </div>

                  <p style="margin:18px 0 0;font-size:13px;color:#6e6e73;">
                    This code expires in
                    <strong style="color:#d93025;">5 minutes</strong>.
                  </p>

                </div>

                <!-- Security Notice -->
                <div style="margin-top:25px;padding:17px;background:#fafafa;border:1px solid #e8e8ed;border-radius:12px;">

                  <p style="margin:0 0 7px;font-size:14px;font-weight:700;color:#1d1d1f;">
                    Keep your account secure
                  </p>

                  <p style="margin:0;font-size:13px;line-height:1.8;color:#6e6e73;">
                    Never share your verification code with anyone. Apple Gadgets will never ask you to disclose your OTP.
                  </p>

                </div>

                <p style="margin:25px 0 0;font-size:13px;line-height:1.8;color:#6e6e73;">
                  Didn't request this ${
                    isLogin ? "login" : "verification"
                  }? You can safely ignore this email. No action is required.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center"
                style="padding:25px 22px;background:#fafafa;border-top:1px solid #eeeeef;">

                <p style="margin:0 0 8px;font-size:15px;font-weight:750;letter-spacing:-0.3px;color:#1d1d1f;">
                  Apple Gadgets
                </p>

                <p style="margin:0;font-size:12px;line-height:1.8;color:#86868b;">
                  Your trusted destination for Apple products and accessories.<br />
                  This is an automated email. Please do not reply.
                </p>

                <div style="margin:20px auto;width:35px;height:1px;background:#d2d2d7;"></div>

                <p style="margin:0;font-size:11px;color:#a1a1a6;">
                  &copy; ${new Date().getFullYear()} Apple Gadgets. All rights reserved.
                </p>

              </td>
            </tr>

          </table>

          <p style="margin:18px 0 0;font-size:11px;line-height:1.7;color:#86868b;text-align:center;">
            This message was sent to ${email} for account security purposes.
          </p>

        </td>
      </tr>

    </table>

  </body>
  </html>
  `,
});


};
