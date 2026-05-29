import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });
    }

    const mimeMatch = image.match(/data:([^;]+);/);
    const mediaType = (mimeMatch?.[1] ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    const base64Data = image.split(",")[1];

    if (!base64Data) {
      return NextResponse.json({ error: "Formato de imagen inválido" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Eres un ingeniero geotécnico experto en Cartilla Lilly.
Analiza SOLO visualmente la imagen del macizo rocoso y devuelve ÚNICAMENTE un JSON válido,
sin texto adicional, sin bloques de código markdown, sin explicaciones.

El JSON debe tener exactamente estas claves:
- rmd: número entero
- jps: número entero
- jpo: número entero
- confianza: "Alta", "Media" o "Baja"
- justificacion_rmd: string corto en español
- justificacion_jps: string corto en español
- justificacion_jpo: string corto en español
- observacion_tecnica: string descriptivo en español

No inventes SG, RCU, RQD, FF ni agua.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: "Evalúa visualmente esta fotografía de macizo rocoso para Cartilla Lilly. Devuelve SOLO el JSON.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude no devolvió texto");
    }

    const clean = textBlock.text.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON inválido: " + clean.slice(0, 200));
      parsed = JSON.parse(match[0]);
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("ERROR ANTHROPIC:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}