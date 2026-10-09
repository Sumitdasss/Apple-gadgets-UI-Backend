
import MainOrder from "../Model/MainOrder.js";
import Product from "../Model/Product.js";
import Customer from "../Model/Customer.js";

/* =========================================================
   DASHBOARD CACHE
========================================================= */

const dashboardCache = new Map();
const CACHE_TTL = 15 * 1000;
const MAX_CACHE_ITEMS = 100;

const getCached = (key) => {
  const item = dashboardCache.get(key);

  if (!item) return null;

  if (Date.now() >= item.expiresAt) {
    dashboardCache.delete(key);
    return null;
  }

  return item.data;
};

const setCached = (key, data) => {
  // Remove expired entries first.
  for (const [cacheKey, item] of dashboardCache) {
    if (Date.now() >= item.expiresAt) {
      dashboardCache.delete(cacheKey);
    }
  }

  // Keep the cache size limited.
  if (
    dashboardCache.size >= MAX_CACHE_ITEMS &&
    !dashboardCache.has(key)
  ) {
    const oldestKey = dashboardCache.keys().next().value;

    if (oldestKey !== undefined) {
      dashboardCache.delete(oldestKey);
    }
  }

  dashboardCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
};

// Call after creating, updating, or deleting orders/products/customers.
export const clearDashboardCache = () => {
  dashboardCache.clear();
};

/* =========================================================
   BANGLADESH DATE HELPERS
========================================================= */

const getTodayBD = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const isValidDate = (date) => {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);

  // Validate calendar date without timezone conversion issues.
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const getDateRangeBD = (date) => {
  const [year, month, day] = date.split("-").map(Number);

  // Bangladesh is UTC+6.
  const start = new Date(
    Date.UTC(year, month - 1, day) - 6 * 60 * 60 * 1000
  );

  const end = new Date(
    Date.UTC(year, month - 1, day + 1) -
      6 * 60 * 60 * 1000 -
      1
  );

  return { start, end };
};

const getPreviousDateBD = (date) => {
  const [year, month, day] = date.split("-").map(Number);

  const previous = new Date(
    Date.UTC(year, month - 1, day - 1)
  );

  const y = previous.getUTCFullYear();
  const m = String(previous.getUTCMonth() + 1).padStart(2, "0");
  const d = String(previous.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

const calcGrowth = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? "+100.0%" : "+0.0%";
  }

  const diff = ((current - previous) / Math.abs(previous)) * 100;

  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
};

/* =========================================================
   ORDER AGGREGATION PIPELINE
========================================================= */

const buildOrderPipeline = (filter) => [
  { $match: filter },

  {
    $facet: {
      summary: [
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            sales: {
              $sum: {
                $convert: {
                  input: "$totalAmount",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      ],

      statuses: [
        {
          $project: {
            rawStatus: {
              $toLower: {
                $trim: {
                  input: {
                    $ifNull: [
                      "$status",
                      { $ifNull: ["$orderStatus", "Pending"] },
                    ],
                  },
                },
              },
            },

            totalAmount: {
              $convert: {
                input: "$totalAmount",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },

        {
          $project: {
            status: {
              $switch: {
                branches: [
                  {
                    case: {
                      $in: ["$rawStatus", ["completed", "complete"]],
                    },
                    then: "Completed",
                  },
                  {
                    case: { $eq: ["$rawStatus", "delivered"] },
                    then: "Delivered",
                  },
                  {
                    case: {
                      $in: ["$rawStatus", ["incomplete", "failed"]],
                    },
                    then: "Incomplete",
                  },
                  {
                    case: {
                      $in: ["$rawStatus", ["cancelled", "canceled"]],
                    },
                    then: "Cancelled",
                  },
                  {
                    case: { $eq: ["$rawStatus", "processing"] },
                    then: "Processing",
                  },
                ],
                default: "Pending",
              },
            },
            totalAmount: 1,
          },
        },

        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            total: { $sum: "$totalAmount" },
          },
        },

        {
          $project: {
            _id: 0,
            status: "$_id",
            count: 1,
            total: 1,
          },
        },
      ],

      areas: [
        {
          $project: {
            location: {
              $let: {
                vars: {
                  trimmedArea: {
                    $trim: {
                      input: {
                        $ifNull: ["$selectArea", ""],
                      },
                    },
                  },
                },
                in: {
                  $cond: [
                    { $eq: ["$$trimmedArea", ""] },
                    "Unknown",
                    "$$trimmedArea",
                  ],
                },
              },
            },
          },
        },

        {
          $group: {
            _id: "$location",
            count: { $sum: 1 },
          },
        },

        { $sort: { count: -1 } },

        {
          $project: {
            _id: 0,
            location: "$_id",
            count: 1,
          },
        },
      ],

      activity: [
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Dhaka",
              },
            },
            count: { $sum: 1 },
            sales: {
              $sum: {
                $convert: {
                  input: "$totalAmount",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },

        { $sort: { _id: 1 } },

        {
          $project: {
            _id: 0,
            date: "$_id",
            count: 1,
            orders: "$count",
            sales: 1,
          },
        },
      ],
    },
  },
];

/* =========================================================
   DASHBOARD SUMMARY
   GET /api/dashboard/summary?date=all
   GET /api/dashboard/summary?date=YYYY-MM-DD
========================================================= */

export const getDashboardSummary = async (req, res) => {
  try {
    const rawDate = req.query.date;

    // No date, empty date, or date=all means all-time data.
    const allTime =
      rawDate === undefined ||
      rawDate === "" ||
      rawDate === "all";

    const selectedDate = allTime ? getTodayBD() : rawDate;

    // Validate before querying MongoDB.
    if (!allTime && !isValidDate(selectedDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date. Use YYYY-MM-DD or date=all",
        receivedDate: selectedDate,
      });
    }

    const cacheKey = allTime
      ? "dashboard:all"
      : `dashboard:${selectedDate}`;

    const cached = getCached(cacheKey);

    if (cached) {
      res.set("X-Dashboard-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const currentRange = getDateRangeBD(selectedDate);
    const previousDate = getPreviousDateBD(selectedDate);
    const previousRange = getDateRangeBD(previousDate);

    const currentFilter = allTime
      ? {}
      : {
          createdAt: {
            $gte: currentRange.start,
            $lte: currentRange.end,
          },
        };

    const previousFilter = {
      createdAt: {
        $gte: previousRange.start,
        $lte: previousRange.end,
      },
    };

    const [
      currentResult,
      previousResult,
      currentItemsCount,
      currentCustomersCount,
      previousItemsCount,
      previousCustomersCount,
      stockAlerts,
      availableDatesResult,
      topProducts,
    ] = await Promise.all([
      MainOrder.aggregate(buildOrderPipeline(currentFilter)),

      allTime
        ? Promise.resolve([])
        : MainOrder.aggregate(buildOrderPipeline(previousFilter)),

      // Preserve the original behavior: products/customers filtered by createdAt.
      Product.countDocuments(currentFilter),

      Customer.countDocuments(currentFilter),

      allTime
        ? Promise.resolve(0)
        : Product.countDocuments(previousFilter),

      allTime
        ? Promise.resolve(0)
        : Customer.countDocuments(previousFilter),

      Product.countDocuments({
        stock: { $lte: 5 },
      }),

      MainOrder.aggregate([
        {
          $match: {
            createdAt: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Dhaka",
              },
            },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 365 },
        {
          $project: {
            _id: 0,
            date: "$_id",
          },
        },
      ]),

      MainOrder.aggregate([
        ...(allTime ? [] : [{ $match: currentFilter }]),

        { $unwind: "$products" },

        {
          $group: {
            _id: "$products.product",
            sold: {
              $sum: {
                $ifNull: ["$products.quantity", 1],
              },
            },
          },
        },

        { $sort: { sold: -1 } },
        { $limit: 4 },

        {
          $lookup: {
            from: Product.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },

        { $unwind: "$product" },

        {
          $project: {
            _id: 0,
            id: "$product._id",
            name: {
              $ifNull: ["$product.name", "Unnamed Product"],
            },
            image: {
              $ifNull: [
                { $arrayElemAt: ["$product.images", 0] },
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
      ]),
    ]);

    const current = currentResult[0] || {};
    const previous = previousResult[0] || {};

    const currentSummary = current.summary?.[0] || {
      orders: 0,
      sales: 0,
    };

    const previousSummary = previous.summary?.[0] || {
      orders: 0,
      sales: 0,
    };

    const currentOrdersCount = currentSummary.orders || 0;
    const currentSales = currentSummary.sales || 0;

    const previousOrdersCount = previousSummary.orders || 0;
    const previousSales = previousSummary.sales || 0;

    const summary = [
      {
        key: "orders",
        value: currentOrdersCount,
        growth: allTime
          ? null
          : calcGrowth(currentOrdersCount, previousOrdersCount),
      },
      {
        key: "sales",
        value: currentSales,
        growth: allTime
          ? null
          : calcGrowth(currentSales, previousSales),
      },
      {
        key: "items",
        value: currentItemsCount,
        growth: allTime
          ? null
          : calcGrowth(currentItemsCount, previousItemsCount),
      },
      {
        key: "customers",
        value: currentCustomersCount,
        growth: allTime
          ? null
          : calcGrowth(currentCustomersCount, previousCustomersCount),
      },
    ];

    const status = current.statuses || [];
    const areas = current.areas || [];

    const activity = allTime
      ? current.activity || []
      : [
          {
            date: selectedDate,
            count: currentOrdersCount,
            orders: currentOrdersCount,
            sales: currentSales,
          },
        ];

    const notifications =
      status.find((item) => item.status === "Pending")?.count || 0;

    const response = {
      success: true,
      mode: allTime ? "all-time" : "selected-date",
      date: allTime ? null : selectedDate,
      summary,
      activity,
      topProducts,
      status,
      areas,
      availableDates: availableDatesResult.map((item) => item.date),
      stockAlerts,
      notifications,
      store: {
        store_name: "Apple Gadgets",
        store_sub: "Admin Dashboard",
      },
    };

    setCached(cacheKey, response);

    res.set("X-Dashboard-Cache", "MISS");
    return res.status(200).json(response);
  } catch (error) {
    console.error("Dashboard Summary API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Dashboard data could not be loaded.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

