
import mongoose from "mongoose";
import MainOrder from "../Model/MainOrder.js";
import Customer from "../Model/Customer.js";

/* =====================================================
   HELPERS
===================================================== */

const getUserId = (req) =>
  req.user?._id || req.user?.id || null;

const isValidId = (id) =>
  Boolean(id) && mongoose.isValidObjectId(id);

const getValidActorId = (req) => {
  const id = getUserId(req);
  return isValidId(id) ? id : null;
};

const normalizeText = (value, maxLength = 500) =>
  String(value ?? "").trim().slice(0, maxLength);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const populateOrder = async (order) => {
  await order.populate([
    { path: "customer", select: "name phone email" },
    {
      path: "assignedEmployee",
      select: "name email phone role",
    },
    { path: "assignedBy", select: "name email role" },
  ]);

  return order;
};

const findOrderByIdOrOrderNumber = async (value) => {
  const receivedId = normalizeText(value, 150);

  if (!receivedId) return null;

  // First try MongoDB _id
  if (isValidId(receivedId)) {
    const order = await MainOrder.findById(receivedId);
    if (order) return order;
  }

  // Then try the custom order number
  let order = await MainOrder.findOne({
    orderId: receivedId,
  });

  if (order) return order;

  // Finally try case-insensitive custom order number
  order = await MainOrder.findOne({
    orderId: {
      $regex: `^${escapeRegex(receivedId)}$`,
      $options: "i",
    },
  });

  return order;
};

const addDeliveryHistory = (
  order,
  status,
  note,
  actorId,
) => {
  if (!Array.isArray(order.deliveryHistory)) {
    order.deliveryHistory = [];
  }

  order.deliveryHistory.push({
    status,
    note: normalizeText(note),
    updatedBy: actorId,
    updatedAt: new Date(),
  });
};

/* =====================================================
   ASSIGN ORDER
===================================================== */

export const assignOrder = async (req, res) => {
  try {
    const { orderId, employeeId } = req.body;

    const assignedById = req.user?._id || req.user?.id;

    if (!orderId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "Order ID and employee ID are required",
      });
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const order = await MainOrder.findByIdAndUpdate(
      orderId,
      {
        $set: {
          assignedEmployee: employeeId,
          assignedBy: assignedById || null,
          assignedAt: new Date(),
          deliveryStatus: "assigned",
        },
        $push: {
          deliveryHistory: {
            status: "assigned",
            note: "Order assigned to employee",
            updatedBy: assignedById || null,
            updatedAt: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("assignedEmployee", "name fullName username email")
      .populate("assignedBy", "name fullName username email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order assigned successfully",
      data: order,
    });
  } catch (error) {
    console.error("assignOrder error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign order",
      error: error.message,
    });
  }
};

/* =====================================================
   REASSIGN ORDER
===================================================== */

export const reassignOrder = async (req, res) => {
  req.body = {
    ...(req.body || {}),
    orderId: req.params.orderId,
  };

  return assignOrder(req, res);
};

/* =====================================================
   EMPLOYEE ORDERS
===================================================== */

export const getMyOrders = async (req, res) => {
  try {
    const employeeId = getUserId(req);

    if (!isValidId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is missing",
      });
    }

    const pageNumber = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1,
    );

    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const filter = {
      assignedEmployee: employeeId,
    };

    const allowedStatuses = [
      "unassigned",
      "assigned",
      "picked_up",
      "in_transit",
      "delivered",
      "failed",
      "returned",
      "cancelled",
    ];

    if (
      req.query.status &&
      allowedStatuses.includes(req.query.status)
    ) {
      filter.deliveryStatus = req.query.status;
    }

    const [orders, total] = await Promise.all([
      MainOrder.find(filter)
        .populate("customer", "name phone email")
        .populate("assignedEmployee", "name phone email")
        .populate("assignedBy", "name email")
        .sort({ assignedAt: -1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      MainOrder.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("getMyOrders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load assigned orders",
      error: error.message,
    });
  }
};

/* =====================================================
   UPDATE EMPLOYEE DELIVERY STATUS
===================================================== */

export const updateEmployeeOrderStatus = async (req, res) => {
  try {
    const employeeId = getUserId(req);
    const { orderId } = req.params;
    const { status, note = "" } = req.body || {};

    if (!isValidId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is missing",
      });
    }

    if (!isValidId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Must match the deliveryStatus enum in MainOrder schema.
    const transitions = {
      picked_up: ["assigned"],
      in_transit: ["picked_up"],
      delivered: ["in_transit", "picked_up"],
      failed: ["assigned", "picked_up", "in_transit"],
      returned: ["failed", "in_transit"],
      cancelled: ["assigned"],
    };

    if (!transitions[status]) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery status",
      });
    }

    const order = await MainOrder.findOne({
      _id: orderId,
      assignedEmployee: employeeId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Assigned order not found",
      });
    }

    const currentStatus = order.deliveryStatus || "unassigned";

    if (!transitions[status].includes(currentStatus)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change status from ${currentStatus} to ${status}`,
      });
    }

    const cleanNote = normalizeText(note);
    const actorId = getValidActorId(req);

    order.deliveryStatus = status;
    order.deliveryNote = cleanNote;

    if (status === "delivered") {
      order.status = "delivered";
    } else if (status === "cancelled") {
      order.status = "cancelled";
    } else if (status === "returned") {
      order.status = "returned";
    }

    addDeliveryHistory(order, status, cleanNote, actorId);

    await order.save();
    await populateOrder(order);

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: order,
    });
  } catch (error) {
    console.error("updateEmployeeOrderStatus error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Order validation failed",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

/* =====================================================
   EMPLOYEE STATISTICS
===================================================== */

/* =====================================================
   EMPLOYEE STATISTICS - FIXED
===================================================== */

const getEmployeeStats = async (employeeId) => {
  const employeeObjectId = new mongoose.Types.ObjectId(
    String(employeeId),
  );

  // Employee-কে বর্তমানে যেসব order assign করা আছে,
  // সেগুলোর সব delivery status-এর হিসাব নেওয়া হচ্ছে।
  const result = await MainOrder.aggregate([
    {
      $match: {
        assignedEmployee: employeeObjectId,
      },
    },
    {
      $group: {
        _id: {
          $ifNull: ["$deliveryStatus", "unassigned"],
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const counts = Object.fromEntries(
    result.map((item) => [item._id, item.count]),
  );

  const assigned = counts.assigned || 0;
  const pickedUp = counts.picked_up || 0;
  const inTransit = counts.in_transit || 0;
  const delivered = counts.delivered || 0;
  const failed = counts.failed || 0;
  const returned = counts.returned || 0;
  const cancelled = counts.cancelled || 0;

  // Employee-কে বর্তমানে assign করা order-গুলোর
  // মোট সংখ্যা, delivery status নির্বিশেষে।
  const totalAssigned =
    assigned +
    pickedUp +
    inTransit +
    delivered +
    failed +
    returned +
    cancelled;

 
  const currentlyAssigned =
    assigned +
    pickedUp +
    inTransit;

  return {
    totalAssigned,
    currentlyAssigned,
    assigned,
    pickedUp,
    inTransit,
    delivered,
    failed,
    returned,
    cancelled,
    pending: currentlyAssigned,
  };
};

/* =====================================================
   ALL EMPLOYEE REPORTS
===================================================== */

export const getEmployeeReportSummary = async (req, res) => {
  try {
    const employees = await Customer.find({
      role: "employee",
    })
      .select("_id name email phone role isActive")
      .sort({ createdAt: -1 })
      .lean();

    const data = await Promise.all(
      employees.map(async (employee) => ({
        ...employee,
        stats: await getEmployeeStats(employee._id),
      })),
    );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getEmployeeReportSummary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load employee report",
      error: error.message,
    });
  }
};

/* =====================================================
   SINGLE EMPLOYEE REPORT
===================================================== */

export const getEmployeeReportById = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!isValidId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const employee = await Customer.findOne({
      _id: employeeId,
      role: "employee",
    })
      .select("_id name email phone role isActive")
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const stats = await getEmployeeStats(employeeId);

    return res.status(200).json({
      success: true,
      data: {
        ...employee,
        stats,
      },
    });
  } catch (error) {
    console.error("getEmployeeReportById error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load employee report",
      error: error.message,
    });
  }
};

/* =====================================================
   ACTIVE EMPLOYEES
===================================================== */

export const getEmployees = async (req, res) => {
  try {
    const employees = await Customer.find({
      role: "employee",
      isActive: { $ne: false },
    })
      .select("_id name email phone role isActive")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    console.error("getEmployees error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load employees",
      error: error.message,
    });
  }
};
