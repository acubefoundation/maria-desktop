import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Extracts raw data to Excel
 * @param {Array} data The raw array of objects
 * @param {Array} columns Array of { key, label, render } objects
 * @param {string} filename Base name of the file
 */
export const exportToExcel = (data, columns, filename) => {
  const exportCols = columns.filter(c => !c.excludeFromExport);
  
  const exportData = data.map((row) => {
    const formattedRow = {};
    exportCols.forEach((col) => {
      let value = row[col.key];
      
      if (!value && col.key && col.key.includes('.')) {
        value = col.key.split('.').reduce((acc, part) => acc && acc[part], row);
      }

      if (col.exportValue) {
        formattedRow[col.label] = col.exportValue(row);
      } else {
        formattedRow[col.label] = value ?? '';
      }
    });
    return formattedRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Exports data to PDF with autotable
 * @param {Array} data The raw array of objects
 * @param {Array} columns Array of { key, label, exportValue } objects
 * @param {string} filename Base name of the file
 * @param {string} title Title to display inside PDF
 */
export const exportToPdf = (data, columns, filename, title = 'Export') => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const exportCols = columns.filter(c => !c.excludeFromExport);
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  const head = [exportCols.map(col => col.label)];
  
  const body = data.map(row => {
    return exportCols.map(col => {
      let value = row[col.key];
      if (!value && col.key && col.key.includes('.')) {
        value = col.key.split('.').reduce((acc, part) => acc && acc[part], row);
      }
      
      if (col.exportValue) {
        return col.exportValue(row) ?? '';
      }
      return value ?? '';
    });
  });

  autoTable(doc, {
    startY: 30,
    head,
    body,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80] },
    styles: { fontSize: 9 },
  });

  doc.save(`${filename}.pdf`);
};

export const exportWaybillPdf = (outing) => {
  const doc = new jsPDF({ orientation: 'portrait' });
  
  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("COFFEE DISPATCH WAYBILL", 105, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 26, { align: "center" });
  
  doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);
  
  // Dispatch Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DISPATCH DETAILS", 14, 40);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Dispatch No: ${outing.dispatchNo}`, 14, 50);
  doc.text(`Date: ${new Date(outing.dispatchDate).toLocaleString()}`, 14, 58);
  doc.text(`Purpose: ${outing.purpose}`, 14, 66);
  doc.text(`Destination: ${outing.destination || 'N/A'}`, 14, 74);
  
  // Coffee Info
  doc.setFont("helvetica", "bold");
  doc.text("COFFEE INFORMATION", 14, 90);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Source Batch: ${outing.entry?.batchNo || 'N/A'}`, 14, 100);
  doc.text(`Company: ${outing.company?.name || 'N/A'}`, 14, 108);
  doc.text(`Grade: ${outing.grade || 'N/A'}`, 14, 116);
  doc.text(`Coffee Type: ${outing.coffeeType || 'CLEAN'}`, 14, 124);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Quantity:`, 14, 132);
  doc.setFont("helvetica", "normal");
  doc.text(`${outing.bags ? outing.bags + ' Bags / ' : ''}${outing.kg} KG`, 40, 132);

  // Transport Info
  doc.setFont("helvetica", "bold");
  doc.text("TRANSPORT DETAILS", 120, 40);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Driver Name: ${outing.driver?.name || 'N/A'}`, 120, 50);
  doc.text(`Driver Phone: ${outing.driver?.phone || 'N/A'}`, 120, 58);
  doc.text(`Plate Number: ${outing.plateNumber || 'N/A'}`, 120, 66);
  
  // Signatures
  doc.line(14, 160, 196, 160);
  
  doc.setFontSize(10);
  doc.text("Prepared By:", 14, 180);
  doc.text("Driver Signature:", 105, 180, { align: "center" });
  doc.text("Approved By:", 196, 180, { align: "right" });
  
  doc.line(14, 195, 60, 195);
  doc.line(80, 195, 130, 195);
  doc.line(150, 195, 196, 195);
  
  doc.setFontSize(9);
  doc.text(`(${outing.releasedBy?.name || 'Warehouse Officer'})`, 37, 200, { align: "center" });
  doc.text(`(${outing.approvedBy || 'Supervisor'})`, 173, 200, { align: "center" });

  doc.save(`Waybill_${outing.dispatchNo}.pdf`);
};
