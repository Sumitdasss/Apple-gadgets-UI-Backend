
// import crypto from "node:crypto";
// import mongoose from "mongoose";
// import MainOrder from "../Model/MainOrder.js";

// const IS_LIVE = process.env.SSLCOMMERZ_IS_LIVE === "true";

// const SESSION_URL = IS_LIVE
//   ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
//   : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

// const VALIDATION_URL = IS_LIVE
//   ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
//   : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

// const FRONTEND_URL = process.env.FRONTEND_URL;
// const BACKEND_URL = process.env.BACKEND_URL;

// const getOrderTotal = (order) => {
//   const amount = Number(order?.totalAmount);

//   if (!Number.isFinite(amount) || amount <= 0) {
//     return null;
//   }

//   return Number(amount.toFixed(2));
// };

// const getUserId = (req) =>
//   req.user?._id || req.user?.id || null;

// const sameId = (a, b) =>
//   a != null && b != null && String(a) === String(b);

// const validConfig = () =>
//   Boolean(
//     process.env.SSLCOMMERZ_STORE_ID &&
//       process.env.SSLCOMMERZ_STORE_PASSWORD &&
//       FRONTEND_URL &&
//       BACKEND_URL
//   );

// const makeTransactionId = () =>
//   `AG-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

// const sendJsonError = (res, status, message) =>
//   res.status(status).json({
//     success: false,
//     message,
//   });

// /**
//  * POST /api/payment/sslcommerz/initiate
//  * Body: { orderId }
//  *
//  * Route-এ customer authentication middleware লাগবে।
//  */
// export const initiateSSLCommerzPayment = async (req, res) => {
//   try {
//     if (!validConfig()) {
//       return sendJsonError(
//         res,
//         500,
//         "SSLCOMMERZ environment configuration missing."
//       );
//     }

//     const userId = getUserId(req);
//     const { orderId } = req.body || {};

//     if (!userId) {
//       return sendJsonError(res, 401, "Login required.");
//     }

//     if (!orderId || typeof orderId !== "string") {
//       return sendJsonError(res, 400, "Valid orderId is required.");
//     }

//     // Supports orderId string or MongoDB _id
//     const filter = mongoose.isValidObjectId(orderId)
//       ? {
//           $or: [
//             { orderId },
//             { _id: orderId },
//           ],
//         }
//       : { orderId };

//     const order = await MainOrder.findOne(filter);

//     if (!order) {
//       return sendJsonError(res, 404, "Order not found.");
//     }

//     // Customer must only pay for their own order.
//     if (!sameId(order.customer, userId)) {
//       return sendJsonError(res, 403, "You cannot pay for this order.");
//     }

//     const totalAmount = getOrderTotal(order);

//     if (totalAmount === null) {
//       return sendJsonError(
//         res,
//         400,
//         "Order totalAmount is invalid."
//       );
//     }

//     if (
//       order.paymentStatus === "paid" ||
//       order.paymentStatus === "partially_paid"
//     ) {
//       return sendJsonError(
//         res,
//         409,
//         "This order already has a successful payment. Contact support for another payment."
//       );
//     }

//     if (order.paymentStatus === "pending") {
//       return sendJsonError(
//         res,
//         409,
//         "A payment is already pending for this order."
//       );
//     }

//     if (
//       !["online_payment", "partial_payment"].includes(
//         order.paymentMethod
//       )
//     ) {
//       return sendJsonError(
//         res,
//         400,
//         "This order is not configured for online payment."
//       );
//     }

//     let payableAmount = totalAmount;

//     if (order.paymentMethod === "partial_payment") {
//       const percent = Number(
//         process.env.PARTIAL_PAYMENT_PERCENT || 20
//       );

//       if (
//         !Number.isFinite(percent) ||
//         percent <= 0 ||
//         percent > 100
//       ) {
//         return sendJsonError(
//           res,
//           500,
//           "PARTIAL_PAYMENT_PERCENT must be between 1 and 100."
//         );
//       }

//       payableAmount = Number(
//         ((totalAmount * percent) / 100).toFixed(2)
//       );
//     }

//     const tranId = makeTransactionId();

//     // Save pending status before creating the gateway session.
//     order.paymentStatus = "pending";
//     order.sslcommerzTranId = tranId;
//     order.sslcommerzExpectedAmount = payableAmount;
//     order.paymentCurrency = "BDT";
//     await order.save();

//    const callbackBase =
//   `${BACKEND_URL.replace(/\/+$/, "")}/api/payment/sslcommerz`;

//     const params = new URLSearchParams({
//       store_id: process.env.SSLCOMMERZ_STORE_ID,
//       store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
//       total_amount: payableAmount.toFixed(2),
//       currency: "BDT",
//       tran_id: tranId,

//     success_url: `${callbackBase}/successGet`,
//   fail_url: `${callbackBase}/failGet`,
//   cancel_url: `${callbackBase}/cancelGet`,
//   ipn_url: `${callbackBase}/ipnPost`,

//       shipping_method: "NO",
//       product_name: `Order ${order.orderId}`,
//       product_category: "Electronics",
//       product_profile: "general",

//       cus_name: String(order.customerName || "Customer").slice(0, 100),
//       cus_email: String(order.email || "customer@example.com").slice(0, 100),
//       cus_add1: String(order.deliveryAddress || "Bangladesh").slice(0, 200),
//       cus_city: String(order.selectArea || "Dhaka").slice(0, 50),
//       cus_postcode: "1000",
//       cus_country: "Bangladesh",
//       cus_phone: String(order.phone || "01700000000").slice(0, 20),

//       value_a: String(order.orderId),
//       value_b: order.paymentMethod,
//     });

//     const gatewayResponse = await fetch(SESSION_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       body: params.toString(),
//       signal: AbortSignal.timeout(15000),
//     });

//     const gatewayData = await gatewayResponse.json();

//     if (
//       !gatewayResponse.ok ||
//       gatewayData.status !== "SUCCESS" ||
//       !gatewayData.GatewayPageURL
//     ) {
//       order.paymentStatus = "failed";
//       await order.save();

//       console.error("SSLCOMMERZ session error:", {
//         status: gatewayData.status,
//         failedreason: gatewayData.failedreason,
//       });

//       return sendJsonError(
//         res,
//         502,
//         "SSLCOMMERZ payment session could not be created."
//       );
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Payment session created.",
//       data: {
//         GatewayPageURL: gatewayData.GatewayPageURL,
//         tranId,
//         amount: payableAmount,
//         currency: "BDT",
//       },
//     });
//   } catch (error) {
//     console.error("initiateSSLCommerzPayment:", error);

//     return sendJsonError(
//       res,
//       500,
//       "Could not initiate payment."
//     );
//   }
// };

// /**
//  * Validate a transaction with SSLCOMMERZ's server.
//  * Never trust the browser callback alone.
//  */
// const validateTransaction = async (payload) => {
//   const valId = payload?.val_id;
//   const tranId = payload?.tran_id;

//   if (!valId || !tranId) {
//     throw new Error("Missing val_id or tran_id.");
//   }

//   const params = new URLSearchParams({
//     val_id: String(valId),
//     store_id: process.env.SSLCOMMERZ_STORE_ID,
//     store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
//     format: "json",
//   });

//   const response = await fetch(
//     `${VALIDATION_URL}?${params.toString()}`,
//     {
//       method: "GET",
//       signal: AbortSignal.timeout(15000),
//     }
//   );

//   if (!response.ok) {
//     throw new Error("SSLCOMMERZ validation request failed.");
//   }

//   const data = await response.json();

//   if (!["VALID", "VALIDATED"].includes(data.status)) {
//     throw new Error("SSLCOMMERZ transaction is not valid.");
//   }

//   if (String(data.tran_id) !== String(tranId)) {
//     throw new Error("Transaction ID mismatch.");
//   }

//   if (String(data.currency).toUpperCase() !== "BDT") {
//     throw new Error("Transaction currency mismatch.");
//   }

//   return data;
// };

// /**
//  * Callback success and IPN both use this server-side validation.
//  * Repeated notifications must not count the same payment twice.
//  */
// const processSuccessfulPayment = async (payload) => {
//   const validated = await validateTransaction(payload);

//   const order = await MainOrder.findOne({
//     sslcommerzTranId: String(validated.tran_id),
//   });

//   if (!order) {
//     throw new Error("Matching order not found.");
//   }

//   const expectedAmount = Number(order.sslcommerzExpectedAmount);
//   const actualAmount = Number(validated.amount);

//   if (
//     !Number.isFinite(expectedAmount) ||
//     !Number.isFinite(actualAmount) ||
//     Math.abs(expectedAmount - actualAmount) > 0.01
//   ) {
//     order.paymentStatus = "review";
//     await order.save();
//     throw new Error("Payment amount mismatch; manual review required.");
//   }

//   if (order.paymentCurrency !== String(validated.currency).toUpperCase()) {
//     order.paymentStatus = "review";
//     await order.save();
//     throw new Error("Stored currency mismatch; manual review required.");
//   }

//   // Idempotency: do not add the same transaction twice.
//   if (
//     order.sslcommerzValidationId &&
//     String(order.sslcommerzValidationId) === String(validated.val_id)
//   ) {
//     return order;
//   }

//   if (order.paymentStatus === "paid" ||
//       order.paymentStatus === "partially_paid") {
//     return order;
//   }

//   order.sslcommerzValidationId = String(validated.val_id);
//   order.bankTransactionId = validated.bank_tran_id
//     ? String(validated.bank_tran_id)
//     : null;

//   order.paymentAmount = Number(
//     (Number(order.paymentAmount || 0) + actualAmount).toFixed(2)
//   );

//   const totalAmount = getOrderTotal(order);

//   if (totalAmount === null) {
//     order.paymentStatus = "review";
//   } else if (order.paymentAmount + 0.01 >= totalAmount) {
//     order.paymentStatus = "paid";
//   } else {
//     order.paymentStatus = "partially_paid";
//   }

//   await order.save();

//   return order;
// };

// const redirectToFrontend = (res, order, status) => {
//   const orderId = encodeURIComponent(order?.orderId || "");
//   const url = new URL("/payment/result", FRONTEND_URL);

//   url.searchParams.set("status", status);

//   if (orderId) {
//     url.searchParams.set("orderId", orderId);
//   }

//   return res.redirect(303, url.toString());
// };

// /**
//  * POST/GET /success
//  * Public callback from SSLCOMMERZ.
//  */
// export const sslcommerzSuccess = async (req, res) => {
//   try {
//     const payload = { ...req.query, ...req.body };
//     const order = await processSuccessfulPayment(payload);

//     return redirectToFrontend(
//       res,
//       order,
//       order.paymentStatus === "paid" ? "success" : "partial"
//     );
//   } catch (error) {
//     console.error("sslcommerzSuccess:", error.message);

//     const payload = { ...req.query, ...req.body };
//     const order = payload.tran_id
//       ? await MainOrder.findOne({
//           sslcommerzTranId: String(payload.tran_id),
//         }).catch(() => null)
//       : null;

//     if (order) {
//       return redirectToFrontend(res, order, "review");
//     }

//     const url = new URL("/payment/result", FRONTEND_URL);
//     url.searchParams.set("status", "failed");
//     return res.redirect(303, url.toString());
//   }
// };

// /**
//  * Gateway failure/cancel callbacks.
//  * Do not downgrade an already successful payment.
//  */
// const handleUnsuccessfulPayment = async (req, res, status) => {
//   try {
//     const payload = { ...req.query, ...req.body };
//     const tranId = payload.tran_id;

//     const order = tranId
//       ? await MainOrder.findOne({
//           sslcommerzTranId: String(tranId),
//         })
//       : null;

//     if (order && !["paid", "partially_paid"].includes(order.paymentStatus)) {
//       order.paymentStatus = status;
//       await order.save();
//     }

//     if (order) {
//       return redirectToFrontend(res, order, status);
//     }

//     const url = new URL("/payment/result", FRONTEND_URL);
//     url.searchParams.set("status", status);
//     return res.redirect(303, url.toString());
//   } catch (error) {
//     console.error(`SSLCOMMERZ ${status}:`, error);
//     const url = new URL("/payment/result", FRONTEND_URL);
//     url.searchParams.set("status", "review");
//     return res.redirect(303, url.toString());
//   }
// };

// export const sslcommerzFail = (req, res) =>
//   handleUnsuccessfulPayment(req, res, "failed");

// export const sslcommerzCancel = (req, res) =>
//   handleUnsuccessfulPayment(req, res, "cancelled");

// /**
//  * IPN is server-to-server. No customer authentication here.
//  * SSLCOMMERZ's notification must be validated before updating payment.
//  */
// export const sslcommerzIPN = async (req, res) => {
//   try {
//     await processSuccessfulPayment({
//       ...req.query,
//       ...req.body,
//     });

//     return res.status(200).send("IPN processed");
//   } catch (error) {
//     console.error("sslcommerzIPN:", error.message);

//     // Return a failure response so an invalid notification is not
//     // treated as a successfully processed payment.
//     return res.status(400).send("IPN validation failed");
//   }
// };
