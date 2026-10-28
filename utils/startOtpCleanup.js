
import Customer from "../Model/Customer.js";

export const cleanupExpiredLoginOtps = async () => {
  const result = await Customer.updateMany(
    {
      loginOtpHash: { $exists: true, $ne: null },
      loginOtpExpires: {
        $exists: true,
        $ne: null,
        $lte: new Date(),
      },
    },
    {
      $unset: {
        loginOtpHash: 1,
        loginOtpExpires: 1,
        loginOtpAttempts: 1,
      },
    }
  );

  return result.modifiedCount;
};
