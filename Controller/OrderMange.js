
import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";


export const getOrders = async (req, res) => {
 console.log("✅ GET ORDERS CONTROLLER HIT:", req.originalUrl);
  try {
    const page = Math.max(
      1,
      parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const {
      status,
      search,
      courierProvider,
      source,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (courierProvider?.trim()) {
      query["courierDetails.provider"] = {
        $regex: courierProvider.trim(),
        $options: "i",
      };
    }

    if (source?.trim()) {
      query.source = source.trim();
    }

    if (search?.trim()) {
      const regex = {
        $regex: search.trim(),
        $options: "i",
      };

      query.$or = [
        { orderId: regex },
        { customerName: regex },
        { phone: regex },
        { deliveryAddress: regex },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date",
          });
        }

        query.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date",
          });
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          end.setHours(23, 59, 59, 999);
        }

        query.createdAt.$lte = end;
      }
    }

    const total = await MainOrder.countDocuments(query);

    // Step 1: প্রথমে populate ছাড়া orders বের করো।
    const rawOrders = await MainOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log(
      "GET ORDERS: raw order count =",
      rawOrders.length
    );

    // Step 2: Customer ও Product reference populate করো।
    let orders = rawOrders;

    try {
      orders = await MainOrder.populate(rawOrders, [
        {
          path: "customer",
          select: "name email phone address",
        },
        {
          path: "products.product",
          select: "name images price discountPrice",
        },
      ]);
    } catch (populateError) {
      console.error(
        "GET ORDERS POPULATE ERROR:",
        populateError
      );

      // Populate ব্যর্থ হলেও order-এর snapshot তথ্য দেখানো যাবে।
      orders = rawOrders;
    }

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("GET ORDERS CONTROLLER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "অর্ডার লোড করতে সমস্যা হয়েছে!",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
// PATCH: Bulk update
export const bulkUpdateOrders = async (req, res) => {
  try {
    const { orderIds, status, courierProvider, source } = req.body;

    if (
      !Array.isArray(orderIds) ||
      orderIds.length === 0 ||
      !orderIds.every((id) => mongoose.isValidObjectId(id))
    ) {
      return res.status(400).json({
        success: false,
        message: "সঠিক Order ID নির্বাচন করো।",
      });
    }

    const updateData = {};

    if (status) {
      const allowedStatuses = MainOrder.schema.path("status").enumValues;

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      updateData.status = status;
    }

    if (source?.trim()) {
      updateData.source = source.trim();
    }

    if (courierProvider?.trim()) {
      updateData["courierDetails.provider"] = courierProvider.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "কোনো valid update দেওয়া হয়নি।",
      });
    }

    const result = await MainOrder.updateMany(
      { _id: { $in: orderIds } },
      { $set: updateData },
      { runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount}টি অর্ডার আপডেট হয়েছে।`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("bulkUpdateOrders error:", error);

    return res.status(500).json({
      success: false,
      message: "বাল্ক আপডেটে সমস্যা হয়েছে!",
      error: error.message,
    });
  }
};

// PUT: Single order status update
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const allowedStatuses = MainOrder.schema.path("status").enumValues;

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const updatedOrder = await MainOrder.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "অর্ডার পাওয়া যায়নি!",
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedOrder,
      message: "অর্ডারের স্ট্যাটাস আপডেট হয়েছে!",
    });
  } catch (error) {
    console.error("updateOrder error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE: Single order
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const deletedOrder = await MainOrder.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "অর্ডার পাওয়া যায়নি!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "অর্ডার ডিলিট হয়েছে!",
    });
  } catch (error) {
    console.error("deleteOrder error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};