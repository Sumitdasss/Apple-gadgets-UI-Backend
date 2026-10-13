
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
  from: `"Shopspace" <${process.env.MAIL_FROM || process.env.SMTP_USER}>`,
  to: email,

  subject: isLogin
    ? "🔐 Your Shopspace Login Verification Code"
    : "✨ Welcome to Shopspace — Verify Your Email",

  text: `Hello ${userName || "there"},

Your ${isLogin ? "login verification" : "email verification"} OTP is ${otp}.

This code expires in 5 minutes. For your security, never share this code with anyone.

If you did not request this code, please ignore this email.

Shopspace Team`,

  html: `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shopspace Verification</title>
  </head>

  <body style="margin:0;padding:0;background:#f3f4f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">

    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your Shopspace verification code is ${otp}. It expires in 5 minutes.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
      style="background:#f3f4f8;padding:35px 12px;">
      <tr>
        <td align="center">

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;">

            <!-- Premium Header -->
            <tr>
              <td align="center"
                style="padding:35px 25px;background:#17152f;background-image:linear-gradient(135deg,#17152f,#5145cd);">

                <div style="font-size:29px;font-weight:800;letter-spacing:-1px;color:#ffffff;">
                  SHOP<span style="color:#a5f3fc;">SPACE</span>
                </div>

                <p style="margin:10px 0 0;font-size:12px;letter-spacing:3px;color:#dcd9ff;">
                  YOUR WORLD. YOUR SHOPPING.
                </p>

              </td>
            </tr>

            <!-- Email Content -->
            <tr>
              <td style="padding:35px 30px 20px;">

                <p style="margin:0 0 10px;font-size:14px;color:#6b7280;">
                  ${isLogin ? "SECURE LOGIN" : "EMAIL VERIFICATION"}
                </p>

                <h1 style="margin:0 0 18px;font-size:27px;line-height:1.35;color:#17152f;">
                  ${isLogin ? "Welcome back" : "Welcome to Shopspace"},
                  ${userName || "there"}!
                </h1>

                <p style="margin:0 0 25px;font-size:15px;line-height:1.8;color:#5b6170;">
                  ${
                    isLogin
                      ? "We received a request to sign in to your account. Use the verification code below to continue securely."
                      : "We're excited to have you here! Please verify your email address using the code below to complete your registration."
                  }
                </p>

                <!-- OTP Box -->
                <div style="padding:25px 15px;text-align:center;background:#f5f3ff;border:1px solid #e5e0ff;border-radius:16px;">

                  <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:2px;color:#6d5ce8;">
                    YOUR VERIFICATION CODE
                  </p>

                  <div style="display:inline-block;padding:15px 20px;background:#ffffff;border:1px solid #e6e2ff;border-radius:12px;font-size:34px;font-weight:800;letter-spacing:10px;color:#5145cd;">
                    ${otp}
                  </div>

                  <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
                    ⏱ Expires in <strong style="color:#dc2626;">5 minutes</strong>
                  </p>

                </div>

                <!-- Security Notice -->
                <div style="margin-top:25px;padding:16px;background:#fff8eb;border-left:4px solid #f59e0b;border-radius:8px;">

                  <p style="margin:0;font-size:13px;line-height:1.7;color:#92400e;">
                    <strong>Security reminder</strong><br />
                    Never share this code with anyone. Shopspace will never ask you to disclose your OTP.
                  </p>

                </div>

                <p style="margin:25px 0 0;font-size:14px;line-height:1.8;color:#6b7280;">
                  If you didn't request this ${
                    isLogin ? "login" : "verification"
                  }, you can safely ignore this email. Your account remains protected.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center"
                style="padding:25px 20px;background:#fafaff;border-top:1px solid #eeeef5;">

                <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#302b60;">
                  Shopspace
                </p>

                <p style="margin:0;font-size:12px;line-height:1.7;color:#9ca3af;">
                  Shopping made simple. Security made important.<br />
                  This is an automated email. Please do not reply.
                </p>

                <p style="margin:15px 0 0;font-size:11px;color:#b0b4c0;">
                  © ${new Date().getFullYear()} Shopspace. All rights reserved.
                </p>

              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `,
});

};
