import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Converts any CSS color (including modern Tailwind v4 oklch/color-mix) to standard RGB/Hex
 * using an offscreen Canvas 2D context.
 */
function convertOklchColor(colorStr: string): string {
  if (!colorStr || colorStr === "transparent" || colorStr === "rgba(0, 0, 0, 0)") {
    return "transparent";
  }
  if (colorStr.startsWith("#") || (colorStr.startsWith("rgb") && !colorStr.includes("oklch"))) {
    return colorStr;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillStyle = colorStr;
      const res = ctx.fillStyle;
      if (res && res !== "#000000" && !res.includes("oklch")) {
        return res;
      }
    }
  } catch (e) {
    // fallback
  }
  return "#334155";
}

/**
 * Sanitizes CSS text to replace oklch and color-mix values that break html2canvas stylesheet parser.
 */
function sanitizeCssText(cssText: string): string {
  return cssText
    .replace(/oklch\([^)]+\)/gi, (match) => convertOklchColor(match))
    .replace(/color-mix\([^)]+\)/gi, "#334155");
}

export interface PDFExportOptions {
  filename?: string;
  width?: number;
  scale?: number;
}

/**
 * High-resolution pixel-perfect PDF export engine for HTML elements.
 * Preserves all styles, fonts, colors, borders, images, tables, and multi-page layout.
 */
export async function downloadDocumentPDF(
  targetElement: HTMLElement,
  filename: string = "ERP_Document.pdf",
  options: PDFExportOptions = {}
): Promise<void> {
  if (!targetElement) {
    console.error("PDF Export: Target element is null or undefined.");
    return;
  }

  const element = targetElement;

  // Temporarily hide elements marked with .no-print
  const noPrintElements = element.querySelectorAll(".no-print");
  noPrintElements.forEach((el) => {
    (el as HTMLElement).style.setProperty("display", "none", "important");
  });

  // Save original style overrides
  const originalOverflow = element.style.overflow;
  const originalHeight = element.style.height;
  const originalMaxHeight = element.style.maxHeight;
  const originalShadow = element.style.boxShadow;
  const originalBorder = element.style.border;
  const originalRadius = element.style.borderRadius;
  const originalPadding = element.style.padding;
  const originalWidth = element.style.width;

  // Set explicit dimensions for high-resolution A4 capture
  const targetWidth = options.width || 900;
  element.style.overflow = "visible";
  element.style.height = "auto";
  element.style.maxHeight = "none";
  element.style.boxShadow = "none";
  element.style.border = "none";
  element.style.borderRadius = "0";
  element.style.padding = "16px";
  element.style.width = `${targetWidth}px`;

  try {
    // Render HTML element to high-DPI canvas using html2canvas-pro
    const canvas = await html2canvas(element, {
      scale: options.scale || 2.5, // 2.5x scale for ultra-crisp 300 DPI text, tables & borders
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: targetWidth + 40,
      windowHeight: Math.max(element.scrollHeight, 1200),
      onclone: (clonedDoc) => {
        // Sanitize all <style> elements in cloned document so html2canvas doesn't discard stylesheets
        const styleSheets = clonedDoc.querySelectorAll("style");
        styleSheets.forEach((styleTag) => {
          if (styleTag.textContent) {
            styleTag.textContent = sanitizeCssText(styleTag.textContent);
          }
        });

        // Map live element computed styles safely without overwriting valid backgrounds or table cells
        const liveNodes = element.querySelectorAll("*");
        const clonedArea = clonedDoc.querySelector(".printable-area") || clonedDoc.body;
        const clonedNodes = clonedArea.querySelectorAll("*");

        liveNodes.forEach((liveEl, index) => {
          const clonedEl = clonedNodes[index] as HTMLElement;
          if (liveEl && clonedEl && clonedEl.style) {
            const comp = window.getComputedStyle(liveEl);

            const bg = comp.backgroundColor;
            if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
              clonedEl.style.backgroundColor = convertOklchColor(bg);
            }

            if (comp.color) {
              clonedEl.style.color = convertOklchColor(comp.color);
            }
          }
        });
      },
    });

    // Restore original DOM element styles immediately after canvas creation
    element.style.overflow = originalOverflow;
    element.style.height = originalHeight;
    element.style.maxHeight = originalMaxHeight;
    element.style.boxShadow = originalShadow;
    element.style.border = originalBorder;
    element.style.borderRadius = originalRadius;
    element.style.padding = originalPadding;
    element.style.width = originalWidth;
    noPrintElements.forEach((el) => {
      (el as HTMLElement).style.display = "";
    });

    const imgData = canvas.toDataURL("image/png", 1.0);

    // Create jsPDF instance (A4 Portrait format)
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm

    // Compute scaled image height in mm preserving aspect ratio
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight <= pdfHeight) {
      // Single page document
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight, undefined, "FAST");
    } else {
      // Multi-page document handling
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight, undefined, "FAST");
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight, undefined, "FAST");
        heightLeft -= pdfHeight;
      }
    }

    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } catch (error) {
    console.error("PDF generation failed:", error);
    // Restore element styles on error
    element.style.overflow = originalOverflow;
    element.style.height = originalHeight;
    element.style.maxHeight = originalMaxHeight;
    element.style.boxShadow = originalShadow;
    element.style.border = originalBorder;
    element.style.borderRadius = originalRadius;
    element.style.padding = originalPadding;
    element.style.width = originalWidth;
    noPrintElements.forEach((el) => {
      (el as HTMLElement).style.display = "";
    });

    // Fallback to native window.print()
    window.print();
  }
}

/**
 * Standard trigger for native browser printing.
 */
export function printDocument(): void {
  window.print();
}
