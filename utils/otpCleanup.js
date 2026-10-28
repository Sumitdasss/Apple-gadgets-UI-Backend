
import Customer from "../Model/Customer.js";

export const startOtpCleanup = async () => {
  const now = new Date();

  // Clean expired registration OTPs
  const registrationResult = await Customer.updateMany(
    {
      isEmailVerified: false,
      emailOtpHash: { $exists: true, $ne: null },
      emailOtpExpires: {
        $exists: true,
        $ne: null,
        $lte: now,
      },
    },
    {
      $set: {
        emailOtpHash: null,
        emailOtpExpires: null,
      },
    }
  );

  // Clean expired login OTPs
  const loginResult = await Customer.updateMany(
    {
      loginOtpHash: { $exists: true, $ne: null },
      loginOtpExpires: {
        $exists: true,
        $ne: null,
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
  );

  return {
    registrationCleaned: registrationResult.modifiedCount,
    loginCleaned: loginResult.modifiedCount,
    totalCleaned:
      registrationResult.modifiedCount +
      loginResult.modifiedCount,
  };
};
