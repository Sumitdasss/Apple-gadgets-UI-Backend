import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";
import Customer from "../Model/Customer.js";
import Product from "../Model/Product.js";

/* =========================================================
   HELPER
========================================================= */

const normalizeValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

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

/* =========================================================
   GET VARIANT COLOR
========================================================= */

const getVariantColor = (variant) => {
  return normalizeValue(variant?.color);
};

/* =========================================================
   GET VARIANT ID
========================================================= */

const getVariantId = (variant) => {
  if (!variant?._id) {
    return null;
  }

  const id = normalizeValue(variant._id);

  return mongoose.Types.ObjectId.isValid(id) ? id : null;
};

/* =========================================================
   FIND MATCHING VARIANT
========================================================= */

const findMatchingVariant = (product, selectedVariant = {}) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const selectedColor = normalizeValue(selectedVariant.color);

  const selectedRam = normalizeValue(selectedVariant.ram);

  const selectedStorage = normalizeValue(selectedVariant.storage);

  const variant = product.variants.find((item) => {
    const variantColor = getVariantColor(item);

    const variantRam = normalizeValue(item?.ram);

    const variantStorage = normalizeValue(item?.storage);

    const colorMatch = !selectedColor || variantColor === selectedColor;

    const ramMatch = !selectedRam || variantRam === selectedRam;

    const storageMatch = !selectedStorage || variantStorage === selectedStorage;

    return colorMatch && ramMatch && storageMatch;
  });

  return variant || null;
};

/* =========================================================
   GET COLOR IMAGE
========================================================= */

const getColorImage = (product, selectedColor) => {
  if (!Array.isArray(product?.colors) || !selectedColor) {
    return "";
  }

  const color = product.colors.find(
    (item) => normalizeValue(item?.name) === normalizeValue(selectedColor),
  );

  return color?.image || "";
};

/* =========================================================
   CREATE ORDER
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

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    if (!customerName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (!phone?.trim()) {
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

    if (!deliveryAddress?.trim()) {
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

    if (termsAgreed !== true) {
      return res.status(400).json({
        success: false,
        message: "Please agree to Terms and Conditions",
      });
    }

    /* =====================================================
       FIND / CREATE CUSTOMER
    ===================================================== */

    const cleanPhone = phone.trim();

    let customer = await Customer.findOne({
      phone: cleanPhone,
    });

    if (!customer) {
      customer = await Customer.create({
        name: customerName.trim(),
        email: email?.trim() || "",
        phone: cleanPhone,
        address: deliveryAddress.trim(),
      });
    } else {
      customer.name = customerName.trim();

      if (email?.trim()) {
        customer.email = email.trim();
      }

      customer.address = deliveryAddress.trim();

      await customer.save();
    }

    /* =====================================================
       PREPARE PRODUCTS
    ===================================================== */

    const orderProducts = [];

    const stockUpdates = [];

    /* =====================================================
       LOOP PRODUCTS
    ===================================================== */

    for (const item of products) {
      /* ===================================================
         PRODUCT ID
      =================================================== */

      const productId = item.productId || item.product || item._id || item.id;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Product ID is missing",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid product ID: ${productId}`,
        });
      }

      /* ===================================================
         FIND PRODUCT
      =================================================== */

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.name || "Unknown product"}`,
        });
      }

      /* ===================================================
         QUANTITY
      =================================================== */

      const quantity = Math.max(1, Number(item.quantity || 1));

      /* ===================================================
         SELECTED VARIANT
      =================================================== */

      const selectedVariant = item.variant || {
        color: item.color || "",
        ram: item.ram || "",
        storage: item.storage || "",
        variantId: item.variantId || null,
        sku: item.sku || "",
      };

      /* ===================================================
         FIND DATABASE VARIANT
      =================================================== */

      let matchedVariant = null;

      if (Array.isArray(product.variants) && product.variants.length > 0) {
        /* ================================================
           FIRST:
           FIND USING EXACT VARIANT ID
        ================================================ */

        const selectedVariantId = normalizeValue(selectedVariant.variantId);

        if (
          selectedVariantId &&
          mongoose.Types.ObjectId.isValid(selectedVariantId)
        ) {
          matchedVariant = product.variants.find(
            (variant) => String(variant._id) === selectedVariantId,
          );
        }

        /* ================================================
           SECOND:
           FIND USING COLOR + RAM + STORAGE
        ================================================ */

        if (!matchedVariant) {
          matchedVariant = findMatchingVariant(product, selectedVariant);
        }

        /* ================================================
           VARIANT REQUIRED
        ================================================ */

        if (!matchedVariant) {
          return res.status(400).json({
            success: false,
            message: `${product.name}: selected variant is not available`,
          });
        }
      }

      /* ===================================================
         VARIANT VALUES
      =================================================== */

      const color = matchedVariant
        ? getVariantColor(matchedVariant)
        : normalizeValue(selectedVariant.color || item.color);

      const ram = matchedVariant
        ? normalizeValue(matchedVariant.ram)
        : normalizeValue(selectedVariant.ram || item.ram);

      const storage = matchedVariant
        ? normalizeValue(matchedVariant.storage)
        : normalizeValue(selectedVariant.storage || item.storage);

      /* ===================================================
         EXACT STOCK CHECK
      =================================================== */

      const currentStock = matchedVariant
        ? Number(matchedVariant.stock || 0)
        : Number(product.stock || 0);

      /* ===================================================
         CHECK STOCK
      =================================================== */

      if (currentStock < quantity) {
        return res.status(400).json({
          success: false,

          message: `${product.name}${color ? ` (${color}` : ""}${
            ram ? ` / ${ram}` : ""
          }${storage ? ` / ${storage}` : ""}${
            color ? ")" : ""
          } has only ${currentStock} item(s) in stock`,
        });
      }

      /* ===================================================
         DATABASE PRICE
      =================================================== */

      let price = 0;

      if (matchedVariant) {
        price = Number(matchedVariant.price || 0);
      } else {
        price = Number(product.discountPrice || product.price || 0);
      }

      if (price <= 0) {
        return res.status(400).json({
          success: false,
          message: `${product.name} has an invalid price`,
        });
      }

      /* ===================================================
         IMAGE
      =================================================== */

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

      /* ===================================================
         EXACT VARIANT ID
      =================================================== */

      const variantId = matchedVariant ? getVariantId(matchedVariant) : null;

      /* ===================================================
         SKU
      =================================================== */

      const sku = matchedVariant
        ? normalizeValue(matchedVariant.sku)
        : normalizeValue(selectedVariant.sku);

      /* ===================================================
         PRODUCT SUBTOTAL
      =================================================== */

      const itemSubtotal = price * quantity;

      /* ===================================================
         PUSH ORDER PRODUCT
      =================================================== */

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

        size: item.size || "",

        image,

        subtotal: itemSubtotal,
      });

      /* ===================================================
         SAVE EXACT STOCK UPDATE
      =================================================== */

      stockUpdates.push({
        productId: String(product._id),

        variantId: matchedVariant ? String(matchedVariant._id) : null,

        quantity,
      });
    }

    /* =====================================================
       CALCULATE SUBTOTAL
    ===================================================== */

    const calculatedSubTotal = orderProducts.reduce((total, item) => {
      return total + Number(item.price) * Number(item.quantity);
    }, 0);

    /* =====================================================
       DELIVERY CHARGE
    ===================================================== */

    const safeDeliveryCharge = Math.max(0, Number(deliveryCharge || 0));

    /* =====================================================
       DISCOUNT
    ===================================================== */

    const safeDiscountAmount = Math.min(
      Math.max(Number(discountAmount || 0), 0),
      calculatedSubTotal,
    );

    /* =====================================================
       TOTAL
    ===================================================== */

    const calculatedTotalAmount = Math.max(
      0,
      calculatedSubTotal + safeDeliveryCharge - safeDiscountAmount,
    );

    /* =====================================================
       DEBUG STOCK DATA
    ===================================================== */

    console.log("=================================");

    console.log("STOCK UPDATES:");

    console.log(JSON.stringify(stockUpdates, null, 2));

    console.log("=================================");

    /* =====================================================
       REDUCE STOCK

       Variant থাকলে:
       - Exact variant stock কমবে
       - Main product stock কমবে

       Variant না থাকলে:
       - Main product stock কমবে
    ===================================================== */

    for (const stockItem of stockUpdates) {
      /* ===================================================
         VARIANT PRODUCT
      =================================================== */

      if (stockItem.variantId) {
        const productId = new mongoose.Types.ObjectId(
          String(stockItem.productId),
        );

        const variantId = new mongoose.Types.ObjectId(
          String(stockItem.variantId),
        );

        const quantity = Number(stockItem.quantity);

        console.log("=================================");

        console.log("VARIANT STOCK UPDATE");

        console.log("PRODUCT ID:", productId.toString());

        console.log("VARIANT ID:", variantId.toString());

        console.log("QUANTITY:", quantity);

        /* =================================================
           EXACT VARIANT STOCK UPDATE

           এখানে arrayFilters ব্যবহার করা হচ্ছে।
        ================================================= */

        const result = await Product.updateOne(
          /* ---------------------------------------------
               FILTER
            --------------------------------------------- */

          {
            _id: productId,

            // Product main stock check
            stock: {
              $gte: quantity,
            },

            // Exact variant check
            variants: {
              $elemMatch: {
                _id: variantId,

                stock: {
                  $gte: quantity,
                },
              },
            },
          },

          /* ---------------------------------------------
               UPDATE
            --------------------------------------------- */

          {
            $inc: {
              // Exact selected variant stock
              "variants.$[selectedVariant].stock": -quantity,

              // Main product stock
              stock: -quantity,
            },
          },

          /* ---------------------------------------------
               ARRAY FILTER
            --------------------------------------------- */

          {
            arrayFilters: [
              {
                "selectedVariant._id": variantId,

                "selectedVariant.stock": {
                  $gte: quantity,
                },
              },
            ],
          },
        );

        console.log("VARIANT STOCK UPDATE RESULT:", {
          matchedCount: result.matchedCount,

          modifiedCount: result.modifiedCount,
        });

        /* =================================================
           STOCK UPDATE FAILED
        ================================================= */

        if (result.matchedCount === 0) {
          return res.status(400).json({
            success: false,

            message: `${productId}: selected variant stock is no longer available`,
          });
        }

        if (result.modifiedCount === 0) {
          return res.status(400).json({
            success: false,

            message: "Failed to reduce selected variant stock",
          });
        }

        console.log(
          "Variant stock successfully reduced:",
          variantId.toString(),
        );
      } else {

      /* ===================================================
         NORMAL PRODUCT
      =================================================== */
        const productId = new mongoose.Types.ObjectId(
          String(stockItem.productId),
        );

        const quantity = Number(stockItem.quantity);

        console.log("=================================");

        console.log("NORMAL PRODUCT STOCK UPDATE");

        console.log("PRODUCT ID:", productId.toString());

        console.log("QUANTITY:", quantity);

        const result = await Product.updateOne(
          {
            _id: productId,

            stock: {
              $gte: quantity,
            },
          },

          {
            $inc: {
              stock: -quantity,
            },
          },
        );

        console.log("NORMAL STOCK UPDATE RESULT:", {
          matchedCount: result.matchedCount,

          modifiedCount: result.modifiedCount,
        });

        if (result.matchedCount === 0) {
          return res.status(400).json({
            success: false,

            message: "Product stock is no longer available",
          });
        }

        if (result.modifiedCount === 0) {
          return res.status(400).json({
            success: false,

            message: "Failed to reduce product stock",
          });
        }

        console.log(
          "Product stock successfully reduced:",
          productId.toString(),
        );
      }
    }

    /* =====================================================
       ORDER ID
    ===================================================== */

    const orderId = `ORD-${Date.now()}`;

    /* =====================================================
       CREATE ORDER
    ===================================================== */

    const order = await MainOrder.create({
      orderId,

      customer: customer._id,

      customerName: customerName.trim(),

      email: email?.trim() || "",

      phone: cleanPhone,

      selectArea,

      deliveryAddress: deliveryAddress.trim(),

      note: note?.trim() || "",

      products: orderProducts,

      subTotal: calculatedSubTotal,

      deliveryCharge: safeDeliveryCharge,

      discountAmount: safeDiscountAmount,

      couponCode: couponCode?.trim().toUpperCase() || "",

      totalAmount: calculatedTotalAmount,

      paymentMethod: paymentMethod || "cash_on_delivery",

      paymentStatus: "unpaid",

      deliveryMethod: deliveryMethod || "courier_service",

      status: "pending",

      termsAgreed: Boolean(termsAgreed),

      source: orderSource || "website",
    });

    /* =====================================================
       SUCCESS
    ===================================================== */

    return res.status(201).json({
      success: true,

      message: "Order placed successfully",

      data: {
        orderId: order.orderId,

        order,
      },
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to create order",

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* =========================================================
   GET ALL ORDERS
========================================================= */

export const getAllOrders = async (req, res) => {
  try {
    const orders = await MainOrder.find()
      .populate("customer", "name email phone address")
      .populate(
        "products.product",
        "name price discountPrice stock images colors variants",
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,

      count: orders.length,

      data: orders,
    });
  } catch (error) {
    console.error("GET ALL ORDERS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to get orders",
    });
  }
};

/* =========================================================
   GET SINGLE ORDER
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
   GET ORDER BY ORDER ID
========================================================= */

export const getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await MainOrder.findOne({
      orderId,
    })
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

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,

        message: "Invalid order status",
      });
    }

    const order = await MainOrder.findByIdAndUpdate(
      id,
      {
        status,
      },
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

    const allowedStatuses = ["unpaid", "partially_paid", "paid"];

    if (!allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,

        message: "Invalid payment status",
      });
    }

    const order = await MainOrder.findByIdAndUpdate(
      id,
      {
        paymentStatus,
      },
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







// ১. গেট অল অর্ডার (ফিল্টারিং, সার্চ এবং পেজিনেশন সহ)

