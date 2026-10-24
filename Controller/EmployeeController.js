
import mongoose from "mongoose";
import Order from "../Model/Order.js";
import Customer from "../Model/Customer.js";

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) => req.user?._id || req.user?.id || null;

const getEmployeeId = (req) => getUserId(req);

const isValidId = (id) => mongoose.isValidObjectId(id);

const normalizeText = (value, maxLength = 500) =>
  String(value ?? "").trim().slice(0, maxLength);

const populateOrder = async (order) => {
  await order.populate([
    { path: "customer", select: "name phone email" },
    { path: "assignedEmployee", select: "name email phone role" },
    { path: "assignedBy", select: "name email role" },
  ]);

  return order;
};

/* =========================================================
   ASSIGN ORDER TO EMPLOYEE
   POST /api/dashboard/assignOrder

   Body:
   {
     "orderId": "MongoDB _id OR custom orderId",
     "employeeId": "employee MongoDB _id",
     "note": "Optional note"
   }
========================================================= */

export const assignOrder = async (req, res) => {
  try {
    const { orderId, employeeId, note = "" } = req.body || {};

    if (!orderId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "orderId and employeeId are required",
      });
    }

    const actorId = getUserId(req);

    if (!isValidId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employeeId",
      });
    }

    // deliveryHistory.changedBy is required in the schema.
    if (!actorId || !isValidId(actorId)) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is missing or invalid",
      });
    }

    // Find an active employee.
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

    // Find using MongoDB _id first, then the custom orderId.
    const receivedOrderId = String(orderId).trim();

    let order = null;

    if (isValidId(receivedOrderId)) {
      order = await Order.findById(receivedOrderId);
    }

    if (!order) {
      order = await Order.findOne({
        orderId: receivedOrderId,
      });
    }

    if (!order) {
      console.error("Order not found during assignment:", {
        receivedOrderId,
        collection: Order.collection.name,
        database: Order.db.name,
      });

      return res.status(404).json({
        success: false,
        message: "Order not found",
        details: {
          searchedId: receivedOrderId,
          collection: Order.collection.name,
          database: Order.db.name,
        },
      });
    }

    // Prevent assigning completed or cancelled orders.
    if (
      ["delivered", "cancelled"].includes(order.status) ||
      ["delivered", "cancelled"].includes(order.deliveryStatus)
    ) {
      return res.status(409).json({
        success: false,
        message: "Completed or cancelled orders cannot be assigned",
      });
    }

    const previousEmployeeId = order.assignedEmployee
      ? String(order.assignedEmployee)
      : null;

    const newEmployeeId = String(employee._id);

    const isReassignment =
      Boolean(previousEmployeeId) &&
      previousEmployeeId !== newEmployeeId;

    const now = new Date();

    order.assignedEmployee = employee._id;
    order.assignedBy = actorId;
    order.assignedAt = now;
    order.deliveryStatus = "assigned";
    order.deliveryNote = "";

    // Record every assignment in the audit history.
    order.deliveryHistory.push({
      action: isReassignment ? "reassigned" : "assigned",
      employee: employee._id,
      changedBy: actorId,
      note: normalizeText(note),
      changedAt: now,
    });

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
    });
  }
};

/* =========================================================
   REASSIGN ORDER
   PATCH /api/dashboard/reassignOrder/:orderId

   Body:
   {
     "employeeId": "...",
     "note": "Optional note"
   }
========================================================= */

export const reassignOrder = async (req, res) => {
  req.body = {
    ...(req.body || {}),
    orderId: req.params.orderId,
  };

  return assignOrder(req, res);
};

/* =========================================================
   GET EMPLOYEE'S ASSIGNED ORDERS
========================================================= */

export const getMyOrders = async (req, res) => {
  try {
    if (req.user?.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Employee access required",
      });
    }

    const employeeId = getEmployeeId(req);

    if (!employeeId || !isValidId(employeeId)) {
      return res.status(401).json({
        success: false,
        message: "Valid employee ID is missing",
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const filter = {
      assignedEmployee: employeeId,
    };

    const allowedStatuses = [
      "assigned",
      "received",
      "delivered",
      "rejected",
      "cancelled",
    ];

    if (status && allowedStatuses.includes(status)) {
      filter.deliveryStatus = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customer", "name phone email")
        .populate("assignedEmployee", "name phone email")
        .populate("assignedBy", "name email")
        .sort({ assignedAt: -1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      Order.countDocuments(filter),
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
    });
  }
};

/* =========================================================
   EMPLOYEE UPDATES DELIVERY STATUS
   PATCH /api/dashboard/myOrders/:orderId/status

   Body:
   {
     "status": "received" | "delivered" | "rejected" | "cancelled",
     "note": "Optional note"
   }
========================================================= */

export const updateEmployeeOrderStatus = async (req, res) => {
  try {
    if (req.user?.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Employee access required",
      });
    }

    const employeeId = getEmployeeId(req);
    const { orderId } = req.params;
    const { status, note = "" } = req.body || {};

    if (!employeeId || !isValidId(employeeId)) {
      return res.status(401).json({
        success: false,
        message: "Valid employee ID is missing",
      });
    }

    if (!isValidId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID. Use the MongoDB document _id.",
      });
    }

    const transitions = {
      received: ["assigned"],
      delivered: ["received"],
      rejected: ["assigned"],
      cancelled: ["assigned", "received"],
    };

    if (!transitions[status]) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery status",
      });
    }

    // Only the employee assigned to this order may update it.
    const order = await Order.findOne({
      _id: orderId,
      assignedEmployee: employeeId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Assigned order not found",
      });
    }

    const currentStatus = order.deliveryStatus || "assigned";

    if (!transitions[status].includes(currentStatus)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change status from ${currentStatus} to ${status}`,
      });
    }

    const actorId = employeeId;
    const now = new Date();
    const cleanNote = normalizeText(note);

    const updateFields = {
      deliveryStatus: status,
      deliveryNote: cleanNote,
    };

    // Keep the existing order status consistent with delivery status.
    if (status === "delivered" || status === "cancelled") {
      updateFields.status = status;
    }

    // Conditional update prevents overwriting a simultaneous status change.
    const statusCondition =
      order.deliveryStatus == null
        ? {
            $or: [
              { deliveryStatus: { $exists: false } },
              { deliveryStatus: null },
              { deliveryStatus: "" },
            ],
          }
        : { deliveryStatus: order.deliveryStatus };

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        assignedEmployee: employeeId,
        ...statusCondition,
      },
      {
        $set: updateFields,
        $push: {
          deliveryHistory: {
            action: status,
            employee: employeeId,
            changedBy: actorId,
            note: cleanNote,
            changedAt: now,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: "Order status changed concurrently. Refresh and retry.",
      });
    }

    await populateOrder(updatedOrder);

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: updatedOrder,
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
    });
  }
};

/* =========================================================
   EMPLOYEE REPORT STATISTICS
========================================================= */

const getEmployeeStats = async (employeeId) => {
  const employeeObjectId = new mongoose.Types.ObjectId(employeeId);

  const [current, historical] = await Promise.all([
    // Current order totals.
    Order.aggregate([
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

    // Unique orders ever assigned/reassigned to this employee.
    Order.aggregate([
      { $unwind: "$deliveryHistory" },
      {
        $match: {
          "deliveryHistory.employee": employeeObjectId,
          "deliveryHistory.action": {
            $in: ["assigned", "reassigned"],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
        },
      },
      {
        $count: "total",
      },
    ]),
  ]);

  const counts = Object.fromEntries(
    current.map((item) => [item._id, item.count]),
  );

  const assigned = counts.assigned || 0;
  const received = counts.received || 0;

  return {
    totalAssigned: historical[0]?.total || 0,
    currentlyAssigned: assigned + received,
    received,
    delivered: counts.delivered || 0,
    rejected: counts.rejected || 0,
    cancelled: counts.cancelled || 0,
    pending: assigned + received,
  };
};

/* =========================================================
   ALL EMPLOYEE REPORTS
========================================================= */

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
    });
  }
};

/* =========================================================
   SINGLE EMPLOYEE REPORT
========================================================= */

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
    });
  }
};

/* =========================================================
   GET ACTIVE EMPLOYEES FOR ASSIGNMENT
========================================================= */

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
    });
  }
};
