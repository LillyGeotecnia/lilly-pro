ARCHIVOS A PEGAR EN TU PROYECTO LILLY

1) Reemplaza app/page.tsx por:
   page.tsx

2) Crea/Reemplaza estos archivos:
   app/api/analizar-imagen/route.ts
   app/api/entrenar-modelo/route.ts
   app/api/estado-entrenamiento/route.ts

3) Instala dependencia si no la tienes:
   npm install openai xlsx jspdf

4) En .env.local deja:
   OPENAI_API_KEY=tu_api_key
   OPENAI_FINE_TUNE_BASE_MODEL=gpt-4o-2024-08-06
   OPENAI_LILLY_MODEL=

5) Flujo:
   - Entra a pestaña Aprendizaje IA.
   - Sube imagen.
   - Analiza con IA.
   - Ingresa RMD/JPS/JPO reales corregidos.
   - Guarda caso.
   - Junta mínimo 10 casos validados; recomendado 50+.
   - Presiona Entrenar modelo real.
   - Cuando termine el job, revisa el fine_tuned_model con /api/estado-entrenamiento o desde OpenAI.
   - Copia el modelo final en OPENAI_LILLY_MODEL.
   - Reinicia npm run dev.

IMPORTANTE:
Si tu cuenta no tiene habilitado fine-tuning visual, OpenAI rechazará el job. El código ya está preparado, pero el acceso depende de tu cuenta/proyecto OpenAI.
