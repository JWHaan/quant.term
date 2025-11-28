/**
 * Export chart element to PNG image
 * @param elementId DOM ID of the element to export
 * @param filename Output filename
 */
export const exportChartToPNG = (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // This is a simplified implementation. 
    // In a real app, we might use html2canvas or similar library.
    // For SVG charts (D3), we can serialize the SVG.

    if (element.tagName === 'svg') {
        const svgData = new XMLSerializer().serializeToString(element);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = function () {
            canvas.width = element.clientWidth;
            canvas.height = element.clientHeight;
            ctx?.drawImage(img, 0, 0);
            const pngUrl = canvas.toDataURL("image/png");
            downloadLink(pngUrl, filename);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
};

/**
 * Export data array to CSV file
 * @param data Array of objects or arrays
 * @param filename Output filename
 */
export const exportDataToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";

    // Header
    if (Array.isArray(data[0])) {
        // Array of arrays
        data.forEach(row => {
            csvContent += row.join(",") + "\r\n";
        });
    } else {
        // Array of objects
        const headers = Object.keys(data[0]);
        csvContent += headers.join(",") + "\r\n";
        data.forEach(row => {
            const rowStr = headers.map(header => JSON.stringify(row[header])).join(",");
            csvContent += rowStr + "\r\n";
        });
    }

    const encodedUri = encodeURI(csvContent);
    downloadLink(encodedUri, filename);
};

const downloadLink = (uri: string, filename: string) => {
    const link = document.createElement("a");
    link.setAttribute("href", uri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
