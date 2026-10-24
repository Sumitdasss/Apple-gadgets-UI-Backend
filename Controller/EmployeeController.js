
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
    const { orderId, employeeId, note = "" } = req.body || {};

    if (!orderId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "orderId and employeeId are required",
      });
    }

    if (!isValidId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employeeId",
      });
    }

    const employee = await Customer.findOne({
      _id: employeeId,
      role: "employee",
      isActive: { $ne: false },
    }).select("_id name email phone role isActive");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Active employee not found",
      });
    }

    const receivedOrderId = normalizeText(orderId, 150);
    const order = await findOrderByIdOrOrderNumber(receivedOrderId);

    if (!order) {
      console.error("Order not found:", {
        receivedOrderId,
        database: MainOrder.db.name,
        collection: MainOrder.collection.name,
      });

      return res.status(404).json({
        success: false,
        message: `Order not found with ID: ${receivedOrderId}`,
      });
    }

    if (
      ["delivered", "cancelled"].includes(order.status) ||
      ["delivered", "cancelled", "returned"].includes(
        order.deliveryStatus,
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "Completed or cancelled orders cannot be assigned",
      });
    }

    const actorId = getValidActorId(req);
    const previousEmployeeId = order.assignedEmployee
      ? String(order.assignedEmployee._id || order.assignedEmployee)
      : null;

    const isReassignment =
      Boolean(previousEmployeeId) &&
      previousEmployeeId !== String(employee._id);

    const now = new Date();

    order.assignedEmployee = employee._id;
    order.assignedBy = actorId;
    order.assignedAt = now;
    order.deliveryStatus = "assigned";
    order.deliveryNote = normalizeText(note);

    // Match the deliveryHistory schema:
    // status, note, updatedBy, updatedAt
    addDeliveryHistory(
      order,
      "assigned",
      isReassignment
        ? `Reassigned to ${employee.name}. ${normalizeText(note)}`
        : normalizeText(note),
      actorId,
    );

    await order.save();
    await populateOrder(order);

    return res.status(200).json({
      success: true,
      message: isReassignment
        ? "Order reassigned successfully"
        : "Order assigned successfully",
      data: order,
    });
  } catch (error) {
    console.error("assignOrder error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Order validation failed",
        error: error.message,
      });
    }

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

const getEmployeeStats = async (employeeId) => {
  const employeeObjectId = new mongoose.Types.ObjectId(
    String(employeeId),
  );

  const [current, assignmentHistory] = await Promise.all([
    MainOrder.aggregate([
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
          count: { $sum: 1 },
        },
      },
    ]),

    MainOrder.aggregate([
      { $unwind: "$deliveryHistory" },
      {
        $match: {
          "deliveryHistory.status": "assigned",
          "deliveryHistory.updatedBy": employeeObjectId,
        },
      },
      { $group: { _id: "$_id" } },
      { $count: "total" },
    ]),
  ]);

  const counts = Object.fromEntries(
    current.map((item) => [item._id, item.count]),
  );

  const assigned = counts.assigned || 0;
  const pickedUp = counts.picked_up || 0;
  const inTransit = counts.in_transit || 0;

  return {
    totalAssigned: assignmentHistory[0]?.total || 0,
    currentlyAssigned: assigned + pickedUp + inTransit,
    assigned,
    pickedUp,
    inTransit,
    delivered: counts.delivered || 0,
    failed: counts.failed || 0,
    returned: counts.returned || 0,
    cancelled: counts.cancelled || 0,
    pending: assigned + pickedUp + inTransit,
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
