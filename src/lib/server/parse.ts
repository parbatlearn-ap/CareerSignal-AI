/**
 * Document parsing for uploads. Files are parsed in memory and discarded;
 * only the extracted text is returned (and stored only if the user saves it).
 */
import { UPLOAD_EXTENSIONS, UPLOAD_MAX_BYTES } from "../config";

export class ParseError extends Error {}

export async function parseDocument(name: string, buf: Buffer): Promise<{ text: string; warnings: string[] }> {
  const lower = name.toLowerCase();
  const ext = UPLOAD_EXTENSIONS.find((e) => lower.endsWith(e));
  if (!ext) throw new ParseError("Unsupported file type. Upload a PDF, DOCX or TXT file, or paste the text.");
  if (buf.length === 0) throw new ParseError("The file is empty.");
  if (buf.length > UPLOAD_MAX_BYTES) throw new ParseError(`File is larger than ${UPLOAD_MAX_BYTES / 1024 / 1024} MB.`);
  const warnings: string[] = [];
  let text = "";

  if (ext === ".txt") {
    text = buf.toString("utf8");
  } else if (ext === ".pdf") {
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new ParseError("This does not look like a valid PDF file.");
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const res = await extractText(pdf, { mergePages: true });
      text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
    } catch (e) {
      throw new ParseError(`Could not read the PDF (${(e as Error).message}). Try exporting it again or paste the text.`);
    }
    if (text.trim().length < 50) warnings.push("Very little text was found - the PDF may be scanned images. Paste the text instead if it looks incomplete.");
  } else if (ext === ".docx") {
    if (buf.subarray(0, 2).toString("latin1") !== "PK") throw new ParseError("This does not look like a valid DOCX file.");
    try {
      const mammoth = await import("mammoth");
      const res = await mammoth.extractRawText({ buffer: buf });
      text = res.value;
      if (res.messages.length) warnings.push(`${res.messages.length} formatting element(s) could not be read.`);
    } catch (e) {
      throw new ParseError(`Could not read the DOCX (${(e as Error).message}). Paste the text instead.`);
    }
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new ParseError("No text could be extracted. Paste the text instead.");
  if (text.length > 60000) {
    text = text.slice(0, 60000);
    warnings.push("Text was truncated to 60,000 characters.");
  }
  warnings.push("Please review the extracted text below and correct anything that was read incorrectly.");
  return { text, warnings };
}
