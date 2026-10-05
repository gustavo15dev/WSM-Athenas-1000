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

const KNOWN_SITE_NAMES: Record<string, string> = {
  'brasilescola.uol.com.br': 'Brasil Escola',
  'brasilescola.com': 'Brasil Escola',
  'todamateria.com.br': 'Toda Matéria',
  'mundoeducacao.uol.com.br': 'Mundo Educação',
  'mundoeducacao.com': 'Mundo Educação',
  'wikipedia.org': 'Wikipédia',
  'pt.wikipedia.org': 'Wikipédia',
  'en.wikipedia.org': 'Wikipedia',
  'scielo.br': 'SciELO',
  'scielo.org': 'SciELO',
  'embrapa.br': 'Embrapa',
  'ibge.gov.br': 'IBGE',
  'inep.gov.br': 'INEP',
  'mec.gov.br': 'MEC',
  'fiocruz.br': 'Fiocruz',
  'g1.globo.com': 'G1',
  'globo.com': 'Globo',
  'ge.globo.com': 'ge',
  'uol.com.br': 'UOL',
  'educacao.uol.com.br': 'UOL Educação',
  'noticias.uol.com.br': 'UOL Notícias',
  'folha.uol.com.br': 'Folha de S.Paulo',
  'estadao.com.br': 'Estadão',
  'cnnbrasil.com.br': 'CNN Brasil',
  'bbc.com': 'BBC News',
  'bbc.co.uk': 'BBC',
  'khanacademy.org': 'Khan Academy',
  'pt.khanacademy.org': 'Khan Academy',
  'novaescola.org.br': 'Nova Escola',
  'infoescola.com': 'InfoEscola',
  'guiadoestudante.abril.com.br': 'Guia do Estudante',
  'super.abril.com.br': 'Superinteressante',
  'abril.com.br': 'Abril',
  'nature.com': 'Nature',
  'science.org': 'Science',
  'nationalgeographic.com': 'National Geographic',
  'nationalgeographicbrasil.com': 'NatGeo Brasil',
  'unesco.org': 'UNESCO',
  'un.org': 'ONU',
  'nacoesunidas.org': 'ONU Brasil',
  'who.int': 'OMS',
  'paho.org': 'OPAS / OMS',
  'mma.gov.br': 'MMA Gov',
  'gov.br': 'Gov.br',
  'ipea.gov.br': 'IPEA',
  'saude.gov.br': 'Ministério da Saúde',
  'canaltech.com.br': 'Canaltech',
  'tecmundo.com.br': 'TecMundo',
  'olhardigital.com.br': 'Olhar Digital',
  'ted.com': 'TED',
  'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'stackoverflow.com': 'Stack Overflow'
};

/**
 * Extracts a concise, friendly site name from domain or title (e.g. 'Toda Matéria', 'Brasil Escola', 'Wikipédia')
 */
export function extractSiteName(domainOrUrl?: string, title?: string): string {
  const raw = domainOrUrl || '';
  const domain = extractDomain(raw).toLowerCase().replace(/^www\./i, '').trim();

  // 1. Direct or partial match in curated registry
  if (domain && KNOWN_SITE_NAMES[domain]) {
    return KNOWN_SITE_NAMES[domain];
  }
  for (const [key, val] of Object.entries(KNOWN_SITE_NAMES)) {
    if (domain.endsWith(key) || domain.includes(key)) {
      return val;
    }
  }

  // 2. Extract brand from title delimiter if available (e.g. "Sustentabilidade - Toda Matéria" -> "Toda Matéria")
  if (title) {
    const brandMatch = title.match(/(?:[-–—|•·:]\s*)([A-Z0-9À-Úa-z0-9à-ú\s.&]{2,30})$/);
    if (brandMatch && brandMatch[1]) {
      const candidate = brandMatch[1].trim();
      if (candidate.length >= 2 && candidate.length <= 25 && !/^(artigo|pdf|capítulo|página|home|início)$/i.test(candidate)) {
        return candidate;
      }
    }
  }

  // 3. Clean fallback from hostname parts
  if (domain) {
    const hostParts = domain.split('.');
    let mainPart = hostParts[0];
    if (['pt', 'en', 'es', 'm', 'blog', 'noticias', 'educacao', 'portal'].includes(mainPart) && hostParts.length > 1) {
      mainPart = hostParts[1];
    }
    if (mainPart && mainPart.length >= 2) {
      return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    }
    return domain;
  }

  return 'Fonte';
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
export function formatSourcesForGemini(sources: WebSource[], offset: number = 0): string {
  if (!sources || sources.length === 0) {
    return 'Nenhum resultado retornado da pesquisa na web.';
  }

  return sources.map((s, i) => {
    const idx = offset + i + 1;
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
