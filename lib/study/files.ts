import type { Source } from "./model";
export async function readSourceFile(
  file: File,
  onProgress: (s: string) => void,
): Promise<Source> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a file under 20 MB.");
  let pages: Source["pages"];
  if (file.name.toLowerCase().endsWith(".pdf")) {
    onProgress("Opening PDF…");
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const pdf = await task.promise;
    if (pdf.numPages > 300) {
      await task.destroy();
      throw new Error(
        "Choose a PDF with 300 pages or fewer, or split the document.",
      );
    }
    pages = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        onProgress(`Reading page ${n} of ${pdf.numPages}…`);
        const page = await pdf.getPage(n),
          content = await page.getTextContent();
        const text = content.items
          .map((item) =>
            "str" in item
              ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
              : "",
          )
          .join("");
        pages.push({ number: n, text });
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  } else if (/\.(txt|md)$/i.test(file.name)) {
    const text = await file.text();
    pages = text.split("\f").map((text, i) => ({ number: i + 1, text }));
  } else throw new Error("Upload a PDF, TXT, or Markdown file.");
  if (pages.some((p) => p.text.length > 60000))
    throw new Error(
      "A page has more than 60,000 characters. Split it into smaller text sources.",
    );
  if (!pages.some((p) => p.text.trim().length > 30))
    throw new Error(
      "No readable text found. Scanned PDFs need OCR before upload.",
    );
  if (pages.reduce((n, p) => n + p.text.length, 0) > 1500000)
    throw new Error(
      "This source has too much text. Split it into smaller documents.",
    );
  return {
    id: crypto.randomUUID(),
    title: file.name,
    pages,
    range: "",
    use: "both",
  };
}
