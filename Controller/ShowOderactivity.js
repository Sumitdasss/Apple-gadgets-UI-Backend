import MainOrder from "../Model/MainOrder.js";


export const OderActivity =async (req,res)=> {
try {
    const activityData = await MainOrder.aggregate([
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
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const formattedData = activityData.map((item) => ({
      date: item._id,
      count: item.count,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Order activity error:", error);

    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }


    }