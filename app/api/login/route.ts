import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

// Cliente de servidor. Usa la SERVICE ROLE KEY (nunca expuesta al navegador).
// Requiere en .env.local:  SUPABASE_SERVICE_ROLE_KEY=...
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const hashPin = (pin: string) => createHash("sha256").update(pin).digest("hex");

const igualSeguro = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export async function POST(req: NextRequest) {
  try {
    const { nombre, pin } = await req.json();

    if (!nombre?.trim() || !pin?.trim()) {
      return NextResponse.json({ error: "Ingresa tu nombre y PIN" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      return NextResponse.json({ error: "El PIN debe ser de 4 dígitos" }, { status: 400 });
    }

    const nombreLimpio = nombre.trim();
    const pinHasheado = hashPin(pin.trim());

    const { data, error } = await supabase
      .from("evaluadores")
      .select("id, nombre, pin")
      .eq("nombre", nombreLimpio)
      .single();

    // No existe → crear cuenta con PIN hasheado
    if (error && error.code === "PGRST116") {
      const { data: nuevo, error: errCreate } = await supabase
        .from("evaluadores")
        .insert({ nombre: nombreLimpio, pin: pinHasheado })
        .select("id, nombre")
        .single();
      if (errCreate) throw errCreate;
      return NextResponse.json({ evaluador: nuevo });
    }
    if (error) throw error;

    // Existe → verificar PIN.
    // Compatibilidad: si el PIN guardado aún está en texto plano (cuentas
    // antiguas), se compara directo y se migra a hash en el mismo login.
    const esHash = /^[a-f0-9]{64}$/.test(data.pin);
    const coincide = esHash
      ? igualSeguro(data.pin, pinHasheado)
      : data.pin === pin.trim();

    if (!coincide) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    if (!esHash) {
      await supabase.from("evaluadores").update({ pin: pinHasheado }).eq("id", data.id);
    }

    // Nunca devolver el PIN (ni hasheado) al cliente
    return NextResponse.json({ evaluador: { id: data.id, nombre: data.nombre } });
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
