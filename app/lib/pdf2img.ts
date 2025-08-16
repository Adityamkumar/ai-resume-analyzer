export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

/**
 * Convert the first page of a PDF file into a PNG image.
 * This function only runs in the browser — safe from SSR/Node errors.
 */
export async function convertPdfToImage(file: File): Promise<PdfConversionResult> {
    // 🛡 Prevent SSR execution
    if (typeof window === "undefined" || typeof document === "undefined") {
        return {
            imageUrl: "",
            file: null,
            error: "PDF conversion must run in the browser (DOM APIs not available).",
        };
    }

    try {
        // 📦 Import pdfjs-dist dynamically (browser only)
        const pdfjsLib = await import("pdfjs-dist");
        const pdfWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

        // Load PDF into memory
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Get first page
        const page = await pdf.getPage(1);

        // High-quality scaling factor
        const scale = 3;
        const viewport = page.getViewport({ scale });

        // Prepare canvas
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Failed to get 2D canvas context");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // ✅ Render only in browser (DOMMatrix is available)
        await page.render({ canvasContext: context, viewport });

        // Convert to PNG
        return new Promise<PdfConversionResult>((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const baseName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${baseName}.png`, {
                            type: "image/png",
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                1.0
            );
        });
    } catch (err: any) {
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err.message || err}`,
        };
    }
}
