"use client";

import * as XLSX from "xlsx";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pv = (v) => { const n = Number(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const fmt = (n) => n.toFixed(2).replace(".", ",");
const readLS = (key, fallback) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } };
const writeLS = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { } };

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────
const DEFAULT_PREFS = { fontSize: 14, bgColor: "#03070f", accentColor: "#00c8ff" };
const BG_PRESETS = [
  { label: "Negro espacial", value: "#03070f" },
  { label: "Azul marino",    value: "#010b18" },
  { label: "Gris oscuro",    value: "#111418" },
  { label: "Verde militar",  value: "#061208" },
  { label: "Púrpura oscuro", value: "#0d0814" },
];

// ─── ESTILOS GLOBALES ─────────────────────────────────────────────────────────
function buildCSS(prefs) {
  return `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@400;500;600&family=Share+Tech+Mono&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${prefs.bgColor}; color: #c8dff0; font-family: 'Rajdhani', sans-serif; font-size: ${prefs.fontSize}px; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #060d1a; }
::-webkit-scrollbar-thumb { background: #0f3060; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: ${prefs.accentColor}; }
@keyframes fadein { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
@keyframes glow-pulse { 0%,100% { text-shadow:0 0 6px ${prefs.accentColor}88; } 50% { text-shadow:0 0 18px ${prefs.accentColor}cc,0 0 32px ${prefs.accentColor}44; } }
@keyframes corner-glow { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
.lilly-card {
  background: rgba(6,13,26,0.97); border: 1px solid #0f2a45; position: relative;
  padding: 22px; animation: fadein 0.4s ease both;
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
  transition: border-color 0.3s ease;
}
.lilly-card::before {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,200,255,0.012) 2px, rgba(0,200,255,0.012) 4px);
  pointer-events: none; z-index: 0;
}
.lilly-card > * { position: relative; z-index: 1; }
.lilly-card:hover { border-color: ${prefs.accentColor}44; box-shadow: 0 0 24px rgba(0,200,255,0.08), inset 0 0 24px rgba(0,200,255,0.04); }
.lilly-input {
  display: block; width: 100%; margin-top: 8px; padding: 10px 14px;
  background: #03070f; color: #c8dff0; border: 1px solid #0f2a45; outline: none;
  font-family: 'Share Tech Mono', monospace; font-size: ${prefs.fontSize}px; letter-spacing: 0.5px;
  transition: border-color 0.2s, box-shadow 0.2s;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}
.lilly-input:focus { border-color: ${prefs.accentColor}99; box-shadow: 0 0 0 2px rgba(0,200,255,0.12); color: #e8f8ff; }
.lilly-input::placeholder { color: #1e4060; font-family: 'Rajdhani', sans-serif; }
.lilly-btn {
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 10px; margin-right: 8px; padding: 10px 18px;
  color: white; border: 1px solid transparent; cursor: pointer;
  font-family: 'Orbitron', monospace; font-size: ${Math.max(10, prefs.fontSize - 3)}px; font-weight: 600;
  letter-spacing: 1.5px; text-transform: uppercase; transition: all 0.2s ease;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  position: relative; overflow: hidden;
}
.lilly-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%); pointer-events: none; }
.lilly-btn:hover:not(:disabled) { filter: brightness(1.25); transform: translateY(-1px); }
.lilly-btn:active { transform: translateY(0); filter: brightness(0.9); }
.lilly-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
.btn-blue   { background: linear-gradient(135deg, #0050b3, #0080ff); border-color: #0080ff55; }
.btn-green  { background: linear-gradient(135deg, #005c2e, #00a854); border-color: #00a85455; }
.btn-excel  { background: linear-gradient(135deg, #003d1a, #006b2e); border-color: #00a85433; }
.btn-orange { background: linear-gradient(135deg, #7a3200, #e06000); border-color: #e0600055; }
.btn-gray   { background: linear-gradient(135deg, #1a2030, #2a3550); border-color: #3a5070; }
.tab-btn {
  padding: 12px 22px; background: transparent; color: #4a7090;
  border: 1px solid #0f2a45; border-bottom: none; cursor: pointer;
  font-family: 'Orbitron', monospace; font-size: ${Math.max(9, prefs.fontSize - 4)}px; font-weight: 600;
  letter-spacing: 2px; text-transform: uppercase; transition: all 0.2s ease; position: relative;
}
.tab-btn.active { color: ${prefs.accentColor}; background: rgba(0,200,255,0.06); border-color: ${prefs.accentColor}44; text-shadow: 0 0 10px ${prefs.accentColor}aa; }
.tab-btn:hover:not(.active) { color: #7ab8d0; border-color: #0f4060; background: rgba(0,200,255,0.03); }
.tab-btn.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: ${prefs.bgColor}; }
.kpi-card { background: #060d1a; border: 1px solid #0f2a45; padding: 20px; text-align: center; clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px)); transition: all 0.3s ease; animation: fadein 0.5s ease both; }
.kpi-card:hover { border-color: ${prefs.accentColor}55; box-shadow: 0 0 20px rgba(0,200,255,0.1); }
.kpi-highlight { border-color: #e0600055; background: linear-gradient(135deg, #0a0500, #130800); }
.kpi-highlight:hover { border-color: #e06000; box-shadow: 0 0 24px rgba(224,96,0,0.2); }
.section-label { font-family: 'Orbitron', monospace; font-size: ${Math.max(9, prefs.fontSize - 4)}px; letter-spacing: 3px; text-transform: uppercase; color: ${prefs.accentColor}; text-shadow: 0 0 8px ${prefs.accentColor}88; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; animation: glow-pulse 3s ease-in-out infinite; }
.section-label::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, ${prefs.accentColor}44, transparent); }
.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
.blink-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; animation: blink 1.4s ease-in-out infinite; }
.status-row { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(11, prefs.fontSize - 2)}px; color: #4a8faa; letter-spacing: 0.5px; }
.status-item { display: flex; align-items: center; gap: 7px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1.4fr; gap: 16px; margin-bottom: 16px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.warning-bar { background: #1a0a00; border: 1px solid #e0600055; border-left: 3px solid #e06000; color: #ffb86c; padding: 12px 16px; margin-bottom: 16px; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(11, prefs.fontSize - 2)}px; display: flex; align-items: center; gap: 10px; animation: fadein 0.3s ease; }
.analysis-block { background: #03070f; border: 1px solid #0f2a45; border-left: 3px solid ${prefs.accentColor}; padding: 16px; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(11, prefs.fontSize - 2)}px; line-height: 1.7; color: #7ab8d0; }
.analysis-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
.analysis-key { color: ${prefs.accentColor}; min-width: 170px; font-weight: 600; }
.history-item { background: #03070f; border: 1px solid #0f2a45; border-left: 3px solid #0f4060; padding: 14px 18px; margin-bottom: 10px; font-size: ${Math.max(12, prefs.fontSize - 1)}px; animation: fadein 0.3s ease both; transition: border-left-color 0.2s; }
.history-item:hover { border-left-color: ${prefs.accentColor}; }
.history-item strong { font-family: 'Orbitron', monospace; font-size: ${Math.max(10, prefs.fontSize - 3)}px; color: ${prefs.accentColor}; letter-spacing: 1px; }
.history-item p { color: #4a7090; margin-top: 5px; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(11, prefs.fontSize - 2)}px; }
.compare-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; align-items: end; }
.compare-label { font-family: 'Orbitron', monospace; font-size: ${Math.max(8, prefs.fontSize - 5)}px; letter-spacing: 1.5px; color: #4a8faa; margin-bottom: 4px; text-transform: uppercase; }
.diff-positive { color: #00ff88; }
.diff-negative { color: #ff4466; }
.diff-zero     { color: #4a8faa; }
.img-preview { width: 100%; max-height: 380px; object-fit: contain; margin-top: 14px; border: 1px solid #0f2a45; background: #03070f; display: block; filter: contrast(1.05) saturate(1.1); }
.corner-mark { position: absolute; width: 10px; height: 10px; border-color: ${prefs.accentColor}; border-style: solid; opacity: 0.6; animation: corner-glow 2s ease-in-out infinite; }
.corner-tl { top: 4px; left: 4px; border-width: 2px 0 0 2px; }
.corner-tr { top: 4px; right: 4px; border-width: 2px 2px 0 0; }
.corner-bl { bottom: 4px; left: 4px; border-width: 0 0 2px 2px; }
.corner-br { bottom: 4px; right: 4px; border-width: 0 2px 2px 0; }
.textarea-field { resize: vertical; min-height: 120px; }
.hint { color: #2a5070; font-size: ${Math.max(11, prefs.fontSize - 2)}px; margin-top: 10px; line-height: 1.5; font-family: 'Rajdhani', sans-serif; }
.file-tag { margin-top: 10px; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(11, prefs.fontSize - 2)}px; color: #3a7090; display: flex; align-items: center; gap: 8px; }
.model-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; background: rgba(0,200,255,0.08); border: 1px solid ${prefs.accentColor}33; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(9, prefs.fontSize - 4)}px; color: ${prefs.accentColor}; letter-spacing: 0.5px; }
.scale-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; background: rgba(0,255,136,0.08); border: 1px solid #00ff8833; font-family: 'Share Tech Mono', monospace; font-size: ${Math.max(9, prefs.fontSize - 4)}px; color: #00ff88; letter-spacing: 0.5px; margin-top: 6px; }
@media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } .kpi-grid { grid-template-columns: 1fr 1fr; } }
`;
}

// ─── LLAMADA A CLAUDE API ─────────────────────────────────────────────────────
async function llamarClaudeVision(imageDataUrl, escalaInfo) {
  const response = await fetch("/api/analizar-imagen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUrl, escala: escalaInfo || null }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

// ─── HELPER: RECORTAR IMAGEN ────────────────────────────────────────────────────
function recortarImagen(dataUrl, rect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(rect.w);
      canvas.height = Math.round(rect.h);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, Math.round(rect.x), Math.round(rect.y), Math.round(rect.w), Math.round(rect.h), 0, 0, Math.round(rect.w), Math.round(rect.h));
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.src = dataUrl;
  });
}

// ─── COMPONENTE CÍRCULO DE ESCALA ─────────────────────────────────────────────
function CirculoEscala({ imgSrc, onEscalaCalculada, onCancelar }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [circle, setCircle] = useState(null);
  const [start, setStart] = useState(null);
  const [diametro, setDiametro] = useState("15");
  const [unidad, setUnidad] = useState("cm");
  const [imgSize, setImgSize] = useState({ w: 0, h: 0, natW: 0, natH: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(800, window.innerWidth - 80);
      const ratio = img.naturalHeight / img.naturalWidth;
      setImgSize({ w: maxW, h: maxW * ratio, natW: img.naturalWidth, natH: img.naturalHeight });
    };
    img.src = imgSrc;
  }, [imgSrc]);

  // Bloquear scroll/zoom mientras el canvas está activo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgSize.w) return;
    const prevent = (e) => e.preventDefault();
    canvas.addEventListener("wheel", prevent, { passive: false });
    canvas.addEventListener("touchmove", prevent, { passive: false });
    canvas.addEventListener("touchstart", prevent, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", prevent);
      canvas.removeEventListener("touchmove", prevent);
      canvas.removeEventListener("touchstart", prevent);
    };
  }, [imgSize]);

  useEffect(() => {
    if (!canvasRef.current || !imgSize.w) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (circle) {
        ctx.beginPath();
        ctx.arc(circle.cx, circle.cy, circle.r, 0, 2 * Math.PI);
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(0,255,136,0.15)";
        ctx.fill();
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 13px monospace";
        ctx.fillText(`⌀ ${(circle.r * 2).toFixed(0)}px`, circle.cx - circle.r, circle.cy - circle.r - 6);
      }
    };
    img.src = imgSrc;
  }, [circle, imgSize, imgSrc]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    };
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const p = getPos(e);
    setStart(p);
    setDrawing(true);
    setCircle(null);
  };
  const onMouseMove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drawing || !start) return;
    const p = getPos(e);
    const dx = p.x - start.x, dy = p.y - start.y;
    const r = Math.sqrt(dx * dx + dy * dy) / 2;
    const cx = start.x + dx / 2, cy = start.y + dy / 2;
    setCircle({ cx, cy, r });
  };
  const onMouseUp = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } setDrawing(false); };

  const confirmar = () => {
    if (!circle || circle.r < 5) { alert("Dibuja un círculo sobre la pelota primero"); return; }
    const d = pv(diametro);
    if (!d || d <= 0) { alert("Ingresa el diámetro de la pelota"); return; }
    const diametroCm = unidad === "mm" ? d / 10 : d;
    const scaleX = imgSize.natW / imgSize.w;
    const diametroPxNat = circle.r * 2 * scaleX;
    const cmPorPixel = diametroCm / diametroPxNat;
    onEscalaCalculada({ cmPorPixel, diametroCm, diametroPx: diametroPxNat });
  };

  if (!imgSize.w) return <div style={{ color: "#4a8faa", padding: 20 }}>Cargando imagen...</div>;

  return (
    <div style={{ animation: "fadein 0.3s ease" }}>
      <p style={{ color: "#ffb86c", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, marginBottom: 12 }}>
        ⬡ Arrastra sobre la pelota para dibujar el círculo de referencia
      </p>
      <canvas
        ref={canvasRef}
        width={imgSize.w}
        height={imgSize.h}
        style={{ display: "block", border: "1px solid #0f2a45", cursor: "crosshair", maxWidth: "100%", touchAction: "none", userSelect: "none" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div className="compare-label">Diámetro de la pelota</div>
          <input className="lilly-input" style={{ width: 100, marginTop: 4 }} value={diametro}
            onChange={(e) => setDiametro(e.target.value)} placeholder="ej: 15" />
        </div>
        <div>
          <div className="compare-label">Unidad</div>
          <select className="lilly-input" style={{ width: 80, marginTop: 4 }} value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
          </select>
        </div>
        <button className="lilly-btn btn-green" onClick={confirmar} disabled={!circle || circle.r < 5}>⬡ Confirmar escala</button>
        <button className="lilly-btn btn-gray" onClick={onCancelar}>⬡ Cancelar</button>
      </div>
      {circle && circle.r >= 5 && (
        <div style={{ marginTop: 8, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00ff88" }}>
          ✓ Círculo: {(circle.r * 2).toFixed(0)}px de diámetro
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE RECTÁNGULO DE ZONA ───────────────────────────────────────────
function RectanguloZona({ imgSrc, onZonaSeleccionada, onCancelar }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const startRef = useRef(null);
  const [rect, setRect] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 800, h: 0, natW: 0, natH: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(800, window.innerWidth - 80);
      const ratio = img.naturalHeight / img.naturalWidth;
      setImgSize({ w: maxW, h: Math.round(maxW * ratio), natW: img.naturalWidth, natH: img.naturalHeight });
    };
    img.src = imgSrc;
  }, [imgSrc]);

  const redraw = useCallback((currentRect) => {
    const canvas = canvasRef.current;
    if (!canvas || !imgSize.h) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (currentRect && currentRect.w > 0 && currentRect.h > 0) {
        // Oscurece todo menos el área seleccionada, SIN redibujar la imagen dentro del rectángulo.
        // Así se evita el efecto de zoom al seleccionar la zona.
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
        ctx.fill("evenodd");
        ctx.restore();

        ctx.strokeStyle = "#00c8ff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
        ctx.setLineDash([]);

        const cs = 10;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        [
          [currentRect.x, currentRect.y],
          [currentRect.x + currentRect.w, currentRect.y],
          [currentRect.x, currentRect.y + currentRect.h],
          [currentRect.x + currentRect.w, currentRect.y + currentRect.h],
        ].forEach(([cx, cy]) => {
          const sx = cx === currentRect.x ? 1 : -1;
          const sy = cy === currentRect.y ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(cx, cy + sy * cs);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + sx * cs, cy);
          ctx.stroke();
        });

        ctx.fillStyle = "#00c8ff";
        ctx.font = "bold 12px monospace";
        const labelY = currentRect.y > 20 ? currentRect.y - 6 : currentRect.y + currentRect.h + 16;
        ctx.fillText(`${Math.round(currentRect.w)}×${Math.round(currentRect.h)}px`, currentRect.x + 4, labelY);
      }
    };

    img.src = imgSrc;
  }, [imgSize, imgSrc]);

  useEffect(() => { redraw(rect); }, [rect, redraw]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min((e.clientX - r.left) * (canvas.width / r.width), canvas.width)),
      y: Math.max(0, Math.min((e.clientY - r.top) * (canvas.height / r.height), canvas.height)),
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getPos(e);
    startRef.current = p;
    drawingRef.current = true;
    setRect(null);
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!drawingRef.current || !startRef.current) return;
    const p = getPos(e);
    const newRect = {
      x: Math.min(startRef.current.x, p.x),
      y: Math.min(startRef.current.y, p.y),
      w: Math.abs(p.x - startRef.current.x),
      h: Math.abs(p.y - startRef.current.y),
    };
    setRect(newRect);
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    drawingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const confirmar = () => {
    if (!rect || rect.w < 20 || rect.h < 20) { alert("Dibuja un área más grande para analizar"); return; }
    const scaleX = imgSize.natW / imgSize.w;
    const scaleY = imgSize.natH / imgSize.h;
    onZonaSeleccionada({
      x: rect.x * scaleX,
      y: rect.y * scaleY,
      w: rect.w * scaleX,
      h: rect.h * scaleY,
      displayRect: rect,
    });
  };

  if (!imgSize.h) return <div style={{ color: "#4a8faa", padding: 20 }}>Cargando imagen...</div>;

  return (
    <div style={{ animation: "fadein 0.3s ease" }}>
      <p style={{ color: "#00c8ff", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, marginBottom: 12 }}>
        ⬡ Arrastra para seleccionar la zona a analizar
      </p>
      <canvas
        ref={canvasRef}
        width={imgSize.w}
        height={imgSize.h}
        style={{
          display: "block",
          border: "1px solid #0f4060",
          cursor: "crosshair",
          maxWidth: "100%",
          height: "auto",
          userSelect: "none",
          touchAction: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button className="lilly-btn btn-green" onClick={confirmar} disabled={!rect || rect.w < 20}>⬡ Confirmar zona</button>
        <button className="lilly-btn btn-gray" onClick={onCancelar}>⬡ Cancelar</button>
        {rect && rect.w >= 20 && (
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00c8ff" }}>
            ✓ Zona: {Math.round(rect.w)}×{Math.round(rect.h)}px
          </span>
        )}
      </div>
    </div>
  );
}

// ─── PANEL DE CONFIGURACIÓN FLOTANTE ─────────────────────────────────────────
function PanelConfig({ prefs, onSave, onClose }) {
  const [local, setLocal] = useState({ ...prefs });
  return (
    <div style={{
      position: "fixed", right: 80, bottom: 80, width: 320, zIndex: 1000,
      background: "rgba(6,13,26,0.98)", border: "1px solid #0f4060",
      padding: 20, animation: "fadein 0.25s ease",
      clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))",
      boxShadow: "0 0 30px rgba(0,200,255,0.15)",
    }}>
      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, letterSpacing: 3, color: "#00c8ff", marginBottom: 16 }}>
        ⚙ CONFIGURACIÓN
      </div>
      <div style={{ marginBottom: 14 }}>
        <div className="compare-label">Tamaño de letra: {local.fontSize}px</div>
        <input type="range" min={12} max={18} step={1} value={local.fontSize}
          onChange={(e) => setLocal(p => ({ ...p, fontSize: Number(e.target.value) }))}
          style={{ width: "100%", marginTop: 6, accentColor: "#00c8ff" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#2a5070" }}>
          <span>12px</span><span>15px</span><span>18px</span>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div className="compare-label" style={{ marginBottom: 8 }}>Color de fondo</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {BG_PRESETS.map(p => (
            <div key={p.value} onClick={() => setLocal(lp => ({ ...lp, bgColor: p.value }))}
              title={p.label}
              style={{ width: 28, height: 28, background: p.value, cursor: "pointer", border: local.bgColor === p.value ? "2px solid #00c8ff" : "1px solid #0f2a45", borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="compare-label">Personalizado:</div>
          <input type="color" value={local.bgColor}
            onChange={(e) => setLocal(p => ({ ...p, bgColor: e.target.value }))}
            style={{ width: 36, height: 28, cursor: "pointer", background: "none", border: "1px solid #0f2a45", padding: 2 }} />
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#4a8faa" }}>{local.bgColor}</span>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div className="compare-label" style={{ marginBottom: 8 }}>Color de acento</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {["#00c8ff","#00ff88","#ff8800","#c864ff","#ff4466"].map(c => (
            <div key={c} onClick={() => setLocal(p => ({ ...p, accentColor: c }))}
              style={{ width: 24, height: 24, background: c, cursor: "pointer", borderRadius: "50%", border: local.accentColor === c ? "2px solid white" : "1px solid #0f2a45" }} />
          ))}
          <input type="color" value={local.accentColor}
            onChange={(e) => setLocal(p => ({ ...p, accentColor: e.target.value }))}
            style={{ width: 28, height: 24, cursor: "pointer", background: "none", border: "1px solid #0f2a45", padding: 1 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="lilly-btn btn-green" style={{ marginTop: 0, flex: 1 }} onClick={() => { onSave(local); onClose(); }}>⬡ Guardar</button>
        <button className="lilly-btn btn-gray"  style={{ marginTop: 0 }} onClick={() => { onSave(DEFAULT_PREFS); onClose(); }}>↺</button>
        <button className="lilly-btn btn-gray"  style={{ marginTop: 0 }} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// ─── EXPORTAR EXCEL FORMATO CARTILLA ─────────────────────────────────────────
function exportarCartillaExcel(evaluaciones, datosGenerales) {
  if (evaluaciones.length === 0) { alert("No hay evaluaciones para exportar"); return; }
  const { tronada, banco, sector, coordE, coordN, coordCota, fecha, tipoLit, rcu, rqd, ff, agua, realizadoPor, observaciones } = datosGenerales;
  const coords = [coordE, coordN, coordCota].filter(Boolean).join(", ");
  const aoa = [];
  aoa.push(["CARTILLA: EVALUACIÓN GEOLÓGICA Y GEOTÉCNICA", "", "", "", "", "", "", "APOYO AL DISEÑO DE TRONADURA"]);
  aoa.push([]);
  aoa.push(["Información General"]);
  aoa.push(["Tronada (Banco - N°)", `${banco || ""} - ${tronada || ""}`]);
  aoa.push(["Sector", sector || ""]);
  aoa.push(["Coordenadas (E,N,C)", coords]);
  aoa.push(["Fecha", fecha || new Date().toLocaleDateString()]);
  aoa.push([]);
  aoa.push(["Característica de la Roca"]);
  aoa.push(["Tipo Litológico", tipoLit || ""]);
  aoa.push(["Resistencia a la Compresión Simple (MPa)", rcu || ""]);
  aoa.push(["RQD (%)", rqd || ""]);
  aoa.push(["FF (# / mt)", ff || ""]);
  aoa.push(["Presencia de agua", agua || ""]);
  aoa.push([]);
  aoa.push(["Índice de tronabilidad según Lilly (Estimación de Factor de Carga)"]);
  const getColLabel = (i) => { if (i < 26) return String.fromCharCode(65 + i); return String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)); };
  aoa.push(["Parámetro", "Descripción", "Ratings", "Valor", ...evaluaciones.map((_, i) => `Celda ${getColLabel(i)}`), "Observaciones"]);
  aoa.push(["RMD", "Descripción del macizo rocoso.", "Poco Consolidado", 10, ...evaluaciones.map(e => e.rmd == 10 ? 10 : ""), ""]);
  aoa.push(["", "", "Diaclasado en Bloques (0.5m)", 20, ...evaluaciones.map(e => e.rmd >= 15 && e.rmd <= 25 ? e.rmd : ""), ""]);
  aoa.push(["", "", "Diaclasado en Bloques (1.0 m)", 30, ...evaluaciones.map(e => e.rmd >= 26 && e.rmd <= 35 ? e.rmd : ""), ""]);
  aoa.push(["", "", "Diaclasado en Bloques (>1 m)", 40, ...evaluaciones.map(e => e.rmd >= 36 && e.rmd <= 45 ? e.rmd : ""), ""]);
  aoa.push(["", "", "Masivo", 50, ...evaluaciones.map(e => e.rmd >= 46 ? e.rmd : ""), ""]);
  aoa.push(["JPS", "Espaciamiento entre fracturas.", "Pequeño ( < 0.1 m)", 10, ...evaluaciones.map(e => e.jps <= 15 ? e.jps : ""), ""]);
  aoa.push(["", "", "Intermedio ( 0.1 m a 1.0 m)", 20, ...evaluaciones.map(e => e.jps > 15 && e.jps < 45 ? e.jps : ""), ""]);
  aoa.push(["", "", "Grande ( > 1.0 m)", 50, ...evaluaciones.map(e => e.jps >= 45 ? e.jps : ""), ""]);
  aoa.push(["JPO", "Orientación de los planos de fractura.", "Horizontal (a)", 10, ...evaluaciones.map(e => e.jpo <= 15 ? e.jpo : ""), ""]);
  aoa.push(["", "", "Manteo hacia la cara (b)", 20, ...evaluaciones.map(e => e.jpo > 15 && e.jpo <= 25 ? e.jpo : ""), ""]);
  aoa.push(["", "", "Rumbo normal a la cara (c)", 30, ...evaluaciones.map(e => e.jpo > 25 && e.jpo <= 35 ? e.jpo : ""), ""]);
  aoa.push(["", "", "Manteo contra la cara (d)", 40, ...evaluaciones.map(e => e.jpo > 35 ? e.jpo : ""), ""]);
  aoa.push(["SGI", "Influencia de la densidad de la roca.", "SGI = 25 * SG - 50", "", ...evaluaciones.map(e => e.sgi || ""), ""]);
  aoa.push(["HD", "Dureza de la Roca", "HD = 0.05 x RCU", "", ...evaluaciones.map(e => e.hd || ""), "También puede utilizarse RCU: HD = 0.05 x RCU"]);
  aoa.push(["BI", "Índice de Tronabilidad", "BI = 0.5 x (RMD + JPS + JPO + SGI + HD)", "", ...evaluaciones.map(e => e.bi || ""), ""]);
  aoa.push([]);
  aoa.push(["FC", "Factor de Carga", "FC = 4 x BI", "", ...evaluaciones.map(e => e.fc || ""), ""]);
  aoa.push([]);
  aoa.push(["Observaciones Generales"]);
  aoa.push([observaciones || ""]);
  aoa.push([]);
  aoa.push(["Realizado por", realizadoPor || ""]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cartilla Lilly");
  XLSX.writeFile(wb, `Cartilla_Lilly_${sector || "evaluacion"}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─── PANTALLA DE LOGIN ────────────────────────────────────────────────────────
function PantallaLogin({ onLogin }) {
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!nombre.trim() || !pin.trim()) { setError("Ingresa tu nombre y PIN"); return; }
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.from("evaluadores").select("*").eq("nombre", nombre.trim()).single();
      if (err && err.code === "PGRST116") {
        const { data: nuevo, error: errCreate } = await supabase.from("evaluadores").insert({ nombre: nombre.trim(), pin: pin.trim() }).select().single();
        if (errCreate) throw errCreate;
        onLogin(nuevo);
      } else if (err) {
        throw err;
      } else {
        if (data.pin !== pin.trim()) { setError("PIN incorrecto"); setLoading(false); return; }
        onLogin(data);
      }
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#03070f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Rajdhani', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;500;600&family=Share+Tech+Mono&display=swap');`}</style>
      <div style={{ background: "rgba(6,13,26,0.97)", border: "1px solid #0f2a45", padding: 40, width: 360, clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))" }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900, color: "#e0f8ff", letterSpacing: 4, textShadow: "0 0 20px #00c8ff88", marginBottom: 6, textAlign: "center" }}>CARTILLA LILLY</div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11, color: "#3a80a0", letterSpacing: 3, textAlign: "center", marginBottom: 32, textTransform: "uppercase" }}>Acceso al sistema</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: 2, color: "#4a8faa", marginBottom: 6, textTransform: "uppercase" }}>Nombre del evaluador</div>
          <input style={{ display: "block", width: "100%", padding: "10px 14px", background: "#03070f", color: "#c8dff0", border: "1px solid #0f2a45", outline: "none", fontFamily: "'Share Tech Mono', monospace", fontSize: 14, clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" }}
            placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: 2, color: "#4a8faa", marginBottom: 6, textTransform: "uppercase" }}>PIN (4 dígitos)</div>
          <input style={{ display: "block", width: "100%", padding: "10px 14px", background: "#03070f", color: "#c8dff0", border: "1px solid #0f2a45", outline: "none", fontFamily: "'Share Tech Mono', monospace", fontSize: 14, clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" }}
            placeholder="****" type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        {error && <div style={{ color: "#ff4466", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, marginBottom: 16 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #0050b3, #0080ff)", border: "1px solid #0080ff55", color: "white", fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}>
          {loading ? "Verificando..." : "⬡ Ingresar"}
        </button>
        <p style={{ color: "#2a5070", fontSize: 11, marginTop: 16, textAlign: "center", lineHeight: 1.5, fontFamily: "'Rajdhani', sans-serif" }}>
          Primera vez? Tu cuenta se crea automáticamente con el PIN que elijas.
        </p>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function CartillaLillyPRO() {
  const [evaluador, setEvaluador] = useState(null);
  const [tab, setTab] = useState("evaluacion");
  const [loadingEval, setLoadingEval] = useState(false);
  const [loadingLearn, setLoadingLearn] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [prefs, setPrefs] = useState(() => readLS("lilly_prefs", DEFAULT_PREFS));
  const [mostrarCirculoEval, setMostrarCirculoEval] = useState(false);
  const [mostrarCirculoLearn, setMostrarCirculoLearn] = useState(false);
  const [escalaEval, setEscalaEval] = useState(null);
  const [escalaLearn, setEscalaLearn] = useState(null);
  const [mostrarRectEval, setMostrarRectEval] = useState(false);
  const [mostrarRectLearn, setMostrarRectLearn] = useState(false);
  const [rectEval, setRectEval] = useState(null);
  const [rectLearn, setRectLearn] = useState(null);
  const [tronada, setTronada] = useState("");
  const [banco, setBanco] = useState("");
  const [sector, setSector] = useState("");
  const [coordE, setCoordE] = useState("");
  const [coordN, setCoordN] = useState("");
  const [coordCota, setCoordCota] = useState("");
  const [tipoLitologico, setTipoLitologico] = useState("");
  const [sg, setSg] = useState("");
  const [rcu, setRcu] = useState("");
  const [rqd, setRqd] = useState("");
  const [ff, setFf] = useState("");
  const [agua, setAgua] = useState("");
  const [rmd, setRmd] = useState("");
  const [jps, setJps] = useState("");
  const [jpo, setJpo] = useState("");
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [realizadoPor, setRealizadoPor] = useState("");
  const [analisisIA, setAnalisisIA] = useState(null);
  const [evaluacionesSector, setEvaluacionesSector] = useState([]);
  const [learnImage, setLearnImage] = useState(null);
  const [learnPreview, setLearnPreview] = useState("");
  const [learnIA, setLearnIA] = useState(null);
  const [realRmd, setRealRmd] = useState("");
  const [realJps, setRealJps] = useState("");
  const [realJpo, setRealJpo] = useState("");
  const [learnObs, setLearnObs] = useState("");
  const [historial, setHistorial] = useState([]);
  const [learningCases, setLearningCases] = useState([]);

  useEffect(() => {
    let style = document.getElementById("lilly-global-css");
    if (!style) { style = document.createElement("style"); style.id = "lilly-global-css"; document.head.appendChild(style); }
    style.textContent = buildCSS(prefs);
    document.body.style.background = prefs.bgColor;
  }, [prefs]);

  useEffect(() => {
    setHistorial(readLS("historial_lilly", []));
    setLearningCases(readLS("lilly_learning", []));
    setEvaluacionesSector(readLS("lilly_sector", []));
  }, []);

  const savePrefs = (p) => { setPrefs(p); writeLS("lilly_prefs", p); };

  const SG = pv(sg), RCU = pv(rcu), RMD = pv(rmd), JPS = pv(jps), JPO = pv(jpo);
  const datosValidos = SG > 0 && RCU > 0;
  const SGI = datosValidos ? 25 * SG - 50 : 0;
  const HD  = datosValidos ? 0.05 * RCU : 0;
  const BI  = datosValidos ? 0.5 * (RMD + JPS + JPO + SGI + HD) : 0;
  const FC  = datosValidos ? 4 * BI : 0;

  const promedioError = useMemo(() => {
    const n = learningCases.length;
    if (n === 0) return { rmd: 0, jps: 0, jpo: 0 };
    return {
      rmd: learningCases.reduce((a, b) => a + b.error.rmd, 0) / n,
      jps: learningCases.reduce((a, b) => a + b.error.jps, 0) / n,
      jpo: learningCases.reduce((a, b) => a + b.error.jpo, 0) / n,
    };
  }, [learningCases]);

  const seleccionarImagen = (file, tipo) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (tipo === "evaluacion") { setImagen(file); setPreview(reader.result); setEscalaEval(null); setMostrarCirculoEval(false); setRectEval(null); setMostrarRectEval(false); }
      else { setLearnImage(file); setLearnPreview(reader.result); setEscalaLearn(null); setMostrarCirculoLearn(false); setRectLearn(null); setMostrarRectLearn(false); }
    };
    reader.readAsDataURL(file);
  };

  const analizarImagenEval = useCallback(async () => {
    if (!preview) { alert("Selecciona una imagen primero"); return; }
    const capturedPreview = preview;
    setLoadingEval(true);
    try {
      const imgParaAnalizar = rectEval ? await recortarImagen(capturedPreview, rectEval) : capturedPreview;
      const data = await llamarClaudeVision(imgParaAnalizar, escalaEval);
      if (capturedPreview !== preview) return;
      setRmd(String(data.rmd ?? "")); setJps(String(data.jps ?? "")); setJpo(String(data.jpo ?? ""));
      setAnalisisIA(data);
    } catch (err) { alert("Error Claude API: " + (err.message || String(err))); }
    finally { setLoadingEval(false); }
  }, [preview, escalaEval, rectEval]);

  const analizarImagenLearn = useCallback(async () => {
    if (!learnPreview) { alert("Selecciona una imagen primero"); return; }
    const capturedPreview = learnPreview;
    setLoadingLearn(true);
    try {
      const imgParaAnalizar = rectLearn ? await recortarImagen(capturedPreview, rectLearn) : capturedPreview;
      const data = await llamarClaudeVision(imgParaAnalizar, escalaLearn);
      if (capturedPreview !== learnPreview) return;
      setLearnIA(data);
    } catch (err) { alert("Error Claude API: " + (err.message || String(err))); }
    finally { setLoadingLearn(false); }
  }, [learnPreview, escalaLearn, rectLearn]);

  const aplicarCorreccionPromedio = () => {
    if (learningCases.length === 0) { alert("No hay casos de aprendizaje todavía"); return; }
    setRmd(String(Math.round(pv(rmd) + promedioError.rmd)));
    setJps(String(Math.round(pv(jps) + promedioError.jps)));
    setJpo(String(Math.round(pv(jpo) + promedioError.jpo)));
  };

  const crearRegistro = useCallback(() => ({
    Fecha: new Date().toLocaleString(), Tronada: tronada, Banco: banco, Sector: sector,
    Coord_E: coordE, Coord_N: coordN, Coord_Cota: coordCota, Tipo_Litologico: tipoLitologico,
    ArchivoImagen: imagen?.name || "", ImagenBase64: preview || "",
    SG: sg, RCU: rcu, RQD: rqd, FF: ff, Agua: agua,
    RMD: rmd, JPS: jps, JPO: jpo, SGI: fmt(SGI), HD: fmt(HD), BI: fmt(BI), FC: fmt(FC),
    ConfianzaIA: analisisIA?.confianza || "", AnalisisIA: analisisIA?.observacion_tecnica || "",
    Observaciones: observaciones, RealizadoPor: realizadoPor,
  }), [tronada, banco, sector, coordE, coordN, coordCota, tipoLitologico, imagen, preview, sg, rcu, rqd, ff, agua, rmd, jps, jpo, SGI, HD, BI, FC, analisisIA, observaciones, realizadoPor]);

  const guardarEvaluacion = useCallback(async () => {
    if (!datosValidos) { alert("Debes ingresar SG y RCU antes de guardar"); return; }
    if (!analisisIA || !rmd || !jps || !jpo || pv(rmd) === 0 || pv(jps) === 0 || pv(jpo) === 0) {
      alert("⚠ Debes analizar la imagen con IA antes de guardar.\nRMD, JPS y JPO no pueden ser 0."); return;
    }
    const r = crearRegistro();
    const { error } = await supabase.from("historial").insert({
      evaluador: evaluador?.nombre || "", tronada: r.Tronada, banco: r.Banco, sector: r.Sector,
      coord_e: r.Coord_E, coord_n: r.Coord_N, coord_cota: r.Coord_Cota,
      tipo_litologico: r.Tipo_Litologico, archivo_imagen: r.ArchivoImagen, imagen_base64: r.ImagenBase64,
      sg: r.SG, rcu: r.RCU, rqd: r.RQD, ff: r.FF, agua: r.Agua,
      rmd: r.RMD, jps: r.JPS, jpo: r.JPO, sgi: r.SGI, hd: r.HD, bi: r.BI, fc: r.FC,
      confianza_ia: r.ConfianzaIA, analisis_ia: r.AnalisisIA, observaciones: r.Observaciones,
    });
    if (error) { alert("Error al guardar en Supabase: " + error.message); return; }
    const actualizadoH = [r, ...historial];
    setHistorial(actualizadoH);
    writeLS("historial_lilly", actualizadoH);
    const evalSector = { rmd: pv(rmd), jps: pv(jps), jpo: pv(jpo), sgi: SGI, hd: HD, bi: BI, fc: FC, imagen: imagen?.name || "" };
    const actualizadoS = [...evaluacionesSector, evalSector];
    setEvaluacionesSector(actualizadoS);
    writeLS("lilly_sector", actualizadoS);
    alert("✓ Evaluación guardada");
  }, [datosValidos, crearRegistro, historial, rmd, jps, jpo, SGI, HD, BI, FC, imagen, evaluacionesSector, evaluador]);

  const limpiarSector = () => {
    if (!window.confirm("¿Limpiar las evaluaciones del sector actual para iniciar uno nuevo?")) return;
    setEvaluacionesSector([]); writeLS("lilly_sector", []);
  };

  const guardarEvalComoAprendizaje = useCallback(() => {
    if (!analisisIA || !preview || !rmd || !jps || !jpo) { alert("Analiza la imagen con IA primero y verifica RMD, JPS, JPO"); return; }
    const ia = { rmd: Number(analisisIA.rmd ?? 0), jps: Number(analisisIA.jps ?? 0), jpo: Number(analisisIA.jpo ?? 0) };
    const real = { rmd: pv(rmd), jps: pv(jps), jpo: pv(jpo) };
    const nuevo = { Fecha: new Date().toLocaleString(), ArchivoImagen: imagen?.name || "", ImagenBase64: preview, ia, real, error: { rmd: real.rmd - ia.rmd, jps: real.jps - ia.jps, jpo: real.jpo - ia.jpo }, confianza: analisisIA.confianza || "Validado desde evaluación", observacion: observaciones || "Guardado desde Evaluación.", analisis: analisisIA };
    const actualizado = [nuevo, ...learningCases];
    setLearningCases(actualizado); writeLS("lilly_learning", actualizado);
    alert("✓ Guardado también como caso de aprendizaje");
  }, [analisisIA, preview, rmd, jps, jpo, imagen, observaciones, learningCases]);

  const guardarCasoAprendizaje = useCallback(async () => {
    if (!learnIA || !realRmd || !realJps || !realJpo) { alert("Analiza la imagen y completa los valores reales"); return; }
    const ia = { rmd: Number(learnIA.rmd ?? 0), jps: Number(learnIA.jps ?? 0), jpo: Number(learnIA.jpo ?? 0) };
    const real = { rmd: pv(realRmd), jps: pv(realJps), jpo: pv(realJpo) };
    const nuevo = { Fecha: new Date().toLocaleString(), ArchivoImagen: learnImage?.name || "", ImagenBase64: learnPreview, ia, real, error: { rmd: real.rmd - ia.rmd, jps: real.jps - ia.jps, jpo: real.jpo - ia.jpo }, confianza: learnIA.confianza || "No indicada", observacion: learnObs, analisis: learnIA };
    const { error } = await supabase.from("aprendizaje").insert({
      evaluador: evaluador?.nombre || "", archivo_imagen: learnImage?.name || "", imagen_base64: learnPreview,
      ia_rmd: ia.rmd, ia_jps: ia.jps, ia_jpo: ia.jpo,
      real_rmd: real.rmd, real_jps: real.jps, real_jpo: real.jpo,
      error_rmd: real.rmd - ia.rmd, error_jps: real.jps - ia.jps, error_jpo: real.jpo - ia.jpo,
      confianza: learnIA.confianza || "No indicada", observacion: learnObs, analisis: learnIA,
    });
    if (error) { alert("Error al guardar en Supabase: " + error.message); return; }
    const actualizado = [nuevo, ...learningCases];
    setLearningCases(actualizado); writeLS("lilly_learning", actualizado);
    alert("✓ Caso de aprendizaje guardado");
  }, [learnIA, realRmd, realJps, realJpo, learnImage, learnPreview, learnObs, learningCases, evaluador]);

  const exportarHistorialExcel = useCallback(() => {
    if (historial.length === 0) {
      alert("No hay historial para exportar");
      return;
    }

    try {
      const dataLimpia = historial.map((r) => {
        const copia = { ...r };

        // Excel no soporta textos mayores a 32767 caracteres por celda.
        // La imagen Base64 es muy larga, por eso no se exporta al historial Excel.
        delete copia.ImagenBase64;

        Object.keys(copia).forEach((key) => {
          if (copia[key] != null && String(copia[key]).length > 32000) {
            copia[key] = String(copia[key]).slice(0, 32000);
          }
        });

        return copia;
      });

      const ws = XLSX.utils.json_to_sheet(dataLimpia);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      XLSX.writeFile(wb, "Historial_Cartilla_Lilly.xlsx");
    } catch (e) {
      alert("Error: " + e.message);
    }
  }, [historial]);

  const exportarAprendizajeExcel = useCallback(() => {
    if (learningCases.length === 0) { alert("No hay casos de aprendizaje"); return; }
    try {
      const data = learningCases.map((c) => ({ Fecha: c.Fecha, Imagen: c.ArchivoImagen, RMD_IA: c.ia.rmd, RMD_REAL: c.real.rmd, ERROR_RMD: c.error.rmd, JPS_IA: c.ia.jps, JPS_REAL: c.real.jps, ERROR_JPS: c.error.jps, JPO_IA: c.ia.jpo, JPO_REAL: c.real.jpo, ERROR_JPO: c.error.jpo, Confianza: c.confianza, Observacion: c.observacion }));
      const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Aprendizaje_IA"); XLSX.writeFile(wb, "Base_Aprendizaje_IA_Lilly.xlsx");
    } catch (e) { alert("Error: " + e.message); }
  }, [learningCases]);

  const descargarJsonlEntrenamiento = useCallback(() => {
    if (learningCases.length < 10) { alert("Necesitas al menos 10 casos validados. Recomendado: 50+."); return; }
    const jsonl = learningCases.map((c) => {
      const resp = { rmd: c.real.rmd, jps: c.real.jps, jpo: c.real.jpo, confianza: c.confianza || "Validado por usuario", justificacion_rmd: c.analisis?.justificacion_rmd || "Corregido por especialista.", justificacion_jps: c.analisis?.justificacion_jps || "Corregido por especialista.", justificacion_jpo: c.analisis?.justificacion_jpo || "Corregido por especialista.", observacion_tecnica: c.observacion || "Base supervisada Lilly." };
      return JSON.stringify({ messages: [{ role: "system", content: "Eres un ingeniero geotécnico experto en Cartilla Lilly." }, { role: "user", content: [{ type: "text", text: "Evalúa visualmente esta fotografía de macizo rocoso para Cartilla Lilly." }] }, { role: "assistant", content: JSON.stringify(resp) }] });
    }).join("\n");
    const blob = new Blob([jsonl], { type: "application/jsonl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lilly_finetuning.jsonl";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [learningCases]);

  if (!evaluador) return <PantallaLogin onLogin={setEvaluador} />;

  return (
    <div style={S.root(prefs)}>
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoMark(prefs)}>⬡</div>
          <div>
            <h1 style={S.title(prefs)}>CARTILLA LILLY</h1>
            <p style={S.subtitle}>MÓDULO DE EVALUACIÓN GEOTÉCNICA CON IA SUPERVISADA</p>
          </div>
        </div>
        <div className="lilly-card" style={{ flex: 1, maxWidth: 680, minWidth: 280 }}>
          <div className="corner-mark corner-tl" /><div className="corner-mark corner-tr" />
          <div className="corner-mark corner-bl" /><div className="corner-mark corner-br" />
          <div className="status-row">
            <span className="status-item"><span className="blink-dot" style={{ background: "#00ff88" }} />SISTEMA ACTIVO</span>
            <span className="status-item"><span className="model-badge">claude-sonnet-4-6</span></span>
            <span className="status-item" style={{ color: "#00ff88", fontFamily: "'Share Tech Mono', monospace" }}>👤 {evaluador?.nombre}</span>
            <span className="status-item"><span style={{ color: prefs.accentColor }}>▸</span>CASOS: <strong style={{ color: "#c8dff0", marginLeft: 4 }}>{learningCases.length}</strong></span>
            <span className="status-item"><span style={{ color: "#ffb800" }}>Δ</span>ERR RMD: <strong style={{ color: "#c8dff0", marginLeft: 4 }}>{fmt(promedioError.rmd)}</strong></span>
            <span className="status-item"><span style={{ color: "#ffb800" }}>Δ</span>ERR JPS: <strong style={{ color: "#c8dff0", marginLeft: 4 }}>{fmt(promedioError.jps)}</strong></span>
            <span className="status-item"><span style={{ color: "#ffb800" }}>Δ</span>ERR JPO: <strong style={{ color: "#c8dff0", marginLeft: 4 }}>{fmt(promedioError.jpo)}</strong></span>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, marginBottom: 0, borderBottom: "1px solid #0f2a45" }}>
        {["evaluacion", "aprendizaje", "historial"].map((t) => (
          <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "evaluacion" && "⬡ Evaluación"}{t === "aprendizaje" && "⬡ Aprendizaje IA"}{t === "historial" && "⬡ Historial"}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: "1px solid #0f2a45", marginBottom: -1 }} />
      </div>

      {tab === "evaluacion" && (
        <>
          <div className="grid-2">
            <div className="lilly-card">
              <div className="section-label">Datos del proyecto</div>
              {[["Tronada", tronada, setTronada], ["Banco", banco, setBanco], ["Sector", sector, setSector], ["Coordenada E", coordE, setCoordE], ["Coordenada N", coordN, setCoordN], ["Cota", coordCota, setCoordCota], ["Tipo litológico", tipoLitologico, setTipoLitologico], ["Realizado por", realizadoPor, setRealizadoPor]].map(([label, val, setter]) => (
                <div key={label}><div className="compare-label">{label}</div><input className="lilly-input" placeholder={label} value={val} onChange={(e) => setter(e.target.value)} /></div>
              ))}
            </div>
            <div className="lilly-card">
              <div className="section-label">Fotografía del macizo</div>
              <input id="fileEval" type="file" style={{ display: "none" }} accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) seleccionarImagen(f, "evaluacion"); }} />
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                <button className="lilly-btn btn-blue" onClick={() => document.getElementById("fileEval").click()}>⬡ Seleccionar imagen</button>
                {preview && !mostrarCirculoEval && <button className="lilly-btn btn-orange" onClick={() => setMostrarCirculoEval(true)}>⬡ Calibrar escala</button>}
                <button className="lilly-btn btn-blue" onClick={analizarImagenEval} disabled={loadingEval || !preview}>
                  {loadingEval ? <><span className="spinner" /> Analizando...</> : "⬡ Analizar con IA"}
                </button>
              </div>
              {imagen && <div className="file-tag"><span style={{ color: prefs.accentColor }}>■</span>{imagen.name}</div>}
              {escalaEval && (
                <div className="scale-badge">⬡ Escala: 1px = {escalaEval.cmPorPixel.toFixed(4)}cm · Pelota {escalaEval.diametroCm}cm
                  <span style={{ cursor: "pointer", marginLeft: 6, color: "#ff4466" }} onClick={() => setEscalaEval(null)}>✕</span>
                </div>
              )}
              {preview && !mostrarCirculoEval && !mostrarRectEval && (
                <button className="lilly-btn btn-blue" onClick={() => setMostrarRectEval(true)}>⬡ Seleccionar zona</button>
              )}
              {rectEval && !mostrarRectEval && (
                <div style={{ marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00c8ff", display: "flex", alignItems: "center", gap: 8 }}>
                  ⬡ Zona definida: {Math.round(rectEval.w)}×{Math.round(rectEval.h)}px
                  <span style={{ cursor: "pointer", color: "#ff4466" }} onClick={() => setRectEval(null)}>✕ quitar</span>
                </div>
              )}
              {mostrarCirculoEval && preview ? (
                <div style={{ marginTop: 14 }}>
                  <CirculoEscala imgSrc={preview}
                    onEscalaCalculada={(e) => { setEscalaEval(e); setMostrarCirculoEval(false); alert(`✓ Escala calibrada: 1px = ${e.cmPorPixel.toFixed(4)} cm`); }}
                    onCancelar={() => setMostrarCirculoEval(false)} />
                </div>
              ) : mostrarRectEval && preview ? (
                <div style={{ marginTop: 14 }}>
                  <RectanguloZona imgSrc={preview}
                    onZonaSeleccionada={(r) => { setRectEval(r); setMostrarRectEval(false); }}
                    onCancelar={() => setMostrarRectEval(false)} />
                </div>
              ) : (
                preview && (
                  <div style={{ position: "relative", marginTop: 14 }}>
                    <img src={preview} alt="Vista previa" className="img-preview" />
                    {rectEval && (
                      <div style={{
                        position: "absolute",
                        left: rectEval.displayRect.x / (rectEval.w / rectEval.displayRect.w),
                        top: rectEval.displayRect.y / (rectEval.h / rectEval.displayRect.h),
                        width: rectEval.displayRect.w, height: rectEval.displayRect.h,
                        border: "2px dashed #00c8ff", background: "rgba(0,200,255,0.08)", pointerEvents: "none",
                      }} />
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="grid-2">
            <div className="lilly-card">
              <div className="section-label">Datos duros (manuales)</div>
              {[["SG / Densidad (ej: 2.51)", sg, setSg], ["RCU [MPa] (ej: 100)", rcu, setRcu], ["RQD [%]", rqd, setRqd], ["FF [n°/m]", ff, setFf], ["Presencia de agua", agua, setAgua]].map(([ph, val, setter]) => (
                <div key={ph}><div className="compare-label">{ph}</div><input className="lilly-input" placeholder={ph} value={val} onChange={(e) => setter(e.target.value)} /></div>
              ))}
            </div>
            <div className="lilly-card">
              <div className="section-label">Parámetros IA / corregibles</div>
              {[["RMD", rmd, setRmd], ["JPS", jps, setJps], ["JPO", jpo, setJpo]].map(([label, val, setter]) => (
                <div key={label}><div className="compare-label">{label}</div><input className="lilly-input" placeholder={label} value={val} onChange={(e) => setter(e.target.value)} /></div>
              ))}
              <button className="lilly-btn btn-orange" style={{ marginTop: 16 }} onClick={aplicarCorreccionPromedio}>⬡ Aplicar ajuste por aprendizaje</button>
              <p className="hint">Ajuste automático basado en {learningCases.length} casos validados.</p>
            </div>
          </div>

          <div className="kpi-grid">
            <KPICard title="SGI" value={datosValidos ? fmt(SGI) : "—"} prefs={prefs} />
            <KPICard title="HD"  value={datosValidos ? fmt(HD)  : "—"} prefs={prefs} />
            <KPICard title="BI"  value={datosValidos ? fmt(BI)  : "—"} prefs={prefs} />
            <KPICard title="FC"  value={datosValidos ? fmt(FC)  : "—"} prefs={prefs} highlight />
          </div>

          {!datosValidos && <div className="warning-bar">⚠ Ingresa SG y RCU para activar el cálculo automático de SGI / HD / BI / FC.</div>}

          <div className="grid-2">
            <div className="lilly-card">
              <div className="section-label">Análisis IA (Claude)</div>
              {analisisIA ? (
                <div className="analysis-block">
                  {[["Confianza", analisisIA.confianza], ["Justificación RMD", analisisIA.justificacion_rmd], ["Justificación JPS", analisisIA.justificacion_jps], ["Justificación JPO", analisisIA.justificacion_jpo], ["Observación técnica", analisisIA.observacion_tecnica]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="analysis-row"><span className="analysis-key">{k}:</span><span style={{ color: "#8ab8cc" }}>{v}</span></div>
                  ))}
                </div>
              ) : <p className="hint">Sin análisis IA. Selecciona una imagen y presiona "Analizar con IA".</p>}
            </div>
            <div className="lilly-card">
              <div className="section-label">Observaciones del evaluador</div>
              <textarea className="lilly-input textarea-field" placeholder="Ingrese observaciones técnicas del sitio..."
                value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              <button className="lilly-btn btn-green" onClick={guardarEvaluacion} disabled={!datosValidos}>⬡ Guardar evaluación</button>
              <button className="lilly-btn btn-orange" onClick={guardarEvalComoAprendizaje} disabled={!analisisIA || !preview || !rmd || !jps || !jpo}>⬡ Guardar como aprendizaje</button>
              <button className="lilly-btn btn-excel"
                onClick={() => exportarCartillaExcel(evaluacionesSector, { tronada, banco, sector, coordE, coordN, coordCota, fecha: new Date().toLocaleDateString(), tipoLit: tipoLitologico, rcu, rqd, ff, agua, realizadoPor, observaciones })}
                disabled={evaluacionesSector.length === 0}>
                ⬡ Exportar Cartilla Excel ({evaluacionesSector.length} col)
              </button>
              <button className="lilly-btn btn-gray" onClick={limpiarSector} disabled={evaluacionesSector.length === 0}>⬡ Nuevo sector</button>
              <button className="lilly-btn btn-excel" onClick={exportarHistorialExcel}>⬡ Excel historial completo</button>
            </div>
          </div>
        </>
      )}

      {tab === "aprendizaje" && (
        <>
          <div className="grid-2">
            <div className="lilly-card">
              <div className="section-label">Zona de carga IA</div>
              <p className="hint" style={{ marginBottom: 10 }}>Carga una imagen, calibra la escala si tienes pelota de referencia, luego analiza con IA.</p>
              <input id="fileLearn" type="file" style={{ display: "none" }} accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) seleccionarImagen(f, "aprendizaje"); }} />
              <button className="lilly-btn btn-blue" onClick={() => document.getElementById("fileLearn").click()}>⬡ Seleccionar imagen</button>
              {learnPreview && !mostrarCirculoLearn && <button className="lilly-btn btn-orange" onClick={() => setMostrarCirculoLearn(true)}>⬡ Calibrar escala</button>}
              <button className="lilly-btn btn-blue" onClick={analizarImagenLearn} disabled={loadingLearn || !learnPreview}>
                {loadingLearn ? <><span className="spinner" /> Analizando...</> : "⬡ Analizar para aprendizaje"}
              </button>
              {learnImage && <div className="file-tag"><span style={{ color: prefs.accentColor }}>■</span>{learnImage.name}</div>}
              {escalaLearn && (
                <div className="scale-badge">⬡ Escala: 1px = {escalaLearn.cmPorPixel.toFixed(4)}cm · Pelota {escalaLearn.diametroCm}cm
                  <span style={{ cursor: "pointer", marginLeft: 6, color: "#ff4466" }} onClick={() => setEscalaLearn(null)}>✕</span>
                </div>
              )}
              {learnPreview && !mostrarCirculoLearn && !mostrarRectLearn && (
                <button className="lilly-btn btn-blue" onClick={() => setMostrarRectLearn(true)}>⬡ Seleccionar zona</button>
              )}
              {rectLearn && !mostrarRectLearn && (
                <div style={{ marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00c8ff", display: "flex", alignItems: "center", gap: 8 }}>
                  ⬡ Zona definida: {Math.round(rectLearn.w)}×{Math.round(rectLearn.h)}px
                  <span style={{ cursor: "pointer", color: "#ff4466" }} onClick={() => setRectLearn(null)}>✕ quitar</span>
                </div>
              )}
              {mostrarCirculoLearn && learnPreview ? (
                <div style={{ marginTop: 14 }}>
                  <CirculoEscala imgSrc={learnPreview}
                    onEscalaCalculada={(e) => { setEscalaLearn(e); setMostrarCirculoLearn(false); alert(`✓ Escala calibrada: 1px = ${e.cmPorPixel.toFixed(4)} cm`); }}
                    onCancelar={() => setMostrarCirculoLearn(false)} />
                </div>
              ) : mostrarRectLearn && learnPreview ? (
                <div style={{ marginTop: 14 }}>
                  <RectanguloZona imgSrc={learnPreview}
                    onZonaSeleccionada={(r) => { setRectLearn(r); setMostrarRectLearn(false); }}
                    onCancelar={() => setMostrarRectLearn(false)} />
                </div>
              ) : (
                learnPreview && <img src={learnPreview} alt="Aprendizaje" className="img-preview" />
              )}
            </div>
            <div className="lilly-card">
              <div className="section-label">Claude vs Valor real / corregido</div>
              <CompareRow label="RMD" ia={learnIA?.rmd} real={realRmd} setReal={setRealRmd} />
              <CompareRow label="JPS" ia={learnIA?.jps} real={realJps} setReal={setRealJps} />
              <CompareRow label="JPO" ia={learnIA?.jpo} real={realJpo} setReal={setRealJpo} />
              <div style={{ marginTop: 8 }}>
                <div className="compare-label">Observación técnica del caso</div>
                <textarea className="lilly-input textarea-field" placeholder="Describe el contexto o corrección aplicada..."
                  value={learnObs} onChange={(e) => setLearnObs(e.target.value)} />
              </div>
              <button className="lilly-btn btn-green" onClick={guardarCasoAprendizaje}>⬡ Guardar caso</button>
              <button className="lilly-btn btn-excel" onClick={exportarAprendizajeExcel}>⬡ Exportar base</button>
              <button className="lilly-btn btn-excel" onClick={descargarJsonlEntrenamiento}>⬡ Descargar JSONL</button>
            </div>
          </div>
          <div className="lilly-card">
            <div className="section-label">Base de aprendizaje — {learningCases.length} caso{learningCases.length !== 1 ? "s" : ""}</div>
            {learningCases.length === 0 ? <p className="hint">No hay casos guardados aún.</p> : learningCases.map((c, i) => (
              <div key={i} className="history-item">
                <strong>{c.Fecha}</strong>
                <p>Imagen: {c.ArchivoImagen || "Sin imagen"} · Confianza: {c.confianza}</p>
                <p>RMD IA/Real/Error: {c.ia.rmd} / {c.real.rmd} / <DiffSpan v={c.error.rmd} /></p>
                <p>JPS IA/Real/Error: {c.ia.jps} / {c.real.jps} / <DiffSpan v={c.error.jps} /></p>
                <p>JPO IA/Real/Error: {c.ia.jpo} / {c.real.jpo} / <DiffSpan v={c.error.jpo} /></p>
                {c.observacion && <p>Obs: {c.observacion}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "historial" && (
        <div className="lilly-card">
          <div className="section-label">Historial — {historial.length} registro{historial.length !== 1 ? "s" : ""}</div>
          <button className="lilly-btn btn-excel" style={{ marginBottom: 16 }} onClick={exportarHistorialExcel}>⬡ Exportar Excel</button>
          {historial.length === 0 ? <p className="hint">No hay evaluaciones guardadas.</p> : historial.map((item, idx) => (
            <div key={idx} className="history-item">
              <strong>{item.Fecha}</strong>
              <p>Tronada: {item.Tronada || "–"} · Banco: {item.Banco || "–"} · Sector: {item.Sector || "–"}</p>
              <p>RMD: {item.RMD} · JPS: {item.JPS} · JPO: {item.JPO}</p>
              <p>SGI: {item.SGI} · HD: {item.HD} · BI: {item.BI} · FC: {item.FC}</p>
              {item.Observaciones && <p>Obs: {item.Observaciones}</p>}
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowConfig(!showConfig)} style={{
        position: "fixed", bottom: 32, right: 32, width: 54, height: 54, borderRadius: "50%",
        background: "linear-gradient(135deg, #0050b3, #0080ff)", border: "2px solid #00c8ff",
        color: "white", fontSize: 24, cursor: "pointer", zIndex: 99999,
        boxShadow: "0 0 28px rgba(0,200,255,0.7), 0 0 0 4px rgba(0,128,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.2s, box-shadow 0.2s", outline: "none",
      }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.12)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >⚙</button>

      {showConfig && <PanelConfig prefs={prefs} onSave={savePrefs} onClose={() => setShowConfig(false)} />}
    </div>
  );
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────
function KPICard({ title, value, highlight = false, prefs }) {
  return (
    <div className={`kpi-card${highlight ? " kpi-highlight" : ""}`}>
      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 9, letterSpacing: "3px", color: highlight ? "#e06000" : "#4a8faa", marginBottom: 10, textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 32, color: highlight ? "#ff8800" : (prefs?.accentColor || "#00c8ff"), textShadow: highlight ? "0 0 16px #e0600088" : `0 0 16px ${prefs?.accentColor || "#00c8ff"}88`, letterSpacing: 1, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function CompareRow({ label, ia, real, setReal }) {
  const nReal = pv(real), nIA = ia !== undefined ? Number(ia) : null;
  const diff = real !== "" && nIA !== null ? nReal - nIA : null;
  return (
    <div className="compare-grid">
      <div><div className="compare-label">{label} IA</div><div className="lilly-input" style={{ color: "#00c8ff", fontFamily: "'Share Tech Mono', monospace" }}>{ia !== undefined ? ia : "—"}</div></div>
      <div><div className="compare-label">{label} Real</div><input className="lilly-input" value={real} onChange={(e) => setReal(e.target.value)} placeholder="0" /></div>
      <div><div className="compare-label">Diferencia</div>
        <div className={`lilly-input ${diff === null ? "" : diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-zero"}`} style={{ fontFamily: "'Share Tech Mono', monospace" }}>
          {diff !== null ? fmt(diff) : "—"}
        </div>
      </div>
    </div>
  );
}

function DiffSpan({ v }) {
  return <span className={v > 0 ? "diff-positive" : v < 0 ? "diff-negative" : "diff-zero"}>{fmt(v)}</span>;
}

const S = {
  root: (prefs) => ({
    padding: "24px 28px", background: prefs.bgColor, minHeight: "100vh", color: "#c8dff0",
    fontFamily: "'Rajdhani', sans-serif", fontSize: prefs.fontSize,
    backgroundImage: `radial-gradient(ellipse 80% 40% at 50% -10%, rgba(0,80,160,0.18) 0%, transparent 70%), repeating-linear-gradient(90deg, rgba(0,200,255,0.015) 0px, rgba(0,200,255,0.015) 1px, transparent 1px, transparent 60px), repeating-linear-gradient(0deg, rgba(0,200,255,0.015) 0px, rgba(0,200,255,0.015) 1px, transparent 1px, transparent 60px)`,
  }),
  header:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24, flexWrap: "wrap" },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  logoMark:   (prefs) => ({ fontSize: 40, color: prefs.accentColor, textShadow: `0 0 20px ${prefs.accentColor}cc`, lineHeight: 1, fontFamily: "'Orbitron', monospace" }),
  title:      (prefs) => ({ fontFamily: "'Orbitron', monospace", fontSize: 32, fontWeight: 900, color: "#e0f8ff", letterSpacing: 5, textShadow: `0 0 24px ${prefs.accentColor}88`, margin: 0 }),
  subtitle:   { fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: "#3a80a0", letterSpacing: 4, marginTop: 6, textTransform: "uppercase" },
};