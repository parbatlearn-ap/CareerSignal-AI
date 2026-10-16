import { ParseError, parseDocument } from "@/lib/server/parse";
import { errorResponse, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Extract text from an uploaded PDF/DOCX/TXT. The file is not stored. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "No file uploaded." }, 400);
    const result = await parseDocument(file.name, Buffer.from(await file.arrayBuffer()));
    return json({ ...result, fileName: file.name });
  } catch (e) {
    if (e instanceof ParseError) return json({ error: e.message }, 422);
    return errorResponse(e);
  }
}
