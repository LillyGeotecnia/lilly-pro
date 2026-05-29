import { NextRequest, NextResponse } from "next/server";

// Nota: Anthropic no tiene fine-tuning público vía API todavía.
// Este endpoint descarga el JSONL para que puedas enviarlo manualmente
// cuando el programa esté disponible: https://www.anthropic.com/fine-tuning

export async function POST(req: NextRequest) {
  try {
    const { jsonl, suffix } = await req.json();

    if (!jsonl) {
      return NextResponse.json({ ok: false, error: "No se recibió JSONL" }, { status: 400 });
    }

    // Por ahora retornamos instrucciones — el fine-tuning de Anthropic
    // está en acceso limitado. El JSONL generado es compatible con el formato
    // que Anthropic requiere cuando esté disponible.
    return NextResponse.json({
      ok: true,
      message: `JSONL listo para fine-tuning (${suffix}). Anthropic fine-tuning está en acceso anticipado. Envía el archivo JSONL descargado a: https://www.anthropic.com/fine-tuning`,
      status: "pending_anthropic_access",
      fine_tuned_model: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}