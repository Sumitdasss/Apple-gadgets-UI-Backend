
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,

  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const money = (amount) =>
  `BDT ${Number(amount || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const generateInvoicePDF = (order) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 45,
    });

    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

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
      .text("SHOPSPACE");

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
          order.createdAt || Date.now(),
        ).toLocaleString("en-GB")}`,
      );

    doc.moveDown();

    // Customer
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

    // Table header
    const left = 45;
    const right = 550;
    const tableWidth = right - left;

    let y = doc.y;

    const drawTableHeader = () => {
      doc.rect(left, y, tableWidth, 25).fill("#F3F4F6");

      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9);

      doc.text("Product", left + 8, y + 8, { width: 200 });
      doc.text("Qty", 335, y + 8, { width: 30 });
      doc.text("Price", 370, y + 8, { width: 75 });
      doc.text("Total", 455, y + 8, { width: 90 });

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
        { width: 195, fontSize: 9 },
      );

      const rowHeight = Math.max(descriptionHeight + 8, 25);

      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = 45;
        drawTableHeader();
      }

      doc.font("Helvetica").fontSize(9).fillColor("#111827");

      doc.text(description, left + 8, y, { width: 195 });

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

    checkPage(120);
    y = doc.y;

    const summaryRow = (label, value, bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 11 : 10)
        .fillColor("#111827");

      doc.text(label, 330, y, { width: 120 });
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
      money(order.deliveryCharge),
    );
    summaryRow(
      "Discount",
      `- ${money(order.discountAmount)}`,
    );

    doc
      .moveTo(330, y)
      .lineTo(545, y)
      .strokeColor("#9CA3AF")
      .stroke();

    y += 12;
    doc.y = y;

    summaryRow("TOTAL PAYABLE", money(order.totalAmount), true);

    checkPage(75);

    doc.moveDown();

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#374151")
      .text(
        `Payment Method: ${order.paymentMethod || "N/A"}`,
      );

    doc.text(
      `Payment Status: ${order.paymentStatus || "unpaid"}`,
    );

    doc.text(`Order Status: ${order.status || "pending"}`);

    doc.moveDown(2);

    doc
      .fontSize(11)
      .fillColor("#111827")
      .text("Thank you for shopping with Shopspace!", {
        align: "center",
      });

    doc.end();
  });

export const sendInvoiceEmail = async (order) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER ||
      !process.env.SMTP_PASS) {
    throw new Error("SMTP configuration is incomplete");
  }

  if (!order.email?.trim()) {
    throw new Error("Customer email is missing");
  }

  const pdfBuffer = await generateInvoicePDF(order);

  const frontendUrl = (
    process.env.FRONTEND_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  const invoiceUrl =
    `${frontendUrl}/invoice/${encodeURIComponent(order.orderId)}`;

  await transporter.sendMail({
    from:
      process.env.MAIL_FROM ||
      process.env.SMTP_USER,

    to: order.email,

    subject: `Shopspace Invoice - ${order.orderId}`,

    text: `Hello ${order.customerName || "Customer"},

Your order has been placed successfully.

Order ID: ${order.orderId}
Total: ${money(order.totalAmount)}

Your PDF invoice is attached to this email.

Invoice page: ${invoiceUrl}

Thank you for shopping with Shopspace.`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;padding:24px;color:#111827">
        <h1 style="margin-bottom:5px">SHOPSPACE</h1>
        <p>Your order has been placed successfully.</p>
        <div style="padding:18px;background:#f3f4f6;border-radius:8px">
          <p><b>Order ID:</b> ${order.orderId}</p>
          <p><b>Total:</b> ${money(order.totalAmount)}</p>
        </div>
        <p>Your PDF billing invoice is attached.</p>
        <p><a href="${invoiceUrl}">View Invoice</a></p>
        <p>Thank you for shopping with Shopspace!</p>
      </div>
    `,

    attachments: [
      {
        filename: `Invoice-${order.orderId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return true;
};
