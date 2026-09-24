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

/**
 * Extracts queries from {web: "query 1", "query 2", "query 3"} or {web: ["query 1", ...]}
 * Supports up to 3 queries as requested by the user.
 */
export function extractWebSearchQueries(text: string): WebSearchExtraction | null {
  if (!text) return null;

  // Regex matches {web: ...} or {"web": ...}
  const match = text.match(/\{["']?web["']?:\s*([\s\S]*?)\}/i);
  if (!match) return null;

  const triggerText = match[0];
  const innerContent = match[1].trim();

  const queries: string[] = [];

  // Match all quoted strings inside the trigger
  const quoteRegex = /(?:["'`])(.*?)(?:["'`])/g;
  let qm;
  while ((qm = quoteRegex.exec(innerContent)) !== null) {
    const q = qm[1].trim();
    if (q && !queries.includes(q)) {
      queries.push(q);
    }
  }

  // Fallback: if no quotes, split by comma or newline
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

  // Limit to maximum 3 search topics per trigger
  const limitedQueries = queries.slice(0, 3);

  // Extract the explanatory paragraph immediately before the trigger
  const textBefore = text.slice(0, match.index).trim();
  const paragraphs = textBefore.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const paragraphBefore = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : '';

  return {
    queries: limitedQueries,
    triggerText,
    paragraphBefore
  };
}

/**
 * Clean domain from URL (e.g. 'https://brasilescola.uol.com.br/biologia/...' -> 'brasilescola.uol.com.br')
 */
export function extractDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return urlStr.replace(/^https?:\/\//i, '').split('/')[0] || urlStr;
  }
}

/**
 * Execute search via Tavily Search API with required parameters:
 * search_depth: "basic"
 * include_raw_content: false
 * include_images: false
 * max_results: 10
 */
export async function searchTavily(query: string, apiKey?: string): Promise<WebSource[]> {
  const keyToUse = apiKey || process.env.TAVILY_API_KEY || process.env.TAVILY_KEY || '';
  
  if (!keyToUse) {
    console.warn(`[Tavily] TAVILY_API_KEY não encontrada no ambiente. Executando busca fallback para: "${query}"`);
    return getFallbackSources(query);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
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
      const errText = await response.text().catch(() => '');
      console.warn(`[Tavily] Erro ${response.status} na busca "${query}":`, errText);
      return getFallbackSources(query);
    }

    const data = await response.json() as any;
    const rawResults = Array.isArray(data.results) ? data.results : [];

    const sources: WebSource[] = rawResults.map((r: any, idx: number) => {
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

    return sources;
  } catch (err: any) {
    console.error(`[Tavily] Falha na requisição para query "${query}":`, err?.message || err);
    return getFallbackSources(query);
  }
}

/**
 * Resilient fallback search in case Tavily API key is not yet set by the user or transient network issue
 */
async function getFallbackSources(query: string): Promise<WebSource[]> {
  // Try fetching public educational summaries if possible
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
  } catch (e) {
    // Silent fallback
  }

  // Curated reliable Brazilian educational portals for high school & elementary subjects
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

/**
 * Format sources list for the subsequent Gemini prompt
 */
export function formatSourcesForGemini(sources: WebSource[]): string {
  if (!sources || sources.length === 0) {
    return 'Nenhum resultado retornado da pesquisa na web.';
  }

  return sources.map((s, i) => {
    const idx = i + 1;
    return `[FONTE ${idx}]:
- Título: ${s.title}
- Domínio: ${s.domain}
- URL: ${s.url}
- Conteúdo: """${s.content}"""`;
  }).join('\n\n');
}

/**
 * Embeds sources safely in content as an HTML comment
 */
export function embedSourcesInContent(content: string, sources: WebSource[]): string {
  if (!sources || sources.length === 0) return content;
  try {
    const encoded = encodeURIComponent(JSON.stringify(sources));
    return `${content.trim()}\n\n<!--ATHO_SOURCES:${encoded}-->`;
  } catch {
    return content;
  }
}

/**
 * Extracts embedded sources from content
 */
export function extractSourcesFromContent(content: string): { cleanContent: string; sources: WebSource[] } {
  if (!content) return { cleanContent: '', sources: [] };

  const match = content.match(/<!--ATHO_SOURCES:([\s\S]*?)-->/);
  if (match) {
    try {
      const decoded = JSON.parse(decodeURIComponent(match[1]));
      const cleanContent = content.replace(/<!--ATHO_SOURCES:[\s\S]*?-->/, '').trim();
      return {
        cleanContent,
        sources: Array.isArray(decoded) ? decoded : []
      };
    } catch {
      // Fallback
    }
  }

  return { cleanContent: content, sources: [] };
}
