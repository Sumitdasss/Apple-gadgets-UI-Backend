import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

// ================= SMTP CONFIGURATION =================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

// ================= HELPER FUNCTIONS =================

const money = (amount) =>
  `BDT ${Number(amount || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const readable = (value = "") =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

// ================= PDF INVOICE =================

export const generateInvoicePDF = (order) =>
  new Promise((resolve, reject) => {
    let doc;

    try {
      doc = new PDFDocument({
        size: "A4",
        margin: 45,
      });

      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      const pageBottom = 770;

      const checkPage = (height = 40) => {
        if (doc.y + height > pageBottom) {
          doc.addPage();
        }
      };

      // Header
      doc
        .font("Helvetica-Bold")
        .fontSize(25)
        .fillColor("#111827")
        .text("APPLE GADGET BD");

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6B7280")
        .text("ORDER BILL / INVOICE");

      doc.moveDown(1.5);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#111827")
        .text(`Order ID: ${order.orderId}`);

      doc
        .font("Helvetica")
        .fontSize(10)
        .text(
          `Date: ${new Date(
            order.createdAt || Date.now()
          ).toLocaleString("en-GB")}`
        );

      doc.moveDown();

      // Customer information
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text("Customer Information");

      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(10);

      doc.text(`Name: ${order.customerName || "N/A"}`);
      doc.text(`Email: ${order.email || "N/A"}`);
      doc.text(`Phone: ${order.phone || "N/A"}`);

      const area =
        typeof order.selectArea === "object"
          ? order.selectArea?.name ||
            order.selectArea?.label ||
            "N/A"
          : order.selectArea || "N/A";

      doc.text(`Delivery Area: ${String(area)}`);
      doc.text(`Address: ${order.deliveryAddress || "N/A"}`);

      doc.moveDown(1.5);

      // Product table
      const left = 45;
      const right = 550;
      const tableWidth = right - left;

      let y = doc.y;

      const drawTableHeader = () => {
        doc.rect(left, y, tableWidth, 25).fill("#F3F4F6");

        doc
          .fillColor("#111827")
          .font("Helvetica-Bold")
          .fontSize(9);

        doc.text("Product", left + 8, y + 8, {
          width: 200,
        });

        doc.text("Qty", 335, y + 8, {
          width: 30,
        });

        doc.text("Price", 370, y + 8, {
          width: 75,
        });

        doc.text("Total", 455, y + 8, {
          width: 90,
        });

        y += 32;
        doc.y = y;
      };

      drawTableHeader();

      for (const item of order.products || []) {
        const name = String(item.name || "Product");

        const variant = [
          item.color,
          item.ram,
          item.storage,
          item.size,
        ]
          .filter(Boolean)
          .join(" / ");

        const description = variant
          ? `${name}\n${variant}`
          : name;

        const descriptionHeight = doc.heightOfString(
          description,
          {
            width: 195,
            font: "Helvetica",
            fontSize: 9,
          }
        );

        const rowHeight = Math.max(
          descriptionHeight + 8,
          25
        );

        if (y + rowHeight > pageBottom) {
          doc.addPage();
          y = 45;
          drawTableHeader();
        }

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#111827");

        doc.text(description, left + 8, y, {
          width: 195,
        });

        doc.text(String(item.quantity || 0), 335, y, {
          width: 30,
        });

        doc.text(money(item.price), 370, y, {
          width: 75,
        });

        const itemTotal =
          item.subtotal ??
          Number(item.price || 0) *
            Number(item.quantity || 0);

        doc.text(money(itemTotal), 455, y, {
          width: 90,
        });

        y += rowHeight;

        doc
          .moveTo(left, y)
          .lineTo(right, y)
          .strokeColor("#E5E7EB")
          .stroke();

        y += 8;
      }

      // Totals
      y += 15;
      doc.y = y;

      checkPage(150);
      y = doc.y;

      const summaryRow = (label, value, bold = false) => {
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(bold ? 11 : 10)
          .fillColor("#111827");

        doc.text(label, 330, y, {
          width: 120,
        });

        doc.text(value, 450, y, {
          width: 95,
          align: "right",
        });

        y += 23;
        doc.y = y;
      };

      summaryRow("Subtotal", money(order.subTotal));

      summaryRow(
        "Delivery Charge",
        money(order.deliveryCharge)
      );

      summaryRow(
        "Discount",
        `- ${money(order.discountAmount)}`
      );

      doc
        .moveTo(330, y)
        .lineTo(545, y)
        .strokeColor("#9CA3AF")
        .stroke();

      y += 12;
      doc.y = y;

      summaryRow(
        "TOTAL PAYABLE",
        money(order.totalAmount),
        true
      );

      checkPage(75);
      doc.moveDown();

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(
          `Payment Method: ${order.paymentMethod || "N/A"}`
        );

      doc.text(
        `Payment Status: ${order.paymentStatus || "unpaid"}`
      );

      doc.text(
        `Order Status: ${order.status || "pending"}`
      );

      doc.moveDown(2);

      doc
        .fontSize(11)
        .fillColor("#111827")
        .text(
          "Thank you for shopping with Apple Gadget BD!",
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

// ================= SEND INVOICE EMAIL =================

export const sendInvoiceEmail = async (order) => {
  try {
    // Validate SMTP configuration
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS
    ) {
      throw new Error("SMTP configuration is incomplete");
    }

    if (!order?.email?.trim()) {
      throw new Error("Customer email is missing");
    }

    if (!order?.orderId) {
      throw new Error("Order ID is missing");
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(order);

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");

    const invoiceUrl =
      `${frontendUrl}/invoice/${encodeURIComponent(order.orderId)}`;

    // Send complete email
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: order.email.trim(),
      subject: `Apple Gadget BD Invoice - ${order.orderId}`,

      text: `Hello ${order.customerName || "Customer"},

Your order has been placed successfully.

Order ID: ${order.orderId}
Total: ${money(order.totalAmount)}

Your PDF invoice is attached to this email.

View invoice online: ${invoiceUrl}

Thank you for shopping with Apple Gadget BD.`,

      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apple Gadget BD Invoice</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#ea580c;padding:32px 28px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">APPLE GADGET BD</h1>
              <p style="margin:8px 0 0;font-size:12px;color:#ffffff;">GENUINE PRODUCTS · BEST SERVICE</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 0;text-align:center;">
              <span style="display:inline-block;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:50px;padding:8px 18px;color:#059669;font-size:13px;font-weight:600;">✓ Order Placed Successfully</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 32px;">
              <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#0f172a;">Hello ${order.customerName || "Customer"},</p>
              <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#475569;">Thank you for your purchase. Your order has been placed successfully.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:14px;font-size:13px;color:#9a3412;">Order ID</td>
                        <td align="right" style="padding-bottom:14px;font-size:14px;font-weight:700;color:#0f172a;">${order.orderId}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:14px;font-size:13px;color:#9a3412;">Total Payable</td>
                        <td align="right" style="padding-bottom:14px;font-size:18px;font-weight:800;color:#ea580c;">${money(order.totalAmount)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#9a3412;">Payment Status</td>
                        <td align="right" style="font-size:13px;font-weight:600;color:#059669;">${readable(order.paymentStatus || "unpaid")}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#475569;">Your PDF invoice is attached to this email. You can also view it online.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${invoiceUrl}" style="display:inline-block;background-color:#ea580c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">View Invoice Online</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">Need help with your order? Reply to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0f172a;padding:24px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#ffffff;">Thank you for shopping with Apple Gadget BD</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">Please keep this email and the attached invoice for your records.</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:11px;color:#64748b;text-align:center;">This is an automated message from Apple Gadget BD.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,

      attachments: [
        {
          filename: `Invoice-${order.orderId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return true;
  } catch (error) {
    throw error;
  }
};