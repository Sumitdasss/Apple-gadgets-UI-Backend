import mongoose from "mongoose";
import Order from "../Model/Order.js";
import Customer from "../Model/Customer.js";

export const assignOrder = async (req, res) => {
  try {
    const { orderId, employeeId, note = "" } = req.body;

    if (!orderId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "orderId and employeeId are required",
      });
    }

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employeeId",
      });
    }

    const employee = await Customer.findById(employeeId).select(
      "_id name email phone role isActive",
    );

    if (
      !employee ||
      employee.role !== "employee" ||
      employee.isActive === false
    ) {
      return res.status(400).json({
        success: false,
        message: "Active employee not found",
      });
    }

    // ✅ _id অথবা custom orderId দুটো দিয়েই খুঁজবে
    let order = null;

    if (mongoose.isValidObjectId(orderId)) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "Completed or cancelled orders cannot be assigned",
      });
    }

    const previousEmployee = order.assignedEmployee;
    const isReassignment =
      previousEmployee && previousEmployee.toString() !== employeeId;

    order.assignedEmployee = employee._id;
    order.assignedBy = req.user?._id || null;
    order.assignedAt = new Date();
    order.deliveryStatus = "assigned";
    order.deliveryNote = "";

    order.deliveryHistory.push({
      action: isReassignment ? "reassigned" : "assigned",
      employee: employee._id,
      changedBy: req.user?._id || null,
      note: String(note).slice(0, 500),
      changedAt: new Date(),
    });

    await order.save();

    await order.populate([
      { path: "assignedEmployee", select: "name email phone role" },
      { path: "assignedBy", select: "name email role" },
    ]);

    return res.status(200).json({
      success: true,
      message: isReassignment
        ? "Order reassigned successfully"
        : "Order assigned successfully",
      data: order,
    });
  } catch (error) {
    console.error("assignOrder:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign order",
    });
  }
};
export const reassignOrder = async (req, res) => {
  req.body.orderId = req.params.orderId;
  return assignOrder(req, res);
};

const getEmployeeId = (req) => req.user?._id || req.user?.id;

export const getMyOrders = async (req, res) => {
  try {
    if (req.user?.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Employee access required",
      });
    }

    const { page = 1, limit = 20, status } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const filter = {
      assignedEmployee: getEmployeeId(req),
    };

    if (
      status &&
      ["assigned", "received", "delivered", "rejected", "cancelled"].includes(
        status,
      )
    ) {
      filter.deliveryStatus = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customer", "name phone email")
        .populate("assignedEmployee", "name phone")
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
    console.error("getMyOrders:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load assigned orders",
    });
  }
};

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
    const { status, note = "" } = req.body;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
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

    const update = {
      deliveryStatus: status,
      deliveryNote: String(note).slice(0, 500),
    };

    if (status === "delivered") {
      update.status = "delivered";
    }

    if (status === "cancelled") {
      update.status = "cancelled";
    }

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        assignedEmployee: employeeId,
        deliveryStatus: currentStatus,
      },
      {
        $set: update,
        $push: {
          deliveryHistory: {
            action: status,
            employee: employeeId,
            changedBy: employeeId,
            note: String(note).slice(0, 500),
            changedAt: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("customer", "name phone email")
      .populate("assignedEmployee", "name phone");

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: "Order changed concurrently. Refresh and retry.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("updateEmployeeOrderStatus:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

const getEmployeeStats = async (employeeId) => {
  const [current, historical] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          assignedEmployee: new mongoose.Types.ObjectId(employeeId),
        },
      },
      {
        $group: {
          _id: "$deliveryStatus",
          count: { $sum: 1 },
        },
      },
    ]),

    Order.aggregate([
      { $unwind: "$deliveryHistory" },
      {
        $match: {
          "deliveryHistory.employee": new mongoose.Types.ObjectId(employeeId),
          "deliveryHistory.action": {
            $in: ["assigned", "reassigned"],
          },
        },
      },
      {
        $count: "total",
      },
    ]),
  ]);

  const counts = Object.fromEntries(
    current.map((item) => [item._id || "unassigned", item.count]),
  );

  return {
    totalAssigned: historical[0]?.total || 0,
    currentlyAssigned: (counts.assigned || 0) + (counts.received || 0),
    received: counts.received || 0,
    delivered: counts.delivered || 0,
    rejected: counts.rejected || 0,
    cancelled: counts.cancelled || 0,
    pending: (counts.assigned || 0) + (counts.received || 0),
  };
};

export const getEmployeeReportSummary = async (req, res) => {
  try {
    const employees = await Customer.find({
      role: "employee",
    })
      .select("name email phone role isActive")
      .lean();

    const data = await Promise.all(
      employees.map(async (employee) => ({
        ...employee,
        stats: await getEmployeeStats(employee._id),
      })),
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getEmployeeReportSummary:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load employee report",
    });
  }
};

export const getEmployeeReportById = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const employee = await Customer.findOne({
      _id: employeeId,
      role: "employee",
    })
      .select("name email phone role isActive")
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
    console.error("getEmployeeReportById:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load employee report",
    });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const employees = await Customer.find({
      role: "employee",
      isActive: true,
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
    console.error("Get employees error:", error);

    return res.status(500).json({
      success: false,
      message: "Employee load failed",
    });
  }
};