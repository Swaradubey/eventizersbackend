const PDFDocument = require("pdfkit");

/**
 * Generate a professional, beautifully styled PDF invoice / receipt buffer.
 * @param {Object} invoice - Invoice details
 * @param {Object} [user] - Optional user object
 * @returns {Promise<Buffer>}
 */
const generateInvoicePdfBuffer = (invoice, user = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 45,
        info: {
          Title: `Invoice ${invoice.invoice_number || invoice.id || ""}`,
          Author: "InviteHub",
          Subject: "Subscription Payment Receipt",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // Brand Colors
      const primaryColor = "#2D1B3D";    // Rich deep purple
      const accentGold = "#C9A84C";      // Warm gold
      const textDark = "#1F2937";        // Gray 800
      const textMuted = "#6B7280";       // Gray 500
      const lightBg = "#F9FAFB";         // Light neutral
      const borderGray = "#E5E7EB";      // Light border
      const successColor = "#059669";    // Emerald

      const invoiceNumber = invoice.invoice_number || invoice.id || "INV-0001";
      const transactionId = invoice.transaction_id || invoice.stripe_invoice_id || invoice.id || "N/A";
      const planName = invoice.plan_name || (user && user.plan ? `${user.plan} Plan` : "Pro Plan");
      const billingPeriod = invoice.billing_period || "Monthly";
      const customerName = invoice.customer_name || user.name || "Customer";
      const customerEmail = invoice.customer_email || user.email || "billing@invitehub.io";
      const status = (invoice.status || "Paid").toUpperCase();
      const currency = (invoice.currency || "USD").toUpperCase();
      const amountVal = parseFloat(invoice.amount || 0);
      const amountStr = `${currency === "USD" ? "$" : currency + " "}${amountVal.toFixed(2)}`;

      // Format Date
      let invoiceDateStr = "N/A";
      if (invoice.invoice_date || invoice.date || invoice.created_at) {
        const d = new Date(invoice.invoice_date || invoice.date || invoice.created_at);
        invoiceDateStr = isNaN(d.getTime()) ? new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      } else {
        invoiceDateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      }

      // --- HEADER SECTION ---
      // Top accent bar
      doc.rect(45, 45, 505, 4).fill(accentGold);

      // Logo Icon + Text
      // Draw a sleek geometric icon for InviteHub
      doc.save();
      doc.roundedRect(45, 60, 36, 36, 8).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold").text("I", 56, 70, { width: 14, align: "center" });
      doc.restore();

      doc.fillColor(primaryColor).fontSize(22).font("Helvetica-Bold").text("INVITEHUB", 90, 64);
      doc.fillColor(textMuted).fontSize(9).font("Helvetica").text("The Modern Event & Invitation Management Platform", 90, 88);

      // Document Type & Number on Top Right
      doc.fillColor(accentGold).fontSize(10).font("Helvetica-Bold").text("PAYMENT RECEIPT", 350, 64, { align: "right", width: 200 });
      doc.fillColor(textDark).fontSize(14).font("Helvetica-Bold").text(`#${invoiceNumber}`, 350, 78, { align: "right", width: 200 });

      // Divider
      doc.moveTo(45, 115).lineTo(550, 115).strokeColor(borderGray).lineWidth(1).stroke();

      // --- SUMMARY CARDS / DETAILS (Two Column Layout) ---
      const topMetaY = 130;

      // Left Column: Customer Info
      doc.fillColor(accentGold).fontSize(9).font("Helvetica-Bold").text("BILLED TO", 45, topMetaY);
      doc.fillColor(textDark).fontSize(12).font("Helvetica-Bold").text(customerName, 45, topMetaY + 14);
      doc.fillColor(textMuted).fontSize(10).font("Helvetica").text(customerEmail, 45, topMetaY + 30);
      if (user && user.company) {
        doc.text(user.company, 45, topMetaY + 44);
      }

      // Right Column: Invoice Meta Details Box
      const metaBoxX = 330;
      doc.roundedRect(metaBoxX, topMetaY, 220, 95, 6).fill(lightBg).stroke(borderGray);

      const renderMetaRow = (label, value, yOffset) => {
        doc.fillColor(textMuted).fontSize(8.5).font("Helvetica").text(label, metaBoxX + 12, topMetaY + yOffset);
        doc.fillColor(textDark).fontSize(8.5).font("Helvetica-Bold").text(value, metaBoxX + 100, topMetaY + yOffset, { width: 108, align: "right" });
      };

      renderMetaRow("Invoice Date:", invoiceDateStr, 12);
      renderMetaRow("Billing Period:", billingPeriod, 28);
      renderMetaRow("Transaction ID:", transactionId.length > 18 ? transactionId.substring(0, 18) + "..." : transactionId, 44);
      renderMetaRow("Payment Status:", status, 60);

      // Small Status Badge inside box
      const statusBadgeColor = status === "PAID" ? successColor : accentGold;
      doc.circle(metaBoxX + 115, topMetaY + 64, 3.5).fill(statusBadgeColor);

      // --- LINE ITEMS TABLE ---
      const tableTopY = 250;

      // Table Header Row
      doc.rect(45, tableTopY, 505, 26).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold");
      doc.text("ITEM DESCRIPTION", 55, tableTopY + 8);
      doc.text("BILLING CYCLE", 270, tableTopY + 8);
      doc.text("QTY", 390, tableTopY + 8, { width: 40, align: "center" });
      doc.text("TOTAL AMOUNT", 445, tableTopY + 8, { width: 95, align: "right" });

      // Table Body Row
      const rowY = tableTopY + 26;
      doc.rect(45, rowY, 505, 42).fill("#FFFFFF").stroke(borderGray);

      doc.fillColor(textDark).fontSize(10).font("Helvetica-Bold").text(`InviteHub ${planName} Subscription`, 55, rowY + 10);
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica").text("Full access to invitation templates, analytics & guest management", 55, rowY + 24);

      doc.fillColor(textDark).fontSize(9.5).font("Helvetica").text(billingPeriod, 270, rowY + 16);
      doc.text("1", 390, rowY + 16, { width: 40, align: "center" });
      doc.font("Helvetica-Bold").text(amountStr, 445, rowY + 16, { width: 95, align: "right" });

      // --- TOTALS SECTION ---
      const totalsY = rowY + 55;

      // Totals summary box on right
      const totalsBoxX = 330;
      doc.fillColor(textMuted).fontSize(9).font("Helvetica").text("Subtotal:", totalsBoxX, totalsY);
      doc.fillColor(textDark).fontSize(9).font("Helvetica").text(amountStr, totalsBoxX + 100, totalsY, { width: 120, align: "right" });

      doc.fillColor(textMuted).fontSize(9).font("Helvetica").text("Taxes & Fees:", totalsBoxX, totalsY + 16);
      doc.fillColor(textDark).fontSize(9).font("Helvetica").text(`${currency === "USD" ? "$" : currency + " "}0.00`, totalsBoxX + 100, totalsY + 16, { width: 120, align: "right" });

      doc.moveTo(totalsBoxX, totalsY + 32).lineTo(550, totalsY + 32).strokeColor(borderGray).lineWidth(1).stroke();

      // Total Paid Highlight
      doc.rect(totalsBoxX, totalsY + 38, 220, 32).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold").text("Total Paid", totalsBoxX + 12, totalsY + 48);
      doc.fillColor(accentGold).fontSize(12).font("Helvetica-Bold").text(amountStr, totalsBoxX + 90, totalsY + 47, { width: 118, align: "right" });

      // Payment Confirmation Stamp / Box on the left
      const stampY = totalsY;
      doc.roundedRect(45, stampY, 250, 70, 6).fill(lightBg).stroke(borderGray);
      doc.fillColor(successColor).fontSize(10).font("Helvetica-Bold").text("PAYMENT RECEIVED", 58, stampY + 12);
      doc.fillColor(textMuted).fontSize(8.5).font("Helvetica").text(`Thank you! Your payment for ${amountStr} has been successfully processed.`, 58, stampY + 28, { width: 225 });
      doc.fillColor(textMuted).fontSize(8).font("Helvetica-Oblique").text(`Reference: ${transactionId}`, 58, stampY + 52, { width: 225 });

      // --- FOOTER & COMPLIANCE ---
      const footerY = 700;
      doc.moveTo(45, footerY).lineTo(550, footerY).strokeColor(borderGray).lineWidth(1).stroke();

      doc.fillColor(textMuted).fontSize(8).font("Helvetica").text(
        "InviteHub, Inc. • Seamless Event Planning & Guest Management",
        45,
        footerY + 10,
        { align: "center", width: 505 }
      );
      doc.text(
        "Questions regarding this invoice? Contact our billing team at support@invitehub.io",
        45,
        footerY + 22,
        { align: "center", width: 505 }
      );
      doc.fillColor(accentGold).fontSize(7.5).font("Helvetica-Bold").text(
        `Generated on ${new Date().toUTCString()} • Page 1 of 1`,
        45,
        footerY + 36,
        { align: "center", width: 505 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInvoicePdfBuffer,
};
