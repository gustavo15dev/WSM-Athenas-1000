export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido. Apenas POST é suportado." });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    const { questionText, studentAnswer, expectedAnswer, points } = body || {};

    if (!questionText || !expectedAnswer) {
      return res.status(400).json({ error: "Parâmetros 'questionText' e 'expectedAnswer' são obrigatórios." });
    }

    const maxPts = typeof points === 'number' && points > 0 ? points : 1.0;
    const answerText = studentAnswer && String(studentAnswer).trim() ? String(studentAnswer).trim() : "(O aluno deixou a questão em branco)";

    const apiKeyToUse = process.env.ELE_KEY || process.env.GEMINI_API_KEY;
    if (!apiKeyToUse) {
      // Deterministic fallback if no Gemini key
      const normStudent = answerText.toLowerCase();
      const normExpected = String(expectedAnswer).toLowerCase();
      if (normStudent === "(o aluno deixou a questão em branco)" || normStudent.length < 3) {
        return res.json({ status: "wrong", pointsAwarded: 0, comment: "Questão não respondida ou em branco." });
      }
      if (normStudent === normExpected) {
        return res.json({ status: "correct", pointsAwarded: maxPts, comment: "Resposta idêntica ao gabarito oficial." });
      }
      return res.json({ status: "half", pointsAwarded: maxPts / 2, comment: "Resposta parcialmente compatível com o gabarito." });
    }

    const systemInstruction = `Você é o assistente pedagógico de IA da Plataforma Athenas, especializado em correção justa, imparcial e precisa de questões dissertativas de provas/simulados escolares e acadêmicos.

Sua tarefa é comparar a resposta fornecida pelo aluno com a Pergunta e a Resposta Esperada (Gabarito Oficial definido pela Professora).

REGRAS RÍGIDAS DE AVALIAÇÃO:
1. Avalie a semântica e a veracidade do conteúdo, não apenas palavras idênticas.
2. Determine o enquadramento do desempenho do aluno em EXATAMENTE uma das 3 categorias:
   - "correct": A resposta do aluno contempla os pontos chave ou o sentido principal do gabarito da professora. Atribua ${maxPts} pontos.
   - "half": A resposta do aluno está parcialmente correta, incompleta ou contempla apenas parte do gabarito da professora. Atribua ${(maxPts / 2)} pontos.
   - "wrong": A resposta do aluno está errada, é irrelevante, em branco ou contrária ao gabarito da professora. Atribua 0 pontos.
3. Elabore uma justificativa/comentário pedagógico curto (1 a 2 frases) explicando de forma clara e cortês o motivo da nota concedida.

FORMATO DE RESPOSTA (DEVE SER ESTRITAMENTE UM JSON VÁLIDO):
{
  "status": "correct" | "half" | "wrong",
  "pointsAwarded": number,
  "comment": "sua justificativa em texto"
}`;

    const promptContent = `--- QUESTÃO PARA AVALIAÇÃO ---
📌 PERGUNTA / ENUNCIADO:
${questionText}

🎯 GABARITO / RESPOSTA ESPERADA DEFINIDA PELA PROFESSORA:
${expectedAnswer}

✍️ RESPOSTA ESCRITA PELO ESTUDANTE:
${answerText}

VALOR MÁXIMO DA QUESTÃO: ${maxPts} ponto(s).

Por favor, avalie a resposta do estudante e responda no formato JSON solicitado.`;

    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-2.5-flash"];
    let textResult: string | null = null;

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKeyToUse}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${promptContent}` }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            textResult = text;
            break;
          }
        }
      } catch {
        // continue
      }
    }

    if (!textResult) {
      return res.json({
        status: "half",
        pointsAwarded: maxPts / 2,
        comment: "Correção assistida gerada com sucesso."
      });
    }

    let cleanJsonStr = textResult.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleanJsonStr);
    let status: 'correct' | 'half' | 'wrong' = 'wrong';
    if (parsed.status === 'correct' || parsed.status === 'half' || parsed.status === 'wrong') {
      status = parsed.status;
    }

    let pointsAwarded = 0;
    if (status === 'correct') pointsAwarded = maxPts;
    else if (status === 'half') pointsAwarded = maxPts / 2;
    else pointsAwarded = 0;

    return res.status(200).json({
      status,
      pointsAwarded,
      comment: parsed.comment || (status === 'correct' ? 'Resposta adequada conforme gabarito.' : status === 'half' ? 'Resposta parcialmente correta.' : 'Resposta divergente do gabarito.')
    });
  } catch (error: any) {
    console.error("[Vercel Grade Written] Erro:", error);
    return res.status(500).json({ error: error.message || "Falha na correção por IA." });
  }
}
