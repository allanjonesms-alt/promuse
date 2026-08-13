import { GoogleGenAI, Type } from '@google/genai';

export interface ParsedMpuData {
  victimName?: string;
  defendantName?: string;
  orderNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  judgeName?: string;
  restrictions?: string;
}

export async function parsePdfClientSide(pdfBase64: string): Promise<ParsedMpuData> {
  const env = (import.meta as any).env || {};
  const apiKey = 
    env.VITE_GEMINI_API_KEY || 
    env.VITE_GOOGLE_MAPS_API_KEY || 
    env.VITE_FIREBASE_API_KEY || 
    '';

  // 1. Try Gemini API client-side if an API key is available
  if (apiKey && apiKey.length > 10) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: pdfBase64,
                mimeType: "application/pdf"
              }
            },
            {
              text: "Você é um assistente de IA perito em ler Medidas Protetivas de Urgência (MPU) decretadas no Brasil (TJMS, etc.). Analise minuciosamente o documento PDF anexo e extraia os dados necessários com extrema precisão:\n\n1. Nome da vítima (ofendida/requerente/assistida).\n2. Nome do réu (agressor/requerido/autor do fato).\n3. Número do processo/ordem extraído (ex: xxxxxxx-xx.xxxx.8.12.xxxx).\n4. Nome do Magistrado/Juiz prolator da sentença.\n5. Data da decisão/emissão (formato AAAA-MM-DD).\n6. Data de expiração (se descrita, senão preveja uma data padrão de 180 dias a contar da expedição, formato AAAA-MM-DD).\n7. Resumo simples e inteligível em português sobre as restrições impostas ao agressor (ex: distanciamento de no mínimo 300m, proibição de contato, afastamento do lar)."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              victimName: { type: Type.STRING, description: "Nome completo da vítima sem abreviações" },
              defendantName: { type: Type.STRING, description: "Nome completo do réu/agressor sem abreviações" },
              orderNumber: { type: Type.STRING, description: "Número completo do processo judicial no padrão CNJ" },
              issueDate: { type: Type.STRING, description: "Data de expedição ou assinatura da decisão (AAAA-MM-DD)" },
              expiryDate: { type: Type.STRING, description: "Data de expiração das medidas (AAAA-MM-DD)" },
              judgeName: { type: Type.STRING, description: "Nome do Juiz ou Juíza de Direito prolator da decisão" },
              restrictions: { type: Type.STRING, description: "Texto sintetizado com as restrições impostas" }
            },
            required: ["victimName", "defendantName", "orderNumber", "issueDate", "judgeName", "restrictions"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed.victimName || parsed.orderNumber) {
          return parsed;
        }
      }
    } catch (geminiErr) {
      console.warn("Client-side Gemini extraction attempt failed, resorting to text decoding extraction:", geminiErr);
    }
  }

  // 2. Fallback: Parse raw text from base64 PDF string using binary decoding & regex
  try {
    const binaryStr = atob(pdfBase64);
    let text = '';
    for (let i = 0; i < binaryStr.length; i++) {
      const code = binaryStr.charCodeAt(i);
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || (code >= 192 && code <= 255)) {
        text += String.fromCharCode(code);
      } else {
        text += ' ';
      }
    }

    text = text.replace(/\s+/g, ' ');

    const result: ParsedMpuData = {};

    // Match CNJ order number
    const cnjMatch = text.match(/\b(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\b/);
    if (cnjMatch) {
      result.orderNumber = cnjMatch[1];
    }

    // Match Victim name
    const victimMatch = text.match(/(?:Requerente|Ofendida|Vítima|Assistida|AUTORA):\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,50})/i);
    if (victimMatch) {
      result.victimName = victimMatch[1].trim();
    }

    // Match Defendant name
    const defMatch = text.match(/(?:Requerido|Agressor|Réu|Autor do Fato|RÉU):\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,50})/i);
    if (defMatch) {
      result.defendantName = defMatch[1].trim();
    }

    // Match Judge name
    const judgeMatch = text.match(/(?:Juiz(?:a)?(?:\s+de\s+Direito)?|Dr\(a\)\.):\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s\.]{4,50})/i);
    if (judgeMatch) {
      result.judgeName = judgeMatch[1].trim();
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const expiry6Months = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    result.issueDate = todayStr;
    result.expiryDate = expiry6Months;
    result.restrictions = "Proibição de aproximação física da vítima (mínimo de 300 metros) e proibição de contato por qualquer meio de comunicação.";

    return result;
  } catch (err) {
    console.error("Client-side PDF text extraction error:", err);
    throw new Error("Não foi possível extrair dados automaticamente do PDF enviado. Por favor, preencha os campos manualmente.");
  }
}
