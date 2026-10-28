
import Customer from "../Model/Customer.js";

export const startOtpCleanup = async () => {
  const now = new Date();

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
      $unset: {
        emailOtpHash: 1,
        emailOtpExpires: 1,
      },
    }
  );

  const loginResult = await cleanupExpiredLoginOtps();

  return (
    registrationResult.modifiedCount +
    loginResult
  );
};
