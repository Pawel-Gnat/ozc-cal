import type { PDFDocumentProxy } from "pdfjs-dist";

export interface RenderedPageDimensions {
  width: number;
  height: number;
}

export async function renderPageToCanvas(
  pdfDocument: PDFDocumentProxy,
  canvas: HTMLCanvasElement,
  scale = 1,
): Promise<RenderedPageDimensions> {
  const page = await pdfDocument.getPage(1);
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get 2D canvas context");
  }

  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

  await page.render({
    canvasContext: context,
    viewport,
    transform,
  }).promise;

  return {
    width: viewport.width,
    height: viewport.height,
  };
}
