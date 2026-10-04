import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";
import Customer from "../Model/Customer.js";
import Product from "../Model/Product.js";

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
      subTotal,
      deliveryCharge,
      discountAmount,
      totalAmount,
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

      customer.address =
        deliveryAddress.trim();

      await customer.save();
    }

    /* =====================================================
       PREPARE PRODUCTS
    ===================================================== */

    const orderProducts = [];

    for (const item of products) {
      const productId =
        item.productId ||
        item.product ||
        item._id ||
        item.id;

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

      const product =
        await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            `Product not found: ${
              item.name || "Unknown product"
            }`,
        });
      }

      const quantity = Math.max(
        1,
        Number(item.quantity || 1)
      );

      /* ===================================================
         STOCK CHECK
      =================================================== */

      const currentStock =
        Number(product.stock || 0);

      if (currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} has only ${currentStock} item(s) in stock`,
        });
      }

      /* ===================================================
         DATABASE PRICE
      =================================================== */

      const price = Number(
        product.discountPrice ||
          product.price ||
          0
      );

      /* ===================================================
         ORDER PRODUCT
      =================================================== */

      orderProducts.push({
        product: product._id,

        name: product.name,

        price,

        quantity,

        color:
          item.color || "",

        size:
          item.size || "",
      });
    }

    /* =====================================================
       CALCULATE SUBTOTAL
    ===================================================== */

    const calculatedSubTotal =
      orderProducts.reduce(
        (total, item) => {
          return (
            total +
            Number(item.price) *
              Number(item.quantity)
          );
        },
        0
      );

    /* =====================================================
       DELIVERY CHARGE
    ===================================================== */

    const safeDeliveryCharge = Math.max(
      0,
      Number(deliveryCharge || 0)
    );

    /* =====================================================
       DISCOUNT
    ===================================================== */

    const safeDiscountAmount = Math.min(
      Math.max(
        Number(discountAmount || 0),
        0
      ),
      calculatedSubTotal
    );

    /* =====================================================
       TOTAL
    ===================================================== */

    const calculatedTotalAmount =
      Math.max(
        0,
        calculatedSubTotal +
          safeDeliveryCharge -
          safeDiscountAmount
      );

    /* =====================================================
       ORDER ID
    ===================================================== */

    const orderId =
      `ORD-${Date.now()}`;

    /* =====================================================
       CREATE ORDER
    ===================================================== */

    const order =
      await MainOrder.create({
        orderId,

        customer:
          customer._id,

        customerName:
          customerName.trim(),

        email:
          email?.trim() || "",

        phone:
          cleanPhone,

        selectArea,

        deliveryAddress:
          deliveryAddress.trim(),

        note:
          note?.trim() || "",

        products:
          orderProducts,

        subTotal:
          calculatedSubTotal,

        deliveryCharge:
          safeDeliveryCharge,

        discountAmount:
          safeDiscountAmount,

        couponCode:
          couponCode
            ?.trim()
            .toUpperCase() || "",

        totalAmount:
          calculatedTotalAmount,

        paymentMethod:
          paymentMethod ||
          "cash_on_delivery",

        paymentStatus:
          "unpaid",

        deliveryMethod:
          deliveryMethod ||
          "courier_service",

        status:
          "pending",

        termsAgreed:
          Boolean(termsAgreed),

        source:
          orderSource ||
          "website",
      });

    /* =====================================================
       REDUCE PRODUCT STOCK
    ===================================================== */

    for (const item of orderProducts) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: {
            stock: -Number(
              item.quantity
            ),
          },
        }
      );
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    return res.status(201).json({
      success: true,

      message:
        "Order placed successfully",

      data: {
        orderId:
          order.orderId,

        order,
      },
    });

  } catch (error) {
    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create order",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};


/* =========================================================
   GET ALL ORDERS
========================================================= */

export const getAllOrders = async (
  req,
  res
) => {
  try {
    const orders =
      await MainOrder.find()
        .populate(
          "customer",
          "name email phone address"
        )
        .populate(
          "products.product",
          "name price discountPrice stock"
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
    console.error(
      "GET ALL ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get orders",
    });
  }
};


/* =========================================================
   GET SINGLE ORDER
========================================================= */

export const getOrderById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order =
      await MainOrder.findById(id)
        .populate(
          "customer",
          "name email phone address"
        )
        .populate(
          "products.product",
          "name price discountPrice stock images"
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
    console.error(
      "GET ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get order",
    });
  }
};


/* =========================================================
   GET ORDER BY ORDER ID
========================================================= */

export const getOrderByOrderId = async (
  req,
  res
) => {
  try {
    const { orderId } =
      req.params;

    const order =
      await MainOrder.findOne({
        orderId,
      })
        .populate(
          "customer",
          "name email phone address"
        )
        .populate(
          "products.product",
          "name price discountPrice images"
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
    console.error(
      "GET ORDER BY ORDER ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get order",
    });
  }
};


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

export const updateOrderStatus = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const {
      status,
    } = req.body;

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

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order status",
      });
    }

    const order =
      await MainOrder.findByIdAndUpdate(
        id,
        {
          status,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Order status updated successfully",
      data: order,
    });

  } catch (error) {
    console.error(
      "UPDATE ORDER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update order status",
    });
  }
};


/* =========================================================
   UPDATE PAYMENT STATUS
========================================================= */

export const updatePaymentStatus = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const {
      paymentStatus,
    } = req.body;

    const allowedStatuses = [
      "unpaid",
      "partially_paid",
      "paid",
    ];

    if (
      !allowedStatuses.includes(
        paymentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment status",
      });
    }

    const order =
      await MainOrder.findByIdAndUpdate(
        id,
        {
          paymentStatus,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Payment status updated successfully",
      data: order,
    });

  } catch (error) {
    console.error(
      "UPDATE PAYMENT STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update payment status",
    });
  }
};