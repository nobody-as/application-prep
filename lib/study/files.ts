import type { Source } from "./model";

type Page = Source["pages"][number];
type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

const TEXT_CHUNK = 50_000;
const textExtensions = new Set(
  [
    "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "ndjson", "yaml", "yml", "toml",
    "ini", "cfg", "conf", "log", "sql", "py", "pyw", "js", "jsx", "mjs", "cjs", "ts", "tsx",
    "java", "c", "h", "cc", "cpp", "cxx", "hpp", "cs", "go", "rs", "rb", "php", "swift", "kt",
    "kts", "scala", "sh", "bash", "zsh", "fish", "ps1", "r", "m", "mm", "tex", "bib", "srt",
    "vtt", "ass", "css", "scss", "sass", "less", "env", "properties", "gradle", "dockerfile", "makefile",
    "ics", "vcf", "eml", "msg", "diff", "patch", "rst", "adoc", "org",
  ],
);
const markupExtensions = new Set(["html", "htm", "xhtml", "xml", "svg"]);
const imageExtensions = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "avif", "heic", "heif",
]);
const officeZipExtensions = new Set([
  "docx", "docm", "dotx", "dotm", "pptx", "pptm", "potx", "potm", "ppsx", "ppsm",
  "xlsx", "xlsm", "xltx", "xltm", "odt", "ods", "odp", "epub",
]);

function extension(name: string) {
  const base = name.toLowerCase().split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1) : base;
}

function addChunkedText(pages: Page[], text: string, startNumber = pages.length + 1) {
  let number = startNumber;
  for (const section of text.split("\f")) {
    if (!section.length) continue;
    let offset = 0;
    while (offset < section.length) {
      let end = Math.min(section.length, offset + TEXT_CHUNK);
      if (end < section.length) {
        const breakAt = Math.max(section.lastIndexOf("\n", end), section.lastIndexOf(" ", end));
        if (breakAt > offset + TEXT_CHUNK / 2) end = breakAt + 1;
      }
      pages.push({ number: number++, text: section.slice(offset, end) });
      offset = end;
    }
  }
  return pages;
}

export function textToPages(text: string): Source["pages"] {
  const pages: Page[] = [];
  addChunkedText(pages, text, 1);
  return pages.length ? pages : [{ number: 1, text: "" }];
}

function markupToText(input: string) {
  const doc = new DOMParser().parseFromString(input, "text/html");
  doc.querySelectorAll("script,style,noscript,svg defs").forEach((node) => node.remove());
  doc
    .querySelectorAll("p,div,li,tr,br,h1,h2,h3,h4,h5,h6,pre,blockquote,section,article")
    .forEach((node) => node.appendChild(doc.createTextNode("\n")));
  return (doc.body?.textContent || doc.documentElement.textContent || "")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function xmlToText(input: string) {
  const spaced = input
    .replace(/<w:tab\s*\/>/gi, "\t")
    .replace(/<w:br\s*\/>/gi, "\n")
    .replace(/<a:br\s*\/>/gi, "\n")
    .replace(/<text:tab\s*\/>/gi, "\t")
    .replace(/<\/(?:w:p|a:p|text:p|text:h|table:table-row|p|li|h[1-6])>/gi, "$&\n");
  const doc = new DOMParser().parseFromString(spaced, "application/xml");
  if (doc.querySelector("parsererror")) return markupToText(input);
  return (doc.documentElement.textContent || "")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function rtfToText(input: string) {
  return input
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readableRuns(input: string) {
  return (input.match(/[\p{L}\p{N}\p{P}\p{Zs}\t\r\n]{4,}/gu) || [])
    .join("\n")
    .replace(/\uFFFD/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readabilityScore(input: string) {
  const words = input.match(/[A-Za-z0-9][A-Za-z0-9'_\-]{2,}/g)?.length || 0;
  const lines = input.split("\n").filter((line) => line.trim().length > 8).length;
  return words * 10 + lines * 3;
}

async function binaryText(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const candidates = [readableRuns(new TextDecoder("utf-8").decode(bytes))];
  if (bytes.byteLength >= 4) {
    candidates.push(readableRuns(new TextDecoder("utf-16le").decode(bytes)));
    const swapped = bytes.slice();
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const a = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = a;
    }
    candidates.push(readableRuns(new TextDecoder("utf-16le").decode(swapped)));
  }
  return candidates.sort((a, b) => readabilityScore(b) - readabilityScore(a))[0] || "";
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const floor = Math.max(0, bytes.length - 65_557);
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

function zipDirectory(bytes: Uint8Array): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error("This archive could not be opened.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = view.getUint16(eocd + 10, true);
  let position = view.getUint32(eocd + 16, true);
  if (total === 0xffff || position === 0xffffffff)
    throw new Error("This ZIP64 archive is not readable in the current browser parser.");
  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  for (let i = 0; i < total; i++) {
    if (view.getUint32(position, true) !== 0x02014b50)
      throw new Error("This archive has an invalid directory.");
    const method = view.getUint16(position + 10, true);
    const compressedSize = view.getUint32(position + 20, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const localOffset = view.getUint32(position + 42, true);
    const name = decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength));
    if (!name.endsWith("/")) entries.push({ name, method, compressedSize, localOffset });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.localOffset, true) !== 0x04034b50)
    throw new Error("This archive contains an invalid file entry.");
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed.slice();
  if (entry.method !== 8)
    throw new Error("This archive uses a compression method the browser cannot read.");
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function sortByEmbeddedNumber(a: ZipEntry, b: ZipEntry) {
  const na = Number(a.name.match(/(\d+)(?=\.[^.]+$)/)?.[1] || 0);
  const nb = Number(b.name.match(/(\d+)(?=\.[^.]+$)/)?.[1] || 0);
  return na - nb || a.name.localeCompare(b.name);
}

async function officeArchivePages(file: File, onProgress: (s: string) => void) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = zipDirectory(bytes);
  const ext = extension(file.name);
  const pages: Page[] = [];
  const decoder = new TextDecoder("utf-8");
  const read = async (entry: ZipEntry) => decoder.decode(await inflateZipEntry(bytes, entry));

  if (["docx", "docm", "dotx", "dotm"].includes(ext)) {
    const wanted = entries.filter((entry) => /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(entry.name));
    wanted.sort((a, b) => (a.name.includes("document.xml") ? -1 : b.name.includes("document.xml") ? 1 : a.name.localeCompare(b.name)));
    for (const entry of wanted) {
      onProgress("Reading " + entry.name + "…");
      addChunkedText(pages, xmlToText(await read(entry)));
    }
    return pages;
  }

  if (["pptx", "pptm", "potx", "potm", "ppsx", "ppsm"].includes(ext)) {
    const slides = entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name)).sort(sortByEmbeddedNumber);
    for (const entry of slides) {
      onProgress("Reading " + entry.name + "…");
      const text = xmlToText(await read(entry));
      pages.push({ number: pages.length + 1, text });
    }
    return pages;
  }

  if (["xlsx", "xlsm", "xltx", "xltm"].includes(ext)) {
    const sharedEntry = entries.find((entry) => /xl\/sharedStrings\.xml$/i.test(entry.name));
    const shared: string[] = [];
    if (sharedEntry) {
      const doc = new DOMParser().parseFromString(await read(sharedEntry), "application/xml");
      doc.querySelectorAll("si").forEach((node) => {
        shared.push(Array.from(node.querySelectorAll("t")).map((t) => t.textContent || "").join(""));
      });
    }
    const sheets = entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)).sort(sortByEmbeddedNumber);
    for (const entry of sheets) {
      onProgress("Reading " + entry.name + "…");
      const doc = new DOMParser().parseFromString(await read(entry), "application/xml");
      const rows: string[] = [];
      doc.querySelectorAll("row").forEach((row) => {
        const cells: string[] = [];
        row.querySelectorAll("c").forEach((cell) => {
          const kind = cell.getAttribute("t");
          let value = cell.querySelector("v")?.textContent || "";
          if (kind === "s") value = shared[Number(value)] || value;
          if (kind === "inlineStr") value = Array.from(cell.querySelectorAll("t")).map((t) => t.textContent || "").join("");
          cells.push(value);
        });
        rows.push(cells.join("\t"));
      });
      addChunkedText(pages, rows.join("\n"));
    }
    return pages;
  }

  if (["odt", "ods", "odp"].includes(ext)) {
    const contentEntry = entries.find((entry) => entry.name === "content.xml");
    if (contentEntry) addChunkedText(pages, xmlToText(await read(contentEntry)));
    return pages;
  }

  if (ext === "epub") {
    const docs = entries.filter((entry) => /\.(?:xhtml|html|htm)$/i.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of docs) {
      onProgress("Reading " + entry.name + "…");
      addChunkedText(pages, markupToText(await read(entry)));
    }
    return pages;
  }

  return pages;
}

async function genericArchivePages(file: File, onProgress: (s: string) => void) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = zipDirectory(bytes);
  const pages: Page[] = [];
  for (const entry of entries) {
    onProgress("Reading " + entry.name + "…");
    try {
      const data = await inflateZipEntry(bytes, entry);
      const nested = new File([data], entry.name);
      const extracted = await extractPages(nested, onProgress);
      for (const page of extracted) {
        pages.push({
          number: pages.length + 1,
          text: "FILE: " + entry.name + "\n\n" + page.text,
        });
      }
    } catch {
      // Unsupported binary members are skipped; readable members continue.
    }
  }
  return pages;
}

async function ocrImage(file: Blob) {
  const Detector = (globalThis as unknown as { TextDetector?: new () => { detect: (input: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).TextDetector;
  if (!Detector) return "";
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const blocks = await new Detector().detect(bitmap);
      return blocks.map((block) => block.rawValue || "").filter(Boolean).join("\n");
    } finally {
      bitmap.close();
    }
  } catch {
    return "";
  }
}

async function pdfPages(file: File, onProgress: (s: string) => void) {
  onProgress("Opening PDF…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const pages: Page[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress("Reading page " + n + " of " + pdf.numPages + "…");
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = content.items
        .map((item) =>
          "str" in item ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ") : "",
        )
        .join("");
      if (text.trim().length < 30) {
        const Detector = (globalThis as unknown as { TextDetector?: unknown }).TextDetector;
        if (Detector) {
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (context) {
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (blob) text = (await ocrImage(blob)).trim() || text;
          }
        }
      }
      pages.push({ number: n, text });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

async function extractPages(file: File, onProgress: (s: string) => void): Promise<Page[]> {
  const ext = extension(file.name);
  const type = file.type.toLowerCase();

  if (ext === "pdf" || type === "application/pdf") return pdfPages(file, onProgress);
  if (officeZipExtensions.has(ext)) return officeArchivePages(file, onProgress);

  if (markupExtensions.has(ext) || /(?:html|xml|svg)/.test(type)) {
    const text = ext === "xml" || type.includes("xml") ? xmlToText(await file.text()) : markupToText(await file.text());
    return textToPages(text);
  }
  if (ext === "rtf" || type === "application/rtf" || type === "text/rtf") return textToPages(rtfToText(await file.text()));
  if (textExtensions.has(ext) || type.startsWith("text/")) return textToPages(await file.text());

  if (imageExtensions.has(ext) || type.startsWith("image/")) {
    onProgress("Reading text from image…");
    const text = await ocrImage(file);
    return text.trim() ? textToPages(text) : [];
  }

  if (type.startsWith("audio/") || type.startsWith("video/")) return [];

  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (signature[0] === 0x50 && signature[1] === 0x4b) return genericArchivePages(file, onProgress);
  if (signature[0] === 0x1f && signature[1] === 0x8b) {
    onProgress("Decompressing file…");
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
    const data = await new Response(stream).arrayBuffer();
    const nestedName = file.name.replace(/\.gz$/i, "") || "decompressed-file";
    return extractPages(new File([data], nestedName), onProgress);
  }

  onProgress("Looking for readable text…");
  const recovered = await binaryText(file);
  return recovered ? textToPages(recovered) : [];
}

export async function readSourceFile(
  file: File,
  onProgress: (s: string) => void,
): Promise<Source> {
  onProgress("Reading " + file.name + "…");
  const pages = await extractPages(file, onProgress);
  if (!pages.some((page) => page.text.trim().length > 30))
    throw new Error(
      "No readable text could be extracted from " + file.name + ". The file is accepted, but this browser could not recover study text from its contents.",
    );
  return {
    id: crypto.randomUUID(),
    title: file.name,
    pages,
    range: "",
    use: "both",
  };
}
