import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json({ error: "job_id requerido" }, { status: 400 });
  }

  // Anthropic fine-tuning está en acceso anticipado
  // Este endpoint retorna estado informativo
  return NextResponse.json({
    ok: true,
    job_id: jobId,
    status: "pending_anthropic_access",
    message: "Anthropic fine-tuning disponible en acceso anticipado. Visita https://www.anthropic.com/fine-tuning para solicitar acceso.",
    fine_tuned_model: null,
  });
}