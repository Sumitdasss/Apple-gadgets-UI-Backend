
import Customer from "../Model/Customer.js";

export const startOtpCleanup = async () => {
  try {
    const now = new Date();

    const result = await Customer.updateMany(
      {
        isEmailVerified: false,
        emailOtpExpires: {
          $exists: true,
          $ne: null,
          $lte: now,
        },
        emailOtpHash: {
          $exists: true,
          $ne: null,
        },
      },
      {
        $unset: {
          emailOtpHash: 1,
          emailOtpExpires: 1,
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `Expired registration OTPs cleaned: ${result.modifiedCount}`
      );
    }

    return result.modifiedCount;
  } catch (error) {
    console.error("OTP cleanup failed:", error.message);
    throw error;
  }
};
