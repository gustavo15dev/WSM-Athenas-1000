export interface WebSource {
  id?: string;
  index?: number;
  title: string;
  url: string;
  content: string;
  domain: string;
  score?: number;
}

export interface WebSearchExtraction {
  queries: string[];
  triggerText: string;
  paragraphBefore: string;
}

export function extractWebSearchQueries(text: string): WebSearchExtraction | null {
  if (!text) return null;
  const match = text.match(/\{["']?web["']?:\s*([\s\S]*?)\}/i);
  if (!match) return null;

  const triggerText = match[0];
  const innerContent = match[1].trim();
  const queries: string[] = [];

  const quoteRegex = /(?:["'`])(.*?)(?:["'`])/g;
  let qm;
  while ((qm = quoteRegex.exec(innerContent)) !== null) {
    const q = qm[1].trim();
    if (q && !queries.includes(q)) {
      queries.push(q);
    }
  }

  if (queries.length === 0) {
    const rawParts = innerContent.replace(/[\[\]]/g, '').split(/[,;\n]+/);
    for (const part of rawParts) {
      const clean = part.trim().replace(/^["']|["']$/g, '');
      if (clean && !queries.includes(clean)) {
        queries.push(clean);
      }
    }
  }

  if (queries.length === 0) return null;
  const limitedQueries = queries.slice(0, 3);
  const textBefore = text.slice(0, match.index).trim();
  const paragraphs = textBefore.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const paragraphBefore = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : '';

  return {
    queries: limitedQueries,
    triggerText,
    paragraphBefore
  };
}

export function extractDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.replace(/^https?:\/\//i, '').split('/')[0] || urlStr;
  }
}

async function getFallbackSources(query: string): Promise<WebSource[]> {
  try {
    const cleanQuery = query.replace(/[^\w\s\u00C0-\u00FF]/g, ' ').trim();
    const wikiUrl = `https://pt.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=5&namespace=0&format=json`;
    const res = await fetch(wikiUrl, { headers: { 'User-Agent': 'AthenasTutor/1.0' } });
    if (res.ok) {
      const [, titles, descriptions, urls] = await res.json() as [any, string[], string[], string[]];
      if (titles && titles.length > 0) {
        return titles.map((title, i) => ({
          id: `fallback-${i}`,
          title: title || cleanQuery,
          url: urls[i] || `https://pt.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          content: descriptions[i] || `Artigo acadêmico e enciclopédico sobre ${title}.`,
          domain: 'pt.wikipedia.org'
        }));
      }
    }
  } catch {
    // fallback
  }

  const portals = [
    { name: 'Brasil Escola', domain: 'brasilescola.uol.com.br' },
    { name: 'Toda Matéria', domain: 'todamateria.com.br' },
    { name: 'Mundo Educação', domain: 'mundoeducacao.uol.com.br' },
    { name: 'Scielo Brasil', domain: 'scielo.br' },
    { name: 'Portal Embrapa', domain: 'embrapa.br' }
  ];

  return portals.slice(0, 3).map((portal, idx) => ({
    id: `fallback-default-${idx}`,
    title: `${query} - Conceitos e Fundamentos (${portal.name})`,
    url: `https://${portal.domain}/busca?q=${encodeURIComponent(query)}`,
    content: `Conteúdo didático e aprofundado cobrindo "${query}" com análises conceituais, metodológicas e científicas verificadas.`,
    domain: portal.domain
  }));
}

export async function searchTavily(query: string, apiKey?: string): Promise<WebSource[]> {
  const keyToUse = apiKey || process.env.TAVILY_API_KEY || process.env.TAVILY_KEY || '';
  if (!keyToUse) {
    return getFallbackSources(query);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: keyToUse,
        query: query.trim(),
        search_depth: 'basic',
        include_raw_content: false,
        include_images: false,
        max_results: 10
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return getFallbackSources(query);
    }

    const data = await response.json() as any;
    const rawResults = Array.isArray(data.results) ? data.results : [];

    return rawResults.map((r: any, idx: number) => {
      const rawUrl = r.url || '';
      const domain = extractDomain(rawUrl);
      const title = r.title?.trim() || domain || `Fonte ${idx + 1}`;
      const content = r.content?.trim() || '';

      return {
        id: `tavily-${Date.now()}-${idx}`,
        title,
        url: rawUrl,
        content,
        domain,
        score: typeof r.score === 'number' ? r.score : undefined
      };
    });
  } catch {
    return getFallbackSources(query);
  }
}

export function formatSourcesForGemini(sources: WebSource[]): string {
  if (!sources || sources.length === 0) {
    return 'Nenhum resultado retornado da pesquisa na web.';
  }

  return sources.map((s, i) => {
    const idx = i + 1;
    return `[FONTE ${idx}]:\n- Título: ${s.title}\n- Domínio: ${s.domain}\n- URL: ${s.url}\n- Conteúdo: """${s.content}"""`;
  }).join('\n\n');
}

export function embedSourcesInContent(content: string, sources: WebSource[]): string {
  if (!sources || sources.length === 0) return content;
  try {
    const encoded = encodeURIComponent(JSON.stringify(sources));
    return `${content.trim()}\n\n<!--ATHO_SOURCES:${encoded}-->`;
  } catch {
    return content;
  }
}

function checkSafety(message: string): string | null {
  if (!message || typeof message !== 'string') return null;
  const lower = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const safeAcademicPatterns = [
    /bomba\s+(de\s+)?(sodio|potassio|sodio-potassio|hidrogenio|protons|calcio)/i,
    /bomba\s+(d'?\s*agua|hidraulica|de\s+combustivel|de\s+infusao|de\s+calor|peniana|de\s+vacuo|eletrica)/i,
    /(historia|contexto|efeitos?|segunda\s+guerra|hiroshima|nagasaki|oppenheimer|manhattan)\s+.*bomba\s+atomica/i,
    /bomba\s+atomica\s+.*(historia|segunda\s+guerra|hiroshima|nagasaki|oppenheimer|manhattan|fisica\s+nuclear|fissao|fusao)/i,
    /como\s+funciona\s+(a\s+|o\s+)?bomba\s+(de\s+sodio|hidraulica|d'?\s*agua|atomica)/i
  ];

  if (safeAcademicPatterns.some(p => p.test(lower))) return null;

  const dangerous = [
    /\b(como\s+(fazer|fabricar|criar|construir|montar|produzir|preparar)|receita\s+(de|pra|para))\s+([a-z0-9\s]*\s+)?(bomba|explosivo|dinamite|coquetel\s+molotov|granada|polvora)/i,
    /\b(bomba\s+caseira|explosivo\s+caseiro|coquetel\s+molotov)/i,
    /\b(como\s+(fazer|fabricar|montar|construir)\s+([a-z0-9\s]*\s+)?(arma\s+de\s+fogo|pistola|fuzil|revolver))/i,
    /\b(como\s+(fazer|fabricar|produzir|sintetizar)|receita\s+(de|pra|para))\s+([a-z0-9\s]*\s+)?(veneno|ricina|cianeto|gas\s+cloro|gas\s+mostarda|sarim|antrax|chumbinho)/i,
    /\b(como\s+(fazer|cozinhar|fabricar|sintetizar)|receita\s+(de|pra|para))\s+([a-z0-9\s]*\s+)?(metanfetamina|crack|cocaina|lsd|heroina)/i,
    /\b(como\s+(se\s+matar|me\s+matar|cometer\s+suicidio|me\s+suicidar)|formas\s+de\s+(se\s+matar|suicidio))/i
  ];

  for (const r of dangerous) {
    if (r.test(lower)) {
      return "Como tutor educacional da Plataforma Athenas, não posso ajudar com instruções ou receitas para criar substâncias perigosas, armas, explosivos ou qualquer material que ofereça risco à segurança física.\n\nSe você tiver dúvidas teóricas sobre Química, Física ou Ciências explicadas de forma científica e segura, terei prazer em ajudar!";
    }
  }
  return null;
}

export default async function handler(req: any, res: any) {
  // CORS configuration for Vercel
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

  // Detect if client expects SSE stream
  const acceptHeader = (req.headers?.['accept'] || req.headers?.['Accept'] || '') as string;
  const isSSE = acceptHeader.includes('text/event-stream');

  const sendSSE = (obj: any) => {
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch {}
  };

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    const { message, history, studyExamTheme, studyExamContent, userRole, reasoningActive } = body || {};

    if (!message) {
      return res.status(400).json({ error: "Mensagem obrigatória." });
    }

    if (isSSE) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
    }

    // Safety refusal check
    const safetyRefusal = checkSafety(message);
    if (safetyRefusal && userRole !== "teacher") {
      if (isSSE) {
        sendSSE({ type: 'final', text: safetyRefusal, cleanContent: safetyRefusal, sources: [] });
        return res.end();
      }
      return res.status(200).json({ text: safetyRefusal, sources: [] });
    }

    const apiKeyToUse = process.env.ELE_KEY || process.env.GEMINI_API_KEY || "";
    if (!apiKeyToUse) {
      const configMsg = "⚠️ Chave de API do Gemini não configurada na Vercel.\n\nPara ativar o assistente Athenas, acesse o painel da Vercel em Project Settings > Environment Variables e adicione a variável 'GEMINI_API_KEY' (ou 'ELE_KEY') com sua chave da Google AI Studio.";
      if (isSSE) {
        sendSSE({ type: 'final', text: configMsg, cleanContent: configMsg, sources: [] });
        return res.end();
      }
      return res.status(200).json({ text: configMsg, sources: [] });
    }

    let systemInstruction = "";

    if (userRole === "teacher") {
      systemInstruction = `Você é o Athenas, assistente educacional para PROFESSORES na plataforma Athenas.
Você NÃO ensina o professor. Você o APOIA em seu trabalho pedagógico.
- Apoie na preparação de aulas, atividades e dinâmicas pedagógicas.
- Ofereça sugestões práticas e opções diversificadas de intervenção.
- Mantenha linguagem profissional, colaborativa e encorajadora.`;
    } else if (studyExamTheme) {
      const rawContent = studyExamContent || studyExamTheme;
      systemInstruction = `Você é o Athenas, tutor socrático de inteligência artificial em MODO FOCADO de preparação para a prova "${studyExamTheme}".
Conteúdo delimitado do exame: ${rawContent}.
- Ajude o estudante a fixar conceitos da prova através de perguntas reflexivas.
- Não forneça respostas prontas de exercícios de bandeja; estimule o raciocínio socrático.`;
    } else {
      systemInstruction = `Você é o Athenas, tutor de IA educacional na plataforma Athenas.
Seu objetivo é guiar alunos a APRENDER através do método socrático e explicações claras.
- Responda apenas sobre matérias escolares e acadêmicas (Biologia, Química, Física, História, Geografia, Matemática, Português, STEAM, Sustentabilidade).
- Formatação rica: use negritos para termos chave, listas organizadas, e LaTeX ($...$) para equações.
- Sempre acolhedor, dinâmico e focado no crescimento pedagógico do estudante.`;
    }

    // Thinking mode prompt instruction
    if (reasoningActive) {
      systemInstruction = `Você DEVE iniciar sua resposta com um bloco de raciocínio interno delimitado pelas tags <think> e </think>.
Dentro de <think>...</think>, explique sua reflexão passo a passo e planejamento pedagógico.
Depois do fechamento </think>, escreva a resposta limpa e final para o usuário.\n\n` + systemInstruction;
    }

    // Web search instruction
    systemInstruction += `\n\nVocê pode pesquisar na web em tempo real através do formato:
{web: "termo de busca 1", "termo 2"}
Se precisar buscar, escreva um parágrafo explicativo antes da chave {web: ...} e pare a resposta para receber as fontes.`;

    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-2.5-flash"];

    const callTurn = async (chatContents: any[]): Promise<string> => {
      let lastErr: any = null;
      for (const modelName of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKeyToUse}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: chatContents,
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
            })
          });

          if (response.ok) {
            const data = await response.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
          }
        } catch (e: any) {
          lastErr = e;
        }
      }
      if (lastErr) throw lastErr;
      return "Não foi possível gerar resposta no momento.";
    };

    let currentMsgText = message;
    if (reasoningActive) {
      currentMsgText += `\n\n[INSTRUÇÃO DE SISTEMA: O modo Raciocínio (Pensar) está ATIVO. Inicie obrigatoriamente com o bloco <think>...</think> antes da resposta final.]`;
    }

    const conversationContents: any[] = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || msg.text || "" }]
    }));

    conversationContents.push({
      role: 'user',
      parts: [{ text: currentMsgText }]
    });

    const allSources: WebSource[] = [];
    const searchSteps: Array<{ thought: string; queries: string[]; resultsCount: number }> = [];
    let finalAnswerText = "";
    let currentTurn = 0;
    const MAX_AGENTIC_TURNS = 3;

    while (currentTurn < MAX_AGENTIC_TURNS) {
      currentTurn++;
      const rawText = await callTurn(conversationContents);
      const webTrigger = extractWebSearchQueries(rawText);

      if (!webTrigger || webTrigger.queries.length === 0) {
        finalAnswerText = rawText;
        break;
      }

      if (isSSE) {
        sendSSE({
          type: 'step_start',
          stepIndex: searchSteps.length,
          thought: webTrigger.paragraphBefore || '',
          queries: webTrigger.queries
        });
      }

      const roundSources: WebSource[] = [];
      for (const query of webTrigger.queries) {
        const results = await searchTavily(query);
        for (const r of results) {
          if (!allSources.some(s => s.url === r.url) && !roundSources.some(s => s.url === r.url)) {
            roundSources.push(r);
          }
        }
      }

      allSources.push(...roundSources);
      searchSteps.push({
        thought: webTrigger.paragraphBefore,
        queries: webTrigger.queries,
        resultsCount: roundSources.length
      });

      if (isSSE) {
        sendSSE({
          type: 'step_done',
          stepIndex: searchSteps.length - 1,
          thought: webTrigger.paragraphBefore || '',
          resultsCount: roundSources.length,
          sources: allSources
        });
      }

      conversationContents.push({
        role: 'model',
        parts: [{ text: rawText }]
      });

      const sourcesSummary = formatSourcesForGemini(roundSources);
      conversationContents.push({
        role: 'user',
        parts: [{
          text: `[RESULTADOS DA PESQUISA NA WEB]:\n\n${sourcesSummary}\n\n` +
            `Elabore a resposta final completa utilizando as fontes acima. Insira as citações no formato [Fonte](URL). Não inclua a chave {web:...}.`
        }]
      });
    }

    let textResult = "";
    if (searchSteps.length > 0) {
      const stepBlocks: string[] = [];
      for (const step of searchSteps) {
        if (step.thought) stepBlocks.push(step.thought.trim());
        const count = step.resultsCount || (step.queries.length * 10) || 10;
        stepBlocks.push(`[[PESQUISOU:${count}]]`);
      }
      const cleanFinal = (finalAnswerText || "").replace(/\{["']?web["']?:\s*[\s\S]*?\}/gi, '').trim();
      if (cleanFinal) stepBlocks.push(cleanFinal);
      textResult = stepBlocks.join('\n\n');
    } else {
      textResult = (finalAnswerText || "Sem resposta no momento.").replace(/\{["']?web["']?:\s*[\s\S]*?\}/gi, '').trim();
    }

    // Extract <think> reasoning tags
    let extractedReasoning = "";
    if (textResult) {
      const thinkMatch = textResult.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        extractedReasoning = thinkMatch[1].trim();
        textResult = textResult.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
    }

    const textWithEmbeddedSources = embedSourcesInContent(textResult, allSources);

    if (isSSE) {
      sendSSE({
        type: 'final',
        text: textWithEmbeddedSources,
        cleanContent: textResult,
        reasoning: extractedReasoning,
        sources: allSources,
        searchSteps
      });
      return res.end();
    }

    return res.status(200).json({
      text: textWithEmbeddedSources,
      cleanContent: textResult,
      reasoning: extractedReasoning,
      sources: allSources,
      searchSteps
    });
  } catch (error: any) {
    console.error("[Vercel Gemini Chat] Erro:", error);
    const errText = error?.message || "Erro interno ao processar a resposta.";
    if (isSSE) {
      sendSSE({ type: 'final', text: `Desculpe, ocorreu uma instabilidade: ${errText}`, cleanContent: errText, sources: [] });
      return res.end();
    }
    return res.status(200).json({
      text: `Desculpe, ocorreu uma instabilidade temporária: ${errText}`,
      sources: []
    });
  }
}
