import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { image, escala, aprendizaje } = await req.json();

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

    // Contexto de calibración: errores de casos previos validados por especialistas
    const casos = Array.isArray(aprendizaje) ? aprendizaje.slice(0, 10) : [];
    const aprendizajeContexto = casos.length
      ? "\nCALIBRACIÓN CON CASOS PREVIOS VALIDADOS POR ESPECIALISTAS (IA vs valor real):\n" +
        casos
          .map(
            (c: any, i: number) =>
              `${i + 1}. RMD ia=${c?.ia?.rmd} real=${c?.real?.rmd} | JPS ia=${c?.ia?.jps} real=${c?.real?.jps} | JPO ia=${c?.ia?.jpo} real=${c?.real?.jpo}` +
              (c?.observacion ? ` | Obs: ${String(c.observacion).slice(0, 200)}` : "")
          )
          .join("\n") +
        "\nSi observas un sesgo sistemático en estos casos (p. ej. la IA sobreestima RMD), corrígelo en tu estimación."
      : "";

    const escalaContexto = escala
      ? `\nESCALA DE LA IMAGEN: 1 píxel = ${escala.cmPorPixel.toFixed(4)} cm. Referencia: pelota de ${escala.diametroCm} cm de diámetro medida en ${Math.round(escala.diametroPx)} píxeles en la imagen. USA ESTA ESCALA para estimar distancias reales entre fracturas (JPS) y tamaño de bloques (RMD) en metros.`
      : "\nNOTA: No hay escala de referencia disponible. Estima los valores basándote en proporciones visuales relativas.";

    const systemPrompt = `Eres un ingeniero geotécnico experto en Cartilla Lilly. Analiza SOLO visualmente la imagen del macizo rocoso y devuelve ÚNICAMENTE un JSON válido sin texto adicional, sin bloques de código markdown, sin explicaciones previas ni posteriores.
${escalaContexto}${aprendizajeContexto}

El JSON debe tener exactamente estas claves:

- rmd: número entero entre 10 y 50. Representa la descripción del macizo rocoso.
  IMPORTANTE: Puedes usar CUALQUIER valor entero entre 10 y 50, no solo múltiplos de 10.
  Rangos de referencia:
  - 10 a 19: Poco consolidado o muy fracturado
  - 20 a 29: Diaclasado en bloques pequeños (~0.5m)
  - 30 a 39: Diaclasado en bloques medianos (~1.0m)
  - 40 a 49: Diaclasado en bloques grandes (>1m)
  - 50: Masivo
  Usa el valor exacto que mejor represente lo que ves. Ejemplos válidos: 12, 17, 23, 28, 31, 37, 42, 46, 50.

- jps: número entero entre 10 y 50. Representa el espaciamiento entre fracturas.
  IMPORTANTE: Puedes usar CUALQUIER valor entero entre 10 y 50, no solo múltiplos de 10.
  Rangos de referencia:
  - 10 a 19: Espaciamiento pequeño (<0.1m), fracturas muy juntas
  - 20 a 39: Espaciamiento intermedio (0.1m a 1.0m)
  - 40 a 50: Espaciamiento grande (>1.0m), fracturas muy separadas
  Usa el valor exacto que mejor represente lo que ves. Ejemplos válidos: 12, 18, 24, 29, 33, 38, 43, 48.

- jpo: número entero entre 10 y 40. Representa la orientación de los planos de fractura respecto a la cara de voladura.
  IMPORTANTE: Puedes usar CUALQUIER valor entero entre 10 y 40, no solo múltiplos de 10.
  Rangos de referencia:
  - 10 a 14: Claramente horizontal
  - 15 a 24: Manteo predominante hacia la cara
  - 25 a 34: Rumbo predominante normal a la cara
  - 35 a 40: Manteo predominante contra la cara
  Usa el valor exacto que mejor represente lo que ves. Ejemplos válidos: 11, 16, 22, 27, 33, 38.

- confianza: "Alta" si la imagen es clara y los rasgos son bien visibles, "Media" si hay incertidumbre moderada, "Baja" si la imagen es poco clara o ambigua.
- justificacion_rmd: string corto en español explicando qué características visuales justifican el valor estimado de RMD y por qué elegiste ese valor específico dentro del rango.
- justificacion_jps: string corto en español explicando qué características visuales justifican el valor estimado de JPS y por qué elegiste ese valor específico dentro del rango.
- justificacion_jpo: string corto en español explicando qué características visuales justifican el valor estimado de JPO y por qué elegiste ese valor específico dentro del rango.
- observacion_tecnica: string descriptivo en español con observaciones generales del macizo rocoso.

No inventes ni estimes SG, RCU, RQD, FF ni presencia de agua.
RECUERDA: Los valores deben ser enteros precisos que reflejen tu mejor estimación visual, no simplemente los valores ancla del sistema (10, 20, 30, 40, 50).`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
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
              text: "Evalúa visualmente esta fotografía de macizo rocoso para Cartilla Lilly. Devuelve SOLO el JSON solicitado con valores enteros precisos dentro de los rangos indicados.",
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

    // Valida y limita los rangos de la Cartilla Lilly antes de responder
    const clamp = (v: unknown, min: number, max: number) =>
      Math.min(max, Math.max(min, Math.round(Number(v) || min)));
    parsed.rmd = clamp(parsed.rmd, 10, 50);
    parsed.jps = clamp(parsed.jps, 10, 50);
    parsed.jpo = clamp(parsed.jpo, 10, 40);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("ERROR ANTHROPIC:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}