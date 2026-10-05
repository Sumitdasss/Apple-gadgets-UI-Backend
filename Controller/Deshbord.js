import MainOrder from '../Model/MainOrder.js';
import Product  from'../Model/Product.js';
import Customer  from'../Model/Customer.js';

export const getDashboardSummary = async (req, res) => {
  try {
    const { range = 'today' } = req.query;

    const now = new Date();
    let currentStart = new Date();
    let previousStart = new Date();
    let previousEnd = new Date();

    if (range === 'today') {
      currentStart.setHours(0, 0, 0, 0);

      previousStart.setDate(now.getDate() - 1);
      previousStart.setHours(0, 0, 0, 0);
      previousEnd.setDate(now.getDate() - 1);
      previousEnd.setHours(23, 59, 59, 999);
    } else if (range === 'yesterday') {
      currentStart.setDate(now.getDate() - 1);
      currentStart.setHours(0, 0, 0, 0);

      previousStart.setDate(now.getDate() - 2);
      previousStart.setHours(0, 0, 0, 0);
      previousEnd.setDate(now.getDate() - 2);
      previousEnd.setHours(23, 59, 59, 999);
    } else if (range === '7d') {
      currentStart.setDate(now.getDate() - 7);
      currentStart.setHours(0, 0, 0, 0);

      previousStart.setDate(now.getDate() - 14);
      previousStart.setHours(0, 0, 0, 0);
      previousEnd.setDate(now.getDate() - 7);
      previousEnd.setHours(23, 59, 59, 999);
    } else if (range === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);

      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    // ২. বর্তমান সময়ের ডাটা কাউন্ট করা
    const currentOrders = await MainOrder.find({
      createdAt: { $gte: currentStart },
    });

    const previousOrders = await MainOrder.find({
      createdAt: { $gte: previousStart,$lte: previousEnd },
    });

    // Total Orders Count
    const totalOrdersCount = await MainOrder.countDocuments();
    const currentPeriodOrdersCount = currentOrders.length;
    const previousPeriodOrdersCount = previousOrders.length;

    // Total Sales Amount
    const totalSalesAggregate = await MainOrder.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalSalesValue = totalSalesAggregate[0]?.total || 0;

    const currentSales = currentOrders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);
    const previousSales = previousOrders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);

    // Total Items Count
    const totalItemsCount = await Product.countDocuments();

    // Total Customers Count
    const totalCustomersCount = await Customer.countDocuments();

    // ৩. পার্সেন্টেজ গ্রোথ হিসাব করার হেলপার ফাংশন
    const calcGrowth = (curr, prev) => {
      if (prev === 0) return curr > 0 ? '+100.0%' : '+0.0%';
      const diff = ((curr - prev) / prev) * 100;
      const sign = diff >= 0 ? '+' : '';
      return `${sign}${diff.toFixed(1)}%`;
    };

    // ৪. ফ্রন্টএন্ডের জন্য কার্ড ডাটা ফরম্যাটিং (cardMeta অনুযায়ী key নাম)
    const summary = [
      {
        key: 'orders',
        value: totalOrdersCount,
        growth: calcGrowth(currentPeriodOrdersCount, previousPeriodOrdersCount),
      },
      {
        key: 'sales',
        value: totalSalesValue,
        growth: calcGrowth(currentSales, previousSales),
      },
      {
        key: 'items',
        value: totalItemsCount,
        growth: '+0.0%',
      },
      {
        key: 'customers',
        value: totalCustomersCount,
        growth: '+0.0%',
      },
    ];

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Dashboard Summary API Error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}