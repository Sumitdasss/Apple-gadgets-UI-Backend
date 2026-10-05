import MainOrder from "../Model/MainOrder.js";
import Product from "../Model/Product.js";
import Customer from "../Model/Customer.js";

// =========================================================
// HELPERS
// =========================================================

const calcGrowth = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? "+100.0%" : "+0.0%";
  }

  const diff = ((current - previous) / previous) * 100;

  const sign = diff >= 0 ? "+" : "";

  return `${sign}${diff.toFixed(1)}%`;
};

// =========================================================
// GET DASHBOARD SUMMARY
// GET /api/dashboard/summary?date=2026-10-05
// =========================================================

export const getDashboardSummary = async (req, res) => {
  try {
    const { date } = req.query;

    // =======================================================
    // SELECTED DATE
    // =======================================================

    const selectedDate = date
      ? new Date(`${date}T00:00:00`)
      : new Date();

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Start of selected day
    const currentStart = new Date(selectedDate);

    currentStart.setHours(0, 0, 0, 0);

    // End of selected day
    const currentEnd = new Date(selectedDate);

    currentEnd.setHours(23, 59, 59, 999);

    // =======================================================
    // PREVIOUS DAY
    // =======================================================

    const previousStart = new Date(currentStart);

    previousStart.setDate(
      previousStart.getDate() - 1
    );

    previousStart.setHours(0, 0, 0, 0);

    const previousEnd = new Date(currentStart);

    previousEnd.setDate(
      previousEnd.getDate() - 1
    );

    previousEnd.setHours(23, 59, 59, 999);

    // =======================================================
    // CURRENT DAY ORDERS
    // =======================================================

    const currentOrders = await MainOrder.find({
      createdAt: {
        $gte: currentStart,
        $lte: currentEnd,
      },
    }).lean();

    // =======================================================
    // PREVIOUS DAY ORDERS
    // =======================================================

    const previousOrders = await MainOrder.find({
      createdAt: {
        $gte: previousStart,
        $lte: previousEnd,
      },
    }).lean();

    // =======================================================
    // TOTAL ORDERS
    // =======================================================

    const totalOrdersCount =
      await MainOrder.countDocuments();

    const currentPeriodOrdersCount =
      currentOrders.length;

    const previousPeriodOrdersCount =
      previousOrders.length;

    // =======================================================
    // TOTAL SALES
    // =======================================================

    const totalSalesAggregate =
      await MainOrder.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: ["$totalAmount", 0],
              },
            },
          },
        },
      ]);

    const totalSalesValue =
      totalSalesAggregate[0]?.total || 0;

    // Current day sales
    const currentSales =
      currentOrders.reduce(
        (acc, order) =>
          acc + Number(order.totalAmount || 0),
        0
      );

    // Previous day sales
    const previousSales =
      previousOrders.reduce(
        (acc, order) =>
          acc + Number(order.totalAmount || 0),
        0
      );

    // =======================================================
    // PRODUCTS
    // =======================================================

    const totalItemsCount =
      await Product.countDocuments();

    // =======================================================
    // CUSTOMERS
    // =======================================================

    const totalCustomersCount =
      await Customer.countDocuments();

    // =======================================================
    // SUMMARY CARDS
    // =======================================================

    const summary = [
      {
        key: "orders",

        value: totalOrdersCount,

        growth: calcGrowth(
          currentPeriodOrdersCount,
          previousPeriodOrdersCount
        ),
      },

      {
        key: "sales",

        value: totalSalesValue,

        growth: calcGrowth(
          currentSales,
          previousSales
        ),
      },

      {
        key: "items",

        value: totalItemsCount,

        growth: "+0.0%",
      },

      {
        key: "customers",

        value: totalCustomersCount,

        growth: "+0.0%",
      },
    ];

    // =======================================================
    // ORDER STATUS
    // =======================================================

    const statusMap = {};

    currentOrders.forEach((order) => {
      let status =
        order.status ||
        order.orderStatus ||
        "Pending";

      const value = String(status)
        .toLowerCase()
        .trim();

      if (
        value === "completed" ||
        value === "complete" ||
        value === "delivered"
      ) {
        status = "Completed";
      } else if (
        value === "incomplete" ||
        value === "cancelled" ||
        value === "canceled" ||
        value === "failed"
      ) {
        status = "Incomplete";
      } else {
        status = "Pending";
      }

      if (!statusMap[status]) {
        statusMap[status] = {
          status,
          count: 0,
          total: 0,
        };
      }

      statusMap[status].count += 1;

      statusMap[status].total +=
        Number(order.totalAmount || 0);
    });

    const status = Object.values(statusMap);

    // =======================================================
    // ORDER AREAS
    // =======================================================

    const areaMap = {};

    currentOrders.forEach((order) => {
      const location =
        order?.deliveryAddress?.city ||
        order?.shippingAddress?.city ||
        order?.address?.city ||
        order?.city ||
        order?.location ||
        "Unknown";

      if (!areaMap[location]) {
        areaMap[location] = 0;
      }

      areaMap[location] += 1;
    });

    const areas = Object.entries(areaMap)
      .map(([location, count]) => ({
        location,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // =======================================================
    // ACTIVITY
    // =======================================================

    const activity = [
      {
        date: date || currentStart.toISOString().split("T")[0],

        count: currentOrders.length,
      },
    ];

    // =======================================================
    // STOCK ALERT
    // =======================================================

    const stockAlerts =
      await Product.countDocuments({
        stock: {
          $lte: 5,
        },
      });

    // =======================================================
    // NOTIFICATIONS
    // =======================================================

    const pendingOrders = statusMap.Pending?.count || 0;

    const notifications = pendingOrders;

    // =======================================================
    // TOP PRODUCTS
    // =======================================================
    //
    // এখানে Product model থেকে latest products দেখানো হচ্ছে।
    // Actual sold quantity যদি MainOrder-এর items থেকে নিতে হয়,
    // তাহলে MainOrder schema অনুযায়ী আলাদা aggregation লাগবে।
    //

    const products = await Product.find({})
      .sort({
        createdAt: -1,
      })
      .limit(4)
      .lean();

    const topProducts = products.map((product) => ({
      id: product._id,

      name:
        product.name ||
        product.title ||
        "Unnamed Product",

      image:
        product.images?.[0]?.url ||
        product.images?.[0] ||
        product.image ||
        "/images.png",

      sold:
        product.sold ||
        product.totalSold ||
        0,

      price:
        product.discountPrice ||
        product.salePrice ||
        product.price ||
        0,
    }));

    // =======================================================
    // STORE
    // =======================================================

    const store = {
      store_name: "Apple Gadgets",
      store_sub: "Admin Dashboard",
    };

    // =======================================================
    // RESPONSE
    // =======================================================

    res.status(200).json({
      success: true,

      date:
        date ||
        currentStart.toISOString().split("T")[0],

      summary,

      activity,

      topProducts,

      status,

      areas,

      stockAlerts,

      notifications,

      store,
    });
  } catch (error) {
    console.error(
      "Dashboard Summary API Error:",
      error
    );

    res.status(500).json({
      success: false,

      message: "Server error",

      error: error.message,
    });
  }
};