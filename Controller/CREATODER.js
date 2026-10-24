
import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";
import Customer from "../Model/Customer.js";
import Product from "../Model/Product.js";
import { sendInvoiceEmail } from "../Service/sendInvoiceEmail.js";

import {
  getOrderListCache,
  setOrderListCache,
  clearOrderListCache,
} from "../utils/orderCache.js";

/* =========================================================
   HELPERS
========================================================= */

const normalizeValue = (value) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    return String(
      value.name ??
        value.value ??
        value.label ??
        value.title ??
        value.$oid ??
        value._id ??
        "",
    ).trim();
  }

  return String(value).trim();
};

const getVariantColor = (variant) =>
  normalizeValue(variant?.color);

const getVariantId = (variant) => {
  if (!variant?._id) return null;

  const id = normalizeValue(variant._id);

  return mongoose.Types.ObjectId.isValid(id) ? id : null;
};

const findMatchingVariant = (product, selectedVariant = {}) => {
  if (!Array.isArray(product?.variants) || !product.variants.length) {
    return null;
  }

  const selectedColor = normalizeValue(selectedVariant.color);
  const selectedRam = normalizeValue(selectedVariant.ram);
  const selectedStorage = normalizeValue(selectedVariant.storage);

  return (
    product.variants.find((variant) => {
      const colorMatch =
        !selectedColor ||
        getVariantColor(variant) === selectedColor;

      const ramMatch =
        !selectedRam ||
        normalizeValue(variant.ram) === selectedRam;

      const storageMatch =
        !selectedStorage ||
        normalizeValue(variant.storage) === selectedStorage;

      return colorMatch && ramMatch && storageMatch;
    }) || null
  );
};

const getColorImage = (product, selectedColor) => {
  if (!Array.isArray(product?.colors) || !selectedColor) {
    return "";
  }

  const color = product.colors.find(
    (item) =>
      normalizeValue(item?.name) === normalizeValue(selectedColor),
  );

  return color?.image || "";
};

/* =========================================================
   CREATE ORDER
   POST /api/orders
========================================================= */

export const createOrder = async (req, res) => {
  try {
    const {
      customerName,
      email,
      phone,
      selectArea,
      deliveryAddress,
      note,
      products,
      deliveryCharge,
      discountAmount,
      couponCode,
      paymentMethod,
      deliveryMethod,
      termsAgreed,
      orderSource,
    } = req.body;

    /* BASIC VALIDATION */

    if (
      typeof customerName !== "string" ||
      !customerName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    if (!selectArea) {
      return res.status(400).json({
        success: false,
        message: "Delivery area is required",
      });
    }

    if (
      typeof deliveryAddress !== "string" ||
      !deliveryAddress.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    if (termsAgreed !== true && termsAgreed !== "true") {
      return res.status(400).json({
        success: false,
        message: "Please agree to Terms and Conditions",
      });
    }

    const cleanPhone = phone.trim();
    const cleanEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    /* FIND OR CREATE CUSTOMER */

    let customer = await Customer.findOne({
      phone: cleanPhone,
    });

    if (!customer) {
      customer = await Customer.create({
        name: customerName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        address: deliveryAddress.trim(),
      });
    } else {
      customer.name = customerName.trim();

      if (cleanEmail) {
        customer.email = cleanEmail;
      }

      customer.address = deliveryAddress.trim();

      await customer.save();
    }

    /* PREPARE PRODUCTS AND STOCK UPDATES */

    const orderProducts = [];
    const stockUpdates = [];

    for (const item of products) {
      const productId =
        item.productId ||
        item.product ||
        item._id ||
        item.id;

      if (
        !productId ||
        !mongoose.Types.ObjectId.isValid(String(productId))
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing or invalid product ID",
        });
      }

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.name || "Unknown product"}`,
        });
      }

      const quantity = Number(item.quantity ?? 1);

      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `${product.name}: invalid quantity`,
        });
      }

      const selectedVariant = item.variant || {
        color: item.color || "",
        ram: item.ram || "",
        storage: item.storage || "",
        variantId: item.variantId || null,
        sku: item.sku || "",
      };

      let matchedVariant = null;

      if (Array.isArray(product.variants) && product.variants.length) {
        const selectedVariantId = normalizeValue(
          selectedVariant.variantId,
        );

        if (
          selectedVariantId &&
          mongoose.Types.ObjectId.isValid(selectedVariantId)
        ) {
          matchedVariant = product.variants.find(
            (variant) =>
              String(variant._id) === selectedVariantId,
          );
        }

        if (!matchedVariant) {
          matchedVariant = findMatchingVariant(
            product,
            selectedVariant,
          );
        }

        if (!matchedVariant) {
          return res.status(400).json({
            success: false,
            message: `${product.name}: selected variant is not available`,
          });
        }
      }

      const color = matchedVariant
        ? getVariantColor(matchedVariant)
        : normalizeValue(selectedVariant.color || item.color);

      const ram = matchedVariant
        ? normalizeValue(matchedVariant.ram)
        : normalizeValue(selectedVariant.ram || item.ram);

      const storage = matchedVariant
        ? normalizeValue(matchedVariant.storage)
        : normalizeValue(selectedVariant.storage || item.storage);

      const currentStock = matchedVariant
        ? Number(matchedVariant.stock ?? 0)
        : Number(product.stock ?? 0);

      if (!Number.isFinite(currentStock) || currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `${product.name} has only ${Math.max(0, currentStock || 0)} item(s) in stock`,
        });
      }

      const price = Number(
        matchedVariant
          ? matchedVariant.price
          : product.discountPrice || product.price,
      );

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: `${product.name} has an invalid price`,
        });
      }

      let image = "";

      if (matchedVariant?.image) {
        image = matchedVariant.image;
      }

      if (!image && color) {
        image = getColorImage(product, color);
      }

      if (!image && Array.isArray(product.images)) {
        image = product.images[0] || "";
      }

      const variantId = matchedVariant
        ? getVariantId(matchedVariant)
        : null;

      const sku = matchedVariant
        ? normalizeValue(matchedVariant.sku)
        : normalizeValue(selectedVariant.sku);

      orderProducts.push({
        product: product._id,
        name: product.name,
        price,
        quantity,
        color,
        ram,
        storage,
        variantId,
        sku,
        size: normalizeValue(item.size),
        image,
        subtotal: price * quantity,
      });

      stockUpdates.push({
        productId: String(product._id),
        variantId: matchedVariant
          ? String(matchedVariant._id)
          : null,
        quantity,
      });
    }

    /* CALCULATE SUBTOTAL */

    const calculatedSubTotal = orderProducts.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );

    /* DELIVERY CHARGE */

    const requestedDeliveryCharge = Number(deliveryCharge ?? 0);

    if (
      !Number.isFinite(requestedDeliveryCharge) ||
      requestedDeliveryCharge < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery charge",
      });
    }

    /* DISCOUNT */

    const requestedDiscount = Number(discountAmount ?? 0);

    if (
      !Number.isFinite(requestedDiscount) ||
      requestedDiscount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount amount",
      });
    }

    const safeDiscountAmount = Math.min(
      requestedDiscount,
      calculatedSubTotal,
    );

    const calculatedTotalAmount = Math.max(
      0,
      calculatedSubTotal +
        requestedDeliveryCharge -
        safeDiscountAmount,
    );

    /* REDUCE STOCK */

    for (const stockItem of stockUpdates) {
      const productId = new mongoose.Types.ObjectId(
        stockItem.productId,
      );

      const quantity = stockItem.quantity;

      if (stockItem.variantId) {
        const variantId = new mongoose.Types.ObjectId(
          stockItem.variantId,
        );

        const result = await Product.updateOne(
          {
            _id: productId,
            stock: { $gte: quantity },
            variants: {
              $elemMatch: {
                _id: variantId,
                stock: { $gte: quantity },
              },
            },
          },
          {
            $inc: {
              "variants.$[selectedVariant].stock": -quantity,
              stock: -quantity,
            },
          },
          {
            arrayFilters: [
              {
                "selectedVariant._id": variantId,
                "selectedVariant.stock": { $gte: quantity },
              },
            ],
          },
        );

        if (result.modifiedCount !== 1) {
          return res.status(409).json({
            success: false,
            message: "Selected variant stock is no longer available",
          });
        }
      } else {
        const result = await Product.updateOne(
          {
            _id: productId,
            stock: { $gte: quantity },
          },
          {
            $inc: {
              stock: -quantity,
            },
          },
        );

        if (result.modifiedCount !== 1) {
          return res.status(409).json({
            success: false,
            message: "Product stock is no longer available",
          });
        }
      }
    }

    /* CREATE ORDER */

    const orderId = `ORD-${Date.now()}`;

    const order = await MainOrder.create({
      orderId,
      customer: customer._id,
      customerName: customerName.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      selectArea,
      deliveryAddress: deliveryAddress.trim(),
      note: typeof note === "string" ? note.trim() : "",
      products: orderProducts,
      subTotal: calculatedSubTotal,
      deliveryCharge: requestedDeliveryCharge,
      discountAmount: safeDiscountAmount,
      couponCode:
        typeof couponCode === "string"
          ? couponCode.trim().toUpperCase()
          : "",
      totalAmount: calculatedTotalAmount,
      paymentMethod: paymentMethod || "cash_on_delivery",
      paymentStatus: "unpaid",
      deliveryMethod: deliveryMethod || "courier_service",
      status: "pending",
      termsAgreed: true,
      source: orderSource || "website",
    });

    // Clear the cached order lists after successful order creation.
    await clearOrderListCache();

    /* SEND INVOICE EMAIL */

    let invoiceEmailSent = false;

    if (cleanEmail) {
      try {
        await sendInvoiceEmail(order);
        invoiceEmailSent = true;

        console.log(
          "Invoice email sent successfully:",
          order.orderId,
          cleanEmail,
        );
      } catch (emailError) {
        console.error(
          "INVOICE EMAIL ERROR:",
          order.orderId,
          emailError.message,
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        orderId: order.orderId,
        order,
        invoiceEmailSent,
      },
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

/* =========================================================
   GET ALL ORDERS
   GET /api/orders?page=1&limit=20&status=pending
========================================================= */

export const getAllOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20),
    );

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : "";

    const filter = {};

    if (status) {
      filter.status = status;
    }

    // Separate cache keys for pagination, filters and authenticated users.
    const cacheKey = JSON.stringify({
      page,
      limit,
      status,
      userId: String(req.user?._id ?? req.user?.id ?? "shared"),
      role: String(req.user?.role ?? "public"),
    });

    const cachedData = await getOrderListCache(cacheKey);

    if (cachedData !== null) {
      res.set("X-Cache", "HIT");
      return res.status(200).json(cachedData);
    }

    const [orders, total] = await Promise.all([
      MainOrder.find(filter)
        .select(
          "orderId customerName phone status source totalAmount createdAt",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      MainOrder.countDocuments(filter),
    ]);

    const responseData = {
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    await setOrderListCache(cacheKey, responseData);

    res.set("X-Cache", "MISS");

    return res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   GET SINGLE ORDER BY MONGODB ID
   GET /api/orders/id/:id
========================================================= */

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await MainOrder.findById(id)
      .populate("customer", "name email phone address")
      .populate(
        "products.product",
        "name price discountPrice stock images colors variants",
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("GET ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get order",
    });
  }
};

/* =========================================================
   GET ORDER BY CUSTOM ORDER ID
   GET /api/orders/order-id/:orderId
========================================================= */

export const getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await MainOrder.findOne({ orderId })
      .populate("customer", "name email phone address")
      .populate(
        "products.product",
        "name price discountPrice stock images colors variants",
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("GET ORDER BY ORDER ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get order",
    });
  }
};

/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "ready_for_shipment",
      "handed_over_to_courier",
      "shipped",
      "delivered",
      "returned",
      "cancelled",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await MainOrder.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await clearOrderListCache();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

/* =========================================================
   UPDATE PAYMENT STATUS
========================================================= */

export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const allowedStatuses = [
      "unpaid",
      "partially_paid",
      "paid",
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const order = await MainOrder.findByIdAndUpdate(
      id,
      { paymentStatus },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await clearOrderListCache();

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("UPDATE PAYMENT STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update payment status",
    });
  }
};

/* =========================================================
   GET ORDER DETAILS
   GET /api/orders/:orderId
========================================================= */

export const getOrderDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    let order = null;

    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await MainOrder.findById(orderId).lean();
    }

    if (!order) {
      order = await MainOrder.findOne({ orderId }).lean();
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   GET ORDER NAVIGATION
   GET /api/orders/:orderId/navigation
========================================================= */

export const getOrderNavigation = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    let currentOrder = null;

    if (mongoose.Types.ObjectId.isValid(orderId)) {
      currentOrder = await MainOrder.findById(orderId)
        .select("_id orderId createdAt")
        .lean();
    }

    if (!currentOrder) {
      currentOrder = await MainOrder.findOne({ orderId })
        .select("_id orderId createdAt")
        .lean();
    }

    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentDate = currentOrder.createdAt ?? new Date(0);

    const [previousOrder, nextOrder] = await Promise.all([
      MainOrder.findOne({
        $or: [
          { createdAt: { $lt: currentDate } },
          {
            createdAt: currentDate,
            _id: { $lt: currentOrder._id },
          },
        ],
      })
        .sort({ createdAt: -1, _id: -1 })
        .select("_id orderId createdAt")
        .lean(),

      MainOrder.findOne({
        $or: [
          { createdAt: { $gt: currentDate } },
          {
            createdAt: currentDate,
            _id: { $gt: currentOrder._id },
          },
        ],
      })
        .sort({ createdAt: 1, _id: 1 })
        .select("_id orderId createdAt")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        previousOrderId: previousOrder?._id?.toString() ?? null,
        nextOrderId: nextOrder?._id?.toString() ?? null,
        previousOrder,
        nextOrder,
      },
    });
  } catch (error) {
    next(error);
  }
};
