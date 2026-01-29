import { RenderParameters } from "pdfjs-dist/types/src/display/api";

function autocropCanvas(
  sourceCanvas: HTMLCanvasElement,
  config: { tolerance?: number; padding?: number },
): HTMLCanvasElement | null {
  const { tolerance = 25, padding = 10 } = config;

  const SCOUT_MAX_DIM = 400;
  let analysisCanvas: HTMLCanvasElement = sourceCanvas;
  const needsScout =
    sourceCanvas.width > SCOUT_MAX_DIM || sourceCanvas.height > SCOUT_MAX_DIM;

  if (needsScout) {
    const scoutCanvas = document.createElement("canvas");
    const aspectRatio = sourceCanvas.width / sourceCanvas.height;
    if (aspectRatio > 1) {
      scoutCanvas.width = SCOUT_MAX_DIM;
      scoutCanvas.height = SCOUT_MAX_DIM / aspectRatio;
    } else {
      scoutCanvas.height = SCOUT_MAX_DIM;
      scoutCanvas.width = SCOUT_MAX_DIM * aspectRatio;
    }
    const scoutCtx = scoutCanvas.getContext("2d");
    scoutCtx?.drawImage(
      sourceCanvas,
      0,
      0,
      scoutCanvas.width,
      scoutCanvas.height,
    );
    analysisCanvas = scoutCanvas;
  }

  const ctx = analysisCanvas.getContext("2d");
  if (!ctx) return null;

  const { width, height } = analysisCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const getPixel = (x: number, y: number) => {
    const i = (Math.round(y) * width + Math.round(x)) * 4;
    return `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
  };

  const samples: Record<string, number> = {};
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [width / 2, 0],
    [0, height / 2],
    [width / 2, height - 1],
    [width - 1, height / 2],
  ];

  for (const [x, y] of samplePoints) {
    const color = getPixel(x, y);
    samples[color] = (samples[color] || 0) + 1;
  }

  const [bgColorStr] = Object.entries(samples).sort(([, a], [, b]) => b - a)[0];
  const bg = bgColorStr.split(",").map(Number);

  let top = height,
    bottom = -1,
    left = width,
    right = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];

      if (alpha < 20) continue;

      const distance =
        Math.abs(data[i] - bg[0]) +
        Math.abs(data[i + 1] - bg[1]) +
        Math.abs(data[i + 2] - bg[2]);

      if (distance > tolerance) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (bottom === -1 || right === -1) {
    return null;
  }

  const scaleX = sourceCanvas.width / width;
  const scaleY = sourceCanvas.height / height;

  const finalX = Math.round(Math.max(0, left - padding) * scaleX);
  const finalY = Math.round(Math.max(0, top - padding) * scaleY);

  const finalWidth = Math.round(
    Math.min(
      sourceCanvas.width - finalX,
      (right - left + 1 + padding * 2) * scaleX,
    ),
  );
  const finalHeight = Math.round(
    Math.min(
      sourceCanvas.height - finalY,
      (bottom - top + 1 + padding * 2) * scaleY,
    ),
  );

  if (finalWidth <= 0 || finalHeight <= 0) {
    return null;
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = finalWidth;
  outputCanvas.height = finalHeight;
  const outputCtx = outputCanvas.getContext("2d");

  outputCtx?.drawImage(
    sourceCanvas,
    finalX,
    finalY,
    finalWidth,
    finalHeight,
    0,
    0,
    finalWidth,
    finalHeight,
  );

  return outputCanvas;
}

/**
 * Converts a PDF file into a stream of image files, yielding one at a time.
 * This approach is memory-efficient for large PDFs.
 * @param file The PDF file to convert.
 * @returns An async generator that yields a File object for each page.
 */
export async function* convertPdfToImages(
  file: File,
): AsyncGenerator<{ pageFile: File; pageNumber: number; totalPages: number }> {
  const logPrefix = `[PDF-Utils]`;
  console.log(logPrefix, `Loading pdf.js library...`);
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
  console.log(logPrefix, `pdf.js worker source set.`);

  const arrayBuffer = await file.arrayBuffer();

  let pdf;
  try {
    console.log(logPrefix, `Parsing PDF "${file.name}"...`);
    pdf = await getDocument({ data: arrayBuffer }).promise;
    console.log(
      logPrefix,
      `Successfully parsed PDF. Total pages: ${pdf.numPages}`,
    );
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(logPrefix, `Failed to parse PDF:`, e);
    throw new Error(
      `Failed to parse PDF. It may be corrupt or password-protected. Error: ${errorMsg}`,
    );
  }

  if (pdf.numPages === 0) {
    throw new Error("PDF file contains no pages.");
  }
  if (pdf.numPages > 50) {
    throw new Error(
      `PDF exceeds the 50-page limit (has ${pdf.numPages} pages).`,
    );
  }

  for (let i = 1; i <= pdf.numPages; i++) {
    console.log(logPrefix, `Processing page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const MAX_DIMENSION = 1024;
    const viewportDefault = page.getViewport({ scale: 1.0 });
    const scale = Math.min(
      MAX_DIMENSION / viewportDefault.width,
      MAX_DIMENSION / viewportDefault.height,
      2.0,
    );
    const viewport = page.getViewport({ scale });
    console.log(
      logPrefix,
      `Page ${i}: Viewport created with scale ${scale.toFixed(2)} (${viewport.width}x${viewport.height}).`,
    );

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const canvasContext = canvas.getContext("2d");

    if (canvasContext) {
      console.log(logPrefix, `Page ${i}: Rendering to canvas...`);

      const renderContext: RenderParameters = {
        canvasContext,
        viewport,
        canvas,
      };

      await page.render(renderContext).promise;
      console.log(logPrefix, `Page ${i}: Render complete.`);

      console.log(logPrefix, `Page ${i}: Autocropping canvas...`);
      const croppedCanvas = autocropCanvas(canvas, { padding: 15 });
      const finalCanvas = croppedCanvas || canvas;
      console.log(
        logPrefix,
        `Page ${i}: Cropping complete. Final canvas size: ${finalCanvas.width}x${finalCanvas.height}.`,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        finalCanvas.toBlob(resolve, "image/png", 0.9),
      );
      console.log(
        logPrefix,
        `Page ${i}: Converted canvas to PNG blob of size ${(blob?.size ?? 0).toLocaleString()} bytes.`,
      );

      if (blob) {
        const pageFile = new File([blob], `page_${i}.png`, {
          type: "image/png",
        });
        yield { pageFile, pageNumber: i, totalPages: pdf.numPages };
      }
    }
  }
}
