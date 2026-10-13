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

// ================= PDF INVOICE (Colorful Design) =================
export const generateInvoicePDF = (order) =>
  new Promise((resolve, reject) => {
    let doc;

    try {
      doc = new PDFDocument({
        size: "A4",
        margin: 40,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const pageWidth = 595;
      const pageBottom = 780;
      const left = 40;
      const right = 555;
      const contentWidth = right - left;

      const checkPage = (height = 50) => {
        if (doc.y + height > pageBottom) {
          doc.addPage();
          return true;
        }
        return false;
      };

      // ========== HEADER BAND ==========
      doc.rect(0, 0, pageWidth, 90).fill("#ea580c");

      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(24)
        .text("APPLE GADGET BD", left, 28, {
          width: contentWidth,
          align: "left",
        });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#ffedd5")
        .text("GENUINE PRODUCTS  ·  BEST SERVICE", left, 56);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#ffffff")
        .text("ORDER BILL / INVOICE", left, 56, {
          width: contentWidth,
          align: "right",
        });

      // ========== ORDER META ==========
      let y = 110;

      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`Order ID: ${order.orderId}`, left, y);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6B7280")
        .text(
          `Date: ${new Date(order.createdAt || Date.now()).toLocaleString("en-GB")}`,
          left,
          y + 18
        );

      // Status badges (right side)
      const paymentStatus = readable(order.paymentStatus || "unpaid");
      const orderStatus = readable(order.status || "pending");

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#059669")
        .text(`Payment: ${paymentStatus}`, left, y, {
          width: contentWidth,
          align: "right",
        });

      doc
        .fillColor("#2563EB")
        .text(`Status: ${orderStatus}`, left, y + 14, {
          width: contentWidth,
          align: "right",
        });

      y = 160;

      // ========== CUSTOMER BOX ==========
      doc
        .roundedRect(left, y, contentWidth, 95, 6)
        .fill("#FFF7ED");

      doc
        .fillColor("#9A3412")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("CUSTOMER INFORMATION", left + 14, y + 12);

      doc.font("Helvetica").fontSize(10).fillColor("#111827");

      const area =
        typeof order.selectArea === "object"
          ? order.selectArea?.name || order.selectArea?.label || "N/A"
          : order.selectArea || "N/A";

      const customerLines = [
        `Name: ${order.customerName || "N/A"}`,
        `Email: ${order.email || "N/A"}`,
        `Phone: ${order.phone || "N/A"}`,
        `Delivery Area: ${String(area)}`,
        `Address: ${order.deliveryAddress || "N/A"}`,
      ];

      customerLines.forEach((line, i) => {
        doc.text(line, left + 14, y + 30 + i * 12, {
          width: contentWidth - 28,
        });
      });

      y += 115;

      // ========== PRODUCTS TABLE ==========
      const colProduct = left + 8;
      const colQty = 320;
      const colPrice = 365;
      const colTotal = 450;

      const drawTableHeader = () => {
        doc.rect(left, y, contentWidth, 26).fill("#ea580c");

        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(9);

        doc.text("PRODUCT", colProduct, y + 8, { width: 260 });
        doc.text("QTY", colQty, y + 8, { width: 35, align: "center" });
        doc.text("PRICE", colPrice, y + 8, { width: 75, align: "right" });
        doc.text("TOTAL", colTotal, y + 8, { width: 95, align: "right" });

        y += 30;
      };

      drawTableHeader();

      const products = order.products || [];

      products.forEach((item, index) => {
        const name = String(item.name || "Product");
        const variant = [item.color, item.ram, item.storage, item.size]
          .filter(Boolean)
          .join(" / ");

        const description = variant ? `${name}\n${variant}` : name;

        const descriptionHeight = doc.heightOfString(description, {
          width: 255,
          font: "Helvetica",
          fontSize: 9,
        });

        const rowHeight = Math.max(descriptionHeight + 12, 28);

        if (y + rowHeight > pageBottom - 120) {
          doc.addPage();
          y = 40;
          drawTableHeader();
        }

        // Alternating row background
        if (index % 2 === 0) {
          doc.rect(left, y - 4, contentWidth, rowHeight).fill("#F8FAFC");
        }

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#111827");

        doc.text(description, colProduct, y, { width: 255 });

        doc.text(String(item.quantity || 0), colQty, y, {
          width: 35,
          align: "center",
        });

        doc.text(money(item.price), colPrice, y, {
          width: 75,
          align: "right",
        });

        const itemTotal =
          item.subtotal ??
          Number(item.price || 0) * Number(item.quantity || 0);

        doc
          .font("Helvetica-Bold")
          .text(money(itemTotal), colTotal, y, {
            width: 95,
            align: "right",
          });

        y += rowHeight;

        // Light divider
        doc
          .moveTo(left, y)
          .lineTo(right, y)
          .strokeColor("#E2E8F0")
          .lineWidth(0.5)
          .stroke();

        y += 4;
      });

      y += 18;

      // ========== SUMMARY BOX ==========
      checkPage(160);

      const summaryX = 320;
      const summaryWidth = 235;

      doc
        .roundedRect(summaryX, y, summaryWidth, 115, 6)
        .fill("#FFF7ED");

      doc
        .fillColor("#9A3412")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("PAYMENT SUMMARY", summaryX + 14, y + 12);

      const summaryRow = (label, value, isTotal = false, offsetY) => {
        doc
          .font(isTotal ? "Helvetica-Bold" : "Helvetica")
          .fontSize(isTotal ? 11 : 10)
          .fillColor(isTotal ? "#ea580c" : "#111827");

        doc.text(label, summaryX + 14, offsetY, { width: 100 });
        doc.text(value, summaryX + 14, offsetY, {
          width: summaryWidth - 28,
          align: "right",
        });
      };

      summaryRow("Subtotal", money(order.subTotal), false, y + 34);
      summaryRow("Delivery Charge", money(order.deliveryCharge), false, y + 52);
      summaryRow("Discount", `- ${money(order.discountAmount)}`, false, y + 70);

      // Divider
      doc
        .moveTo(summaryX + 14, y + 88)
        .lineTo(summaryX + summaryWidth - 14, y + 88)
        .strokeColor("#FDBA74")
        .lineWidth(1)
        .stroke();

      summaryRow("TOTAL PAYABLE", money(order.totalAmount), true, y + 96);

      y += 135;

      // ========== PAYMENT DETAILS ==========
      checkPage(60);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#64748B")
        .text(
          `Payment Method: ${readable(order.paymentMethod || "N/A")}`,
          left,
          y
        );
      doc.text(
        `Payment Status: ${readable(order.paymentStatus || "unpaid")}`,
        left,
        y + 14
      );
      doc.text(
        `Order Status: ${readable(order.status || "pending")}`,
        left,
        y + 28
      );

      // ========== FOOTER ==========
      const footerY = 800;

      doc
        .rect(0, footerY - 30, pageWidth, 50)
        .fill("#0f172a");

      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Thank you for shopping with Apple Gadget BD!", 0, footerY - 12, {
          width: pageWidth,
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#94A3B8")
        .text("Please keep this invoice for your records.", 0, footerY + 4, {
          width: pageWidth,
          align: "center",
        });

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
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const invoiceUrl = `${frontendUrl}/invoice/${encodeURIComponent(order.orderId)}`;

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