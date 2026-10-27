
import crypto from "node:crypto";
import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";

const IS_LIVE = process.env.SSLCOMMERZ_IS_LIVE === "true";

const SESSION_URL = IS_LIVE
  ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
  : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

const VALIDATION_URL = IS_LIVE
  ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
  : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "").replace(/\/+$/, "");

const getBackendUrl = () =>
  (process.env.BACKEND_URL || "").replace(/\/+$/, "");

const getUserId = (req) => req.user?._id || req.user?.id || null;

const sameId = (a, b) =>
  a != null && b != null && String(a) === String(b);

const getOrderTotal = (order) => {
  const amount = Number(order?.totalAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Number(amount.toFixed(2));
};

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const getPayload = (req) => ({
  ...(req.query || {}),
  ...(req.body || {}),
});

const makeTransactionId = () =>
  `AG-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

const validateConfiguration = () => {
  const missing = [];

  if (!process.env.SSLCOMMERZ_STORE_ID) {
    missing.push("SSLCOMMERZ_STORE_ID");
  }

  if (!process.env.SSLCOMMERZ_STORE_PASSWORD) {
    missing.push("SSLCOMMERZ_STORE_PASSWORD");
  }

  if (!getFrontendUrl()) missing.push("FRONTEND_URL");
  if (!getBackendUrl()) missing.push("BACKEND_URL");

  return missing;
};

/* =========================================================
   REDIRECT HELPERS
========================================================= */

const redirectToFrontend = (res, order, status) => {
  const frontendUrl = getFrontendUrl();

  console.log("[SSL] redirectToFrontend", {
    frontendUrl,
    status,
    orderId: order?.orderId,
  });

  if (!frontendUrl) {
    console.error("[SSL] FRONTEND_URL missing at runtime");
    return res
      .status(500)
      .send("FRONTEND_URL is not configured on the server.");
  }

  // Trailing slash avoid করে absolute URL
  const base = frontendUrl.endsWith("/")
    ? frontendUrl.slice(0, -1)
    : frontendUrl;

  const url = new URL(`${base}/payment/result`);
  url.searchParams.set("status", status);

  if (order?.orderId) {
    url.searchParams.set("orderId", String(order.orderId));
  }

  // Prevent caching of the callback response
  res.setHeader("Cache-Control", "no-store");

  return res.redirect(303, url.toString());
};

const redirectWithoutOrder = (res, status) => {
  const frontendUrl = getFrontendUrl();

  if (!frontendUrl) {
    return res.status(500).send("FRONTEND_URL is not configured.");
  }

  const url = new URL("/payment/result", `${frontendUrl}/`);

  url.searchParams.set("status", status);

  return res.redirect(303, url.toString());
};

/* =========================================================
   INITIATE PAYMENT
   POST /api/payment/sslcommerz/initiate

   Route must use verifyToken middleware.
========================================================= */

export const initiateSSLCommerzPayment = async (req, res) => {
  let order = null;

  try {
    const missing = validateConfiguration();

    if (missing.length) {
      console.error("SSLCOMMERZ configuration missing:", missing);

      return sendError(
        res,
        500,
        "Payment configuration is incomplete."
      );
    }

    const userId = getUserId(req);
    const { orderId } = req.body || {};

    if (!userId) {
      return sendError(res, 401, "Please login first.");
    }

    if (!orderId || typeof orderId !== "string") {
      return sendError(res, 400, "Valid orderId is required.");
    }

    const filter = mongoose.isValidObjectId(orderId)
      ? {
          $or: [
            { orderId },
            { _id: orderId },
          ],
        }
      : { orderId };

    order = await MainOrder.findOne(filter);

    if (!order) {
      return sendError(res, 404, "Order not found.");
    }

    if (!sameId(order.customer, userId)) {
      return sendError(
        res,
        403,
        "You cannot pay for this order."
      );
    }

    const totalAmount = getOrderTotal(order);

    if (totalAmount === null) {
      return sendError(res, 400, "Invalid order totalAmount.");
    }

    if (order.paymentStatus === "paid") {
      return sendError(res, 409, "This order is already paid.");
    }

    if (order.paymentStatus === "partially_paid") {
      return sendError(
        res,
        409,
        "This order already has a partial payment. Remaining-payment flow is not enabled."
      );
    }

    if (order.paymentStatus === "pending") {
      return sendError(
        res,
        409,
        "A payment is already pending for this order."
      );
    }

    if (
      !["online_payment", "partial_payment"].includes(
        order.paymentMethod
      )
    ) {
      return sendError(
        res,
        400,
        "This order is not configured for online payment."
      );
    }

    let payableAmount = totalAmount;

    if (order.paymentMethod === "partial_payment") {
      const percent = Number(
        process.env.PARTIAL_PAYMENT_PERCENT || 20
      );

      if (
        !Number.isFinite(percent) ||
        percent <= 0 ||
        percent > 100
      ) {
        return sendError(
          res,
          500,
          "PARTIAL_PAYMENT_PERCENT must be between 1 and 100."
        );
      }

      payableAmount = Number(
        ((totalAmount * percent) / 100).toFixed(2)
      );
    }

    const tranId = makeTransactionId();

    const callbackBase =
      `${getBackendUrl()}/api/payment/sslcommerz`;

    const params = new URLSearchParams({
      store_id: process.env.SSLCOMMERZ_STORE_ID,
      store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,

      total_amount: payableAmount.toFixed(2),
      currency: "BDT",
      tran_id: tranId,

      success_url: `${callbackBase}/successGet`,
      fail_url: `${callbackBase}/failGet`,
      cancel_url: `${callbackBase}/cancelGet`,
      ipn_url: `${callbackBase}/ipnPost`,

      shipping_method: "NO",
      product_name: `Order ${String(
        order.orderId || order._id
      )}`.slice(0, 200),
      product_category: "Electronics",
      product_profile: "general",

      cus_name: String(
        order.customerName || "Customer"
      ).slice(0, 100),

      cus_email: String(
        order.email || "customer@example.com"
      ).slice(0, 100),

      cus_add1: String(
        order.deliveryAddress || "Bangladesh"
      ).slice(0, 200),

      cus_city: String(
        order.selectArea || "Dhaka"
      ).slice(0, 50),

      cus_postcode: "1000",
      cus_country: "Bangladesh",

      cus_phone: String(
        order.phone || "01700000000"
      ).slice(0, 20),

      value_a: String(order.orderId || order._id),
      value_b: String(order.paymentMethod),
    });

    /*
     * Save transaction information before calling the gateway.
     * If session creation fails, reset status to failed so retry
     * can be attempted.
     */
    order.paymentStatus = "pending";
    order.sslcommerzTranId = tranId;
    order.sslcommerzExpectedAmount = payableAmount;
    order.paymentCurrency = "BDT";

    await order.save();

    const gatewayResponse = await fetch(SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const gatewayData = await gatewayResponse
      .json()
      .catch(() => null);

    if (
      !gatewayResponse.ok ||
      gatewayData?.status !== "SUCCESS" ||
      !gatewayData?.GatewayPageURL
    ) {
      order.paymentStatus = "failed";
      await order.save();

      console.error("SSLCOMMERZ session creation failed:", {
        httpStatus: gatewayResponse.status,
        gatewayStatus: gatewayData?.status,
        failedreason: gatewayData?.failedreason,
      });

      return sendError(
        res,
        502,
        "SSLCOMMERZ payment session could not be created."
      );
    }

    return res.status(200).json({
      success: true,
      message: "Payment session created.",
      data: {
        GatewayPageURL: gatewayData.GatewayPageURL,
        tranId,
        amount: payableAmount,
        currency: "BDT",
      },
    });
  } catch (error) {
    console.error(
      "initiateSSLCommerzPayment:",
      error.message
    );

    if (order && order.paymentStatus === "pending") {
      order.paymentStatus = "failed";

      await order.save().catch((saveError) => {
        console.error(
          "Could not reset payment status:",
          saveError.message
        );
      });
    }

    return sendError(
      res,
      500,
      "Could not initiate payment."
    );
  }
};

/* =========================================================
   SERVER-SIDE TRANSACTION VALIDATION
========================================================= */

const validateTransaction = async (payload) => {
  const valId = payload?.val_id;
  const callbackTranId = payload?.tran_id;

  if (!valId || !callbackTranId) {
    throw new Error(
      "Callback is missing val_id or tran_id."
    );
  }

  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword =
    process.env.SSLCOMMERZ_STORE_PASSWORD;

  if (!storeId || !storePassword) {
    throw new Error(
      "SSLCOMMERZ credentials are not configured."
    );
  }

  const params = new URLSearchParams({
    val_id: String(valId),
    store_id: storeId,
    store_passwd: storePassword,
    format: "json",
  });

  const response = await fetch(
    `${VALIDATION_URL}?${params.toString()}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok || !data) {
    throw new Error(
      `SSLCOMMERZ validation HTTP error (${response.status}).`
    );
  }

  const validationStatus =
    String(data.status || "").toUpperCase();

  if (!["VALID", "VALIDATED"].includes(validationStatus)) {
    throw new Error(
      `SSLCOMMERZ validation status: ${
        validationStatus || "missing"
      }.`
    );
  }

  if (
    String(data.tran_id) !== String(callbackTranId)
  ) {
    throw new Error("Transaction ID mismatch.");
  }

  if (
    String(data.currency || "").toUpperCase() !== "BDT"
  ) {
    throw new Error("Transaction currency mismatch.");
  }

  return data;
};

/* =========================================================
   PROCESS SUCCESSFUL PAYMENT
========================================================= */

const processSuccessfulPayment = async (payload) => {
  const validated = await validateTransaction(payload);

  const order = await MainOrder.findOne({
    sslcommerzTranId: String(validated.tran_id),
  });

  if (!order) {
    throw new Error(
      "No order matches the validated transaction ID."
    );
  }

  const expectedAmount =
    Number(order.sslcommerzExpectedAmount);

  const actualAmount = Number(validated.amount);

  if (
    !Number.isFinite(expectedAmount) ||
    !Number.isFinite(actualAmount) ||
    Math.abs(expectedAmount - actualAmount) > 0.01
  ) {
    order.paymentStatus = "review";
    await order.save();

    throw new Error(
      `Amount mismatch: expected=${expectedAmount}, received=${actualAmount}.`
    );
  }

  const validatedCurrency =
    String(validated.currency || "").toUpperCase();

  const storedCurrency =
    String(order.paymentCurrency || "").toUpperCase();

  if (
    storedCurrency !== validatedCurrency ||
    validatedCurrency !== "BDT"
  ) {
    order.paymentStatus = "review";
    await order.save();

    throw new Error(
      `Currency mismatch: stored=${storedCurrency}, received=${validatedCurrency}.`
    );
  }

  /*
   * Idempotency guard:
   * do not count the same validated transaction twice.
   */
  if (
    order.sslcommerzValidationId &&
    String(order.sslcommerzValidationId) ===
      String(validated.val_id)
  ) {
    return order;
  }

  if (["paid", "partially_paid"].includes(order.paymentStatus)) {
    return order;
  }

  /*
   * Only accept a payment belonging to the pending transaction.
   */
  if (order.paymentStatus !== "pending") {
    throw new Error(
      `Unexpected order payment status: ${order.paymentStatus}.`
    );
  }

  order.sslcommerzValidationId = String(validated.val_id);

  order.bankTransactionId = validated.bank_tran_id
    ? String(validated.bank_tran_id)
    : null;

  order.paymentAmount = Number(
    (
      Number(order.paymentAmount || 0) + actualAmount
    ).toFixed(2)
  );

  const totalAmount = getOrderTotal(order);

  if (totalAmount === null) {
    order.paymentStatus = "review";
  } else if (
    order.paymentAmount + 0.01 >= totalAmount
  ) {
    order.paymentStatus = "paid";
  } else {
    order.paymentStatus = "partially_paid";
  }

  await order.save();

  return order;
};

/* =========================================================
   SUCCESS CALLBACK
========================================================= */

export const sslcommerzSuccess = async (req, res) => {
  const payload = getPayload(req);
  

  try {
    const order = await processSuccessfulPayment(payload);

    const status =
      order.paymentStatus === "paid"
        ? "success"
        : order.paymentStatus === "partially_paid"
          ? "partial"
          : "review";

    return redirectToFrontend(res, order, status);
  } catch (error) {
    console.error(
      "sslcommerzSuccess:",
      error.message
    );

    const tranId = payload?.tran_id;

    const order = tranId
      ? await MainOrder.findOne({
          sslcommerzTranId: String(tranId),
        }).catch(() => null)
      : null;

    if (order) {
      /*
       * Do not overwrite a previously confirmed payment.
       * Keep review status when validation or amount checks fail.
       */
      if (
        !["paid", "partially_paid", "review"].includes(
          order.paymentStatus
        )
      ) {
        order.paymentStatus = "review";

        await order.save().catch((saveError) => {
          console.error(
            "Could not mark order for review:",
            saveError.message
          );
        });
      }

      return redirectToFrontend(res, order, "review");
    }

    return redirectWithoutOrder(res, "failed");
  }
};

/* =========================================================
   FAILED / CANCELLED CALLBACKS
========================================================= */

const handleUnsuccessfulPayment = async (
  req,
  res,
  status
) => {
  try {
    const payload = getPayload(req);
    const tranId = payload?.tran_id;

    const order = tranId
      ? await MainOrder.findOne({
          sslcommerzTranId: String(tranId),
        })
      : null;

    if (!order) {
      return redirectWithoutOrder(res, status);
    }

    /*
     * Never downgrade a confirmed successful payment.
     */
    if (
      !["paid", "partially_paid"].includes(
        order.paymentStatus
      )
    ) {
      order.paymentStatus = status;
      await order.save();
    }

    return redirectToFrontend(res, order, status);
  } catch (error) {
    console.error(
      `SSLCOMMERZ ${status}:`,
      error.message
    );

    return redirectWithoutOrder(res, "review");
  }
};

export const sslcommerzFail = (req, res) =>
  handleUnsuccessfulPayment(req, res, "failed");

export const sslcommerzCancel = (req, res) =>
  handleUnsuccessfulPayment(req, res, "cancelled");

/* =========================================================
   IPN CALLBACK
========================================================= */

export const sslcommerzIPN = async (req, res) => {
  try {
    await processSuccessfulPayment(getPayload(req));

    return res.status(200).send("IPN processed");
  } catch (error) {
    console.error(
      "sslcommerzIPN:",
      error.message
    );

    return res.status(400).send(
      "IPN validation failed"
    );
  }
};
