
import MainOrder from "../Model/MainOrder.js";
import Product from "../Model/Product.js";
import Customer from "../Model/Customer.js";

/* =========================================================
   GROWTH CALCULATION
========================================================= */

const calcGrowth = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? "+100.0%" : "+0.0%";
  }

  const diff = ((current - previous) / previous) * 100;

  const sign = diff >= 0 ? "+" : "";

  return `${sign}${diff.toFixed(1)}%`;
};

/* =========================================================
   GET DASHBOARD SUMMARY
   GET /api/dashboard/summary?date=2026-10-10
========================================================= */

export const getDashboardSummary = async (req, res) => {
  try {
    const { date } = req.query;

    /* =======================================================
       SELECTED DATE
    ======================================================= */

    const selectedDate = date
      ? new Date(`${date}T00:00:00+06:00`)
      : new Date();

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    /* =======================================================
       BANGLADESH DATE RANGE
       
       Example:
       date = 2026-10-10

       Start:
       2026-10-10 00:00 Bangladesh

       End:
       2026-10-10 23:59:59.999 Bangladesh
    ======================================================= */

    const currentStart = new Date(
      `${date || new Date().toISOString().split("T")[0]}T00:00:00+06:00`
    );

    const currentEnd = new Date(
      `${date || new Date().toISOString().split("T")[0]}T23:59:59.999+06:00`
    );

    /* =======================================================
       PREVIOUS DAY
       শুধুমাত্র Growth হিসাবের জন্য
    ======================================================= */

    const previousStart = new Date(currentStart);
    previousStart.setUTCDate(previousStart.getUTCDate() - 1);

    const previousEnd = new Date(currentEnd);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

    /* =======================================================
       CURRENT DAY ORDERS
       শুধু selected date
    ======================================================= */

    const currentOrders = await MainOrder.find({
      createdAt: {
        $gte: currentStart,
        $lte: currentEnd,
      },
    }).lean();

    /* =======================================================
       PREVIOUS DAY ORDERS
       Growth হিসাবের জন্য
    ======================================================= */

    const previousOrders = await MainOrder.find({
      createdAt: {
        $gte: previousStart,
        $lte: previousEnd,
      },
    }).lean();

    /* =======================================================
       CURRENT DAY ORDER COUNT
    ======================================================= */

    const currentPeriodOrdersCount = currentOrders.length;

    const previousPeriodOrdersCount = previousOrders.length;

    /* =======================================================
       CURRENT DAY SALES
    ======================================================= */

    const currentSales = currentOrders.reduce(
      (acc, order) => {
        return acc + Number(order.totalAmount || 0);
      },
      0
    );

    /* =======================================================
       PREVIOUS DAY SALES
    ======================================================= */

    const previousSales = previousOrders.reduce(
      (acc, order) => {
        return acc + Number(order.totalAmount || 0);
      },
      0
    );

    /* =======================================================
       PRODUCT COUNT
       
       selected date-এ তৈরি হওয়া product
    ======================================================= */

    const currentItemsCount = await Product.countDocuments({
      createdAt: {
        $gte: currentStart,
        $lte: currentEnd,
      },
    });

    /* =======================================================
       CUSTOMER COUNT
       
       selected date-এ তৈরি হওয়া customer
    ======================================================= */

    const currentCustomersCount = await Customer.countDocuments({
      createdAt: {
        $gte: currentStart,
        $lte: currentEnd,
      },
    });

    /* =======================================================
       PREVIOUS DAY PRODUCT COUNT
    ======================================================= */

    const previousItemsCount = await Product.countDocuments({
      createdAt: {
        $gte: previousStart,
        $lte: previousEnd,
      },
    });

    /* =======================================================
       PREVIOUS DAY CUSTOMER COUNT
    ======================================================= */

    const previousCustomersCount = await Customer.countDocuments({
      createdAt: {
        $gte: previousStart,
        $lte: previousEnd,
      },
    });

    /* =======================================================
       SUMMARY CARDS
       
       সব selected date অনুযায়ী
    ======================================================= */

    const summary = [
      {
        key: "orders",

        value: currentPeriodOrdersCount,

        growth: calcGrowth(
          currentPeriodOrdersCount,
          previousPeriodOrdersCount
        ),
      },

      {
        key: "sales",

        value: currentSales,

        growth: calcGrowth(
          currentSales,
          previousSales
        ),
      },

      {
        key: "items",

        value: currentItemsCount,

        growth: calcGrowth(
          currentItemsCount,
          previousItemsCount
        ),
      },

      {
        key: "customers",

        value: currentCustomersCount,

        growth: calcGrowth(
          currentCustomersCount,
          previousCustomersCount
        ),
      },
    ];

    /* =======================================================
       ORDER STATUS
       
       শুধু selected date-এর orders
    ======================================================= */

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

      statusMap[status].total += Number(
        order.totalAmount || 0
      );
    });

    const status = Object.values(statusMap);

    /* =======================================================
       ORDER AREAS
       
       শুধু selected date-এর orders
    ======================================================= */

    const areaMap = {};

    currentOrders.forEach((order) => {
      const location =
        String(
          order?.selectArea || ""
        ).trim() || "Unknown";

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
      .sort(
        (a, b) => b.count - a.count
      );

    /* =======================================================
       ORDER ACTIVITY
       
       শুধু selected date
    ======================================================= */

    const activity = [
      {
        date:
          date ||
          currentStart
            .toISOString()
            .split("T")[0],

        count: currentOrders.length,
      },
    ];

    /* =======================================================
       STOCK ALERT
       
       এটি date based না।
       কারণ stock বর্তমান অবস্থার data।
    ======================================================= */

    const stockAlerts =
      await Product.countDocuments({
        stock: {
          $lte: 5,
        },
      });

    /* =======================================================
       NOTIFICATIONS
       
       selected date-এর pending orders
    ======================================================= */

    const pendingOrders =
      statusMap.Pending?.count || 0;

    const notifications =
      pendingOrders;

    /* =======================================================
       TOP SELLING PRODUCTS
       
       শুধু selected date-এর orders
    ======================================================= */

    const topProducts =
      await MainOrder.aggregate([
        /* -----------------------------------------------
           SELECTED DATE FILTER
        ----------------------------------------------- */

        {
          $match: {
            createdAt: {
              $gte: currentStart,
              $lte: currentEnd,
            },
          },
        },

        /* -----------------------------------------------
           PRODUCTS ARRAY খুলবে
        ----------------------------------------------- */

        {
          $unwind: "$products",
        },

        /* -----------------------------------------------
           PRODUCT অনুযায়ী sold quantity
        ----------------------------------------------- */

        {
          $group: {
            _id: "$products.product",

            sold: {
              $sum: {
                $ifNull: [
                  "$products.quantity",
                  1,
                ],
              },
            },
          },
        },

        /* -----------------------------------------------
           বেশি sold আগে
        ----------------------------------------------- */

        {
          $sort: {
            sold: -1,
          },
        },

        /* -----------------------------------------------
           TOP 4
        ----------------------------------------------- */

        {
          $limit: 4,
        },

        /* -----------------------------------------------
           Product collection থেকে data
        ----------------------------------------------- */

        {
          $lookup: {
            from: "products",

            localField: "_id",

            foreignField: "_id",

            as: "product",
          },
        },

        /* -----------------------------------------------
           Product পাওয়া গেলে খুলবে
        ----------------------------------------------- */

        {
          $unwind: "$product",
        },

        /* -----------------------------------------------
           Final response
        ----------------------------------------------- */

        {
          $project: {
            _id: 0,

            id: "$product._id",

            name: "$product.name",

            image: {
              $ifNull: [
                {
                  $arrayElemAt: [
                    "$product.images",
                    0,
                  ],
                },

                "/images.png",
              ],
            },

            sold: 1,

            price: {
              $ifNull: [
                "$product.discountPrice",
                "$product.price",
              ],
            },
          },
        },
      ]);

    /* =======================================================
       STORE
    ======================================================= */

    const store = {
      store_name: "Apple Gadgets",

      store_sub: "Admin Dashboard",
    };

    /* =======================================================
       RESPONSE
    ======================================================= */

    return res.status(200).json({
      success: true,

      date:
        date ||
        currentStart
          .toISOString()
          .split("T")[0],

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

    return res.status(500).json({
      success: false,

      message: "Server error",

      error: error.message,
    });
  }
};