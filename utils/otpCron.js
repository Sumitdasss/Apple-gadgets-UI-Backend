import cron from "node-cron";
import Customer from "../Model/Customer.js";

export const startOtpCleanupCron = () => {
  // প্রতি ১ মিনিটে expired OTP পরিষ্কার করবে
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const [emailResult, loginResult] = await Promise.all([
        Customer.updateMany(
          {
            emailOtpExpires: {
              $type: "date",
              $lte: now,
            },
          },
          {
            $set: {
              emailOtpHash: null,
              emailOtpExpires: null,
            },
          }
        ),

        Customer.updateMany(
          {
            loginOtpExpires: {
              $type: "date",
              $lte: now,
            },
          },
          {
            $set: {
              loginOtpHash: null,
              loginOtpExpires: null,
              loginOtpAttempts: 0,
            },
          }
        ),
      ]);

      console.log("Expired OTP cleanup completed", {
        emailOtps: emailResult.modifiedCount,
        loginOtps: loginResult.modifiedCount,
        time: now.toISOString(),
      });
    } catch (error) {
      console.error("OTP cleanup failed:", error);
    }
  });

  console.log("OTP cleanup cron started");
};