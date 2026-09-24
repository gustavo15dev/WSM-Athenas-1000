import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { 
  Copy, Check, Download, Terminal, Lightbulb, 
  AlertTriangle, Info, Sparkles, CheckCircle2, XCircle, 
  Target, Quote, ExternalLink, Globe, Loader2 
} from 'lucide-react';
import { WebSource, extractDomain } from '../utils/tavilyAgent';

const EXTENSION_MAP: Record<string, string> = {
  js: 'js',
  javascript: 'js',
  ts: 'ts',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'py',
  python: 'py',
  html: 'html',
  css: 'css',
  json: 'json',
  sql: 'sql',
  sh: 'sh',
  bash: 'sh',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  cs: 'cs',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  php: 'php',
  ruby: 'rb',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  markdown: 'md',
  md: 'md',
  text: 'txt',
  txt: 'txt'
};

/**
 * Recursively extracts plain text from React nodes (used for copying and downloading code).
 */
function extractTextFromNodes(node: React.ReactNode): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return node.map(extractTextFromNodes).join('');
  }
  if (React.isValidElement(node)) {
    return extractTextFromNodes((node.props as any)?.children);
  }
  return '';
}

/**
 * Pre-processes markdown string to normalize:
 * - LaTeX delimiters \[...\] and \(...\) to $$...$$ and $...$
 * - Tab-separated text tables into GFM Markdown tables
 * - Checkboxes (☐, ☑, [ ], [x]) to GFM task lists
 * - Custom list markers (a., a), 1), I., i.) to styled list bullet items
 * - Highlight tags (==text==) to <mark class="athenas-mark">text</mark>
 * - Standalone raw URLs into clickable markdown links
 */
export function preprocessMarkdown(text: string, sources?: WebSource[]): string {
  if (!text) return '';

  const normalized = text
    .normalize('NFC')
    .replace(/áôÁêâôÁê/g, '')
    .replace(/[\uFFFD]/g, '');

  // Split content by code blocks so we NEVER modify code blocks with markdown regexes
  const parts = normalized.split(/(```[\s\S]*?```)/g);

  const processedParts = parts.map((part, index) => {
    // Odd index is inside triple-backtick code block - leave unchanged
    if (index % 2 === 1) {
      return part;
    }

    let segment = part;

    // 0. Auto-convert numbered citations like [1], [2], [[1]] if sources are provided
    if (sources && sources.length > 0) {
      segment = segment.replace(/(?<!\[)\[\[?(\d{1,2})\]?\](?!\()/g, (match, numStr) => {
        const idx = parseInt(numStr, 10) - 1;
        if (idx >= 0 && idx < sources.length) {
          const src = sources[idx];
          const tagLabel = src.domain || src.title || `Fonte ${numStr}`;
          return `[${tagLabel}](${src.url})`;
        }
        return match;
      });
    }

    // 0.1 Transform [[PESQUISOU:X]] into search step badge
    segment = segment.replace(/\[\[PESQUISOU:(\d+)\]\]/g, (_match, numStr) => {
      return `\n\n<div class="athenas-search-step-badge" data-sites="${numStr}">Pesquisou em ${numStr} sites</div>\n\n`;
    });

    // 0.15 Transform [[PESQUISANDO]] into real-time searching badge
    segment = segment.replace(/\[\[PESQUISANDO\]\]/g, () => {
      return `\n\n<div class="athenas-search-step-badge searching" data-searching="true">Pesquisando na web</div>\n\n`;
    });

    // 0.2 Transform any raw {web: ...} or {"web": ...} trigger into search step badge
    segment = segment.replace(/\{["']?web["']?:\s*([\s\S]*?)\}/gi, (_match, inner) => {
      const quoteCount = (inner.match(/["'`]/g) || []).length / 2;
      const estimatedCount = Math.max(1, Math.min(3, Math.floor(quoteCount) || 1)) * 10;
      return `\n\n<div class="athenas-search-step-badge" data-sites="${estimatedCount}">Pesquisou em ${estimatedCount} sites</div>\n\n`;
    });

    // 1. Convert LaTeX display math \[ ... \] to \n$$\n...\n$$\n
    segment = segment.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
      return `\n\n$$\n${math.trim()}\n$$\n\n`;
    });

    // 2. Convert LaTeX inline math \( ... \) to $ ... $
    segment = segment.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
      return `$${math.trim()}$`;
    });

    // 3. Convert unicode/raw checkboxes to standard markdown task lists
    segment = segment.replace(/^[ \t]*[☐□][ \t]+(.*)$/gm, '- [ ] $1');
    segment = segment.replace(/^[ \t]*[☑■✔][ \t]+(.*)$/gm, '- [x] $1');
    segment = segment.replace(/^[ \t]*\[ \][ \t]+(.*)$/gm, '- [ ] $1');
    segment = segment.replace(/^[ \t]*\[[xX]\][ \t]+(.*)$/gm, '- [x] $1');

    // 4. Convert ==text== to <mark class="athenas-mark">text</mark>
    segment = segment.replace(/==([^=\n]+)==/g, '<mark class="athenas-mark">$1</mark>');

    // 5. Convert tab-separated rows into Markdown tables
    const lines = segment.split('\n');
    const newLines: string[] = [];
    let tsvBuffer: string[] = [];

    const flushTsvBuffer = () => {
      if (tsvBuffer.length >= 2) {
        const rows = tsvBuffer.map(line => line.split('\t').map(c => c.trim()));
        const colCount = Math.max(...rows.map(r => r.length));
        if (colCount >= 2) {
          const header = '| ' + rows[0].map(c => c || '-').concat(Array(colCount - rows[0].length).fill('-')).join(' | ') + ' |';
          const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
          const bodyRows = rows.slice(1).map(r => 
            '| ' + r.map(c => c || '-').concat(Array(colCount - r.length).fill('-')).join(' | ') + ' |'
          );
          newLines.push('', header, separator, ...bodyRows, '');
          tsvBuffer = [];
          return;
        }
      }
      // If not a valid multi-column table, output original lines
      newLines.push(...tsvBuffer);
      tsvBuffer = [];
    };

    for (const line of lines) {
      if (line.includes('\t') && !line.trim().startsWith('|')) {
        tsvBuffer.push(line);
      } else {
        if (tsvBuffer.length > 0) {
          flushTsvBuffer();
        }
        newLines.push(line);
      }
    }
    if (tsvBuffer.length > 0) {
      flushTsvBuffer();
    }
    segment = newLines.join('\n');

    // 6. Support Custom List formats:
    // a. Item, a) Item, A. Item, A) Item
    // 1) Item, 2) Item
    // I. Item, II. Item, III. Item (Roman upper)
    // i. Item, ii. Item, iii. Item (Roman lower)
    // We convert them into markdown list items with custom bullet badges so nested indentation works seamlessly
    segment = segment.replace(
      /^([ \t]*)(?:[-*][ \t]+)?([a-zA-Z]\.|\([a-zA-Z]\)|[a-zA-Z]\)|\([0-9]+\)|[0-9]+\)|(?:X|IX|IV|V?I{1,3})\.|\([ivx]+\)|[ivx]+\.)\s+(.+)$/gm,
      '$1- <span class="athenas-custom-bullet">$2</span> $3'
    );

    // 7. Auto-linkify standalone raw URLs (https://... or http://...) that aren't already wrapped in markdown links or HTML tags
    segment = segment.replace(
      /(?<![\[(<\="'])(https?:\/\/[^\s<>"')]+(?<![.,;:?!]))(?![\])>"'])/g,
      '[$1]($1)'
    );

    return segment;
  });

  return processedParts.join('');
}

interface CodeBlockProps {
  language?: string;
  codeText: string;
  children?: React.ReactNode;
}

function CodeBlockComponent({ language, codeText, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const cleanLang = (language || 'código').toLowerCase().trim();
  const fileExt = EXTENSION_MAP[cleanLang] || 'txt';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy code block:', err);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([codeText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `codigo.${fileExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Failed to download code file:', err);
    }
  };

  const lines = codeText.split('\n');

  return (
    <div className="my-4 rounded-2xl border border-neutral-800 bg-[#0d1117] overflow-hidden shadow-2xl transition-all">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900/90 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2 font-mono text-emerald-400 font-semibold">
          <Terminal className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider text-[11px]">{cleanLang}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-medium"
            title={`Baixar código como arquivo .${fileExt}`}
          >
            <Download className="w-3 h-3" />
            <span>Baixar</span>
          </button>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-medium ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white'
            }`}
            title="Copiar código para a área de transferência"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copiar código</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="p-3 font-mono text-[13px] leading-relaxed overflow-x-auto flex">
        {/* Line Numbers Column */}
        <div className="select-none pr-4 text-right text-neutral-600 border-r border-neutral-800/80 font-mono text-xs shrink-0 py-0.5">
          {lines.map((_, idx) => (
            <div key={idx} className="leading-relaxed">{idx + 1}</div>
          ))}
        </div>

        {/* Code Content Area with Syntax Highlighting */}
        <div className="pl-4 flex-1 select-text overflow-x-auto py-0.5">
          <pre className="!bg-transparent !p-0 !m-0 font-mono text-neutral-200">
            <code className={language ? `hljs language-${language}` : 'hljs'}>
              {children || codeText}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

interface AthenasMarkdownRendererProps {
  content: string;
  sources?: WebSource[];
  onSelectSource?: (source: WebSource) => void;
}

export default function AthenasMarkdownRenderer({ 
  content, 
  sources, 
  onSelectSource 
}: AthenasMarkdownRendererProps) {
  const processed = preprocessMarkdown(content, sources);

  return (
    <div className="athenas-markdown-content text-neutral-200 leading-relaxed space-y-3 select-text w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw, 
          [rehypeKatex, { throwOnError: false, strict: false }], 
          rehypeHighlight
        ]}
        components={{
          // Título extra grande (#)
          h1({ children }) {
            return (
              <h1 className="text-2xl sm:text-3xl font-black text-emerald-400 mt-6 mb-3 font-display border-b border-neutral-800/80 pb-2.5 flex items-center gap-2">
                {children}
              </h1>
            );
          },
          // Título grande (##)
          h2({ children }) {
            return (
              <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-300 mt-5 mb-2.5 font-display flex items-center gap-2">
                {children}
              </h2>
            );
          },
          // Título médio (###)
          h3({ children }) {
            return (
              <h3 className="text-lg sm:text-xl font-bold text-neutral-100 mt-4 mb-2 font-display">
                {children}
              </h3>
            );
          },
          // Título pequeno (####)
          h4({ children }) {
            return (
              <h4 className="text-base font-bold text-neutral-200 mt-3.5 mb-1.5">
                {children}
              </h4>
            );
          },
          // Subtítulo (#####)
          h5({ children }) {
            return (
              <h5 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/90 mt-3 mb-1">
                {children}
              </h5>
            );
          },
          // Subsubtítulo (######)
          h6({ children }) {
            return (
              <h6 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mt-2.5 mb-1">
                {children}
              </h6>
            );
          },

          // Paragraph (Normal, short, and long)
          p({ children }) {
            return (
              <p className="mb-2.5 leading-relaxed text-[14px] md:text-[14.5px] text-neutral-200 break-words">
                {children}
              </p>
            );
          },

          // Emphasis: Negrito
          strong({ children }) {
            return <strong className="font-bold text-white tracking-wide">{children}</strong>;
          },

          // Emphasis: Itálico
          em({ children }) {
            return <em className="italic text-neutral-200">{children}</em>;
          },

          // Emphasis: Tachado
          del({ children }) {
            return <del className="line-through text-neutral-450 decoration-rose-500/70 decoration-1.5">{children}</del>;
          },

          // Lists
          ul({ children }) {
            return (
              <ul className="list-disc list-outside ml-5 space-y-1.5 my-2 text-neutral-200 text-[14px] md:text-[14.5px]">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal list-outside ml-5 space-y-1.5 my-2 text-neutral-200 text-[14px] md:text-[14.5px]">
                {children}
              </ol>
            );
          },
          li({ children, className }) {
            const childrenArray = React.Children.toArray(children);
            const firstChild: any = childrenArray[0];

            // Check if this list item has a custom bullet badge (e.g. a), b), I., 1))
            const hasCustomBullet = firstChild && (
              firstChild.props?.className?.includes('athenas-custom-bullet') ||
              (typeof firstChild === 'string' && firstChild.includes('athenas-custom-bullet'))
            );

            // Check if this is a GFM task list item
            const isTaskItem = className?.includes('task-list-item') || childrenArray.some((c: any) => c?.props?.type === 'checkbox');

            if (hasCustomBullet) {
              return (
                <li className="list-none -ml-5 pl-0 my-1 leading-relaxed flex items-start">
                  <div className="flex-1">{children}</div>
                </li>
              );
            }

            if (isTaskItem) {
              return (
                <li className="list-none -ml-5 pl-0 my-1 leading-relaxed flex items-start gap-2">
                  {children}
                </li>
              );
            }

            return <li className="leading-relaxed pl-1">{children}</li>;
          },

          // Task List Checkbox input
          input({ type, checked }) {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled
                  className="mr-2 rounded border-neutral-700 bg-neutral-900 text-emerald-500 accent-emerald-500 pointer-events-none align-middle w-4 h-4 mt-0.5 shrink-0"
                />
              );
            }
            return null;
          },

          // Blockquote & Structured Callouts (Dicas, Avisos, Notas, Exemplos, Vantagens, etc.)
          blockquote({ children }) {
            const rawContent = extractTextFromNodes(children);

            const isTip = rawContent.includes('💡') || /\[!TIP\]/i.test(rawContent) || /\bdica\b/i.test(rawContent);
            const isWarning = rawContent.includes('⚠️') || /\[!WARNING\]|\[!CAUTION\]/i.test(rawContent) || /\b(aviso|atenção|cuidado)\b/i.test(rawContent);
            const isNote = rawContent.includes('📌') || rawContent.includes('📝') || /\[!NOTE\]|\[!IMPORTANT\]/i.test(rawContent) || /\b(nota|observação|resumo)\b/i.test(rawContent);
            const isExample = rawContent.includes('✨') || /\[!EXAMPLE\]/i.test(rawContent) || /\b(exemplo|contraexemplo)\b/i.test(rawContent);
            const isConclusion = rawContent.includes('🎯') || /\b(conclusão|passo a passo)\b/i.test(rawContent);
            const isPros = rawContent.includes('✅') || /\b(vantagens|prós)\b/i.test(rawContent);
            const isCons = rawContent.includes('❌') || /\b(desvantagens|contras)\b/i.test(rawContent);

            if (isTip) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 text-sm flex gap-3 shadow-md">
                  <Lightbulb className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            if (isWarning) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-sm flex gap-3 shadow-md">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            if (isNote) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 text-sm flex gap-3 shadow-md">
                  <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            if (isExample) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-purple-200 text-sm flex gap-3 shadow-md">
                  <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            if (isConclusion) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-teal-950/25 border border-teal-500/40 text-teal-200 text-sm flex gap-3 shadow-md">
                  <Target className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            if (isPros) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 text-emerald-200 text-sm flex gap-3 shadow-md">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            if (isCons) {
              return (
                <div className="my-3.5 p-3.5 sm:p-4 rounded-2xl bg-rose-950/25 border border-rose-500/40 text-rose-200 text-sm flex gap-3 shadow-md">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{children}</div>
                </div>
              );
            }

            return (
              <blockquote className="border-l-4 border-emerald-500/70 pl-4 py-1.5 my-3 text-neutral-300 italic bg-neutral-900/40 rounded-r-2xl relative">
                <Quote className="w-3.5 h-3.5 text-emerald-500/50 inline-block mr-1.5 -mt-1" />
                {children}
              </blockquote>
            );
          },

          // Tables
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4 rounded-2xl border border-neutral-800 bg-neutral-950/80 shadow-xl scrollbar-thin">
                <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[320px]">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-neutral-900/90 border-b border-neutral-800">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-neutral-850/60">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-neutral-900/40 transition-colors odd:bg-neutral-950/40 even:bg-neutral-900/20">{children}</tr>;
          },
          th({ children }) {
            return (
              <th className="px-4 py-3 font-bold text-emerald-300 uppercase tracking-wider text-[11px] sm:text-xs border-b border-neutral-800">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-3 text-neutral-200 text-xs sm:text-sm leading-relaxed border-neutral-850/40">
                {children}
              </td>
            );
          },

          // Code
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = extractTextFromNodes(children);
            const isMultiLine = codeString.includes('\n');

            // If it's inline code (not a multi-line code block or explicitly tagged with a language)
            if (!match && !isMultiLine) {
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-emerald-300 font-mono text-[12.5px] font-medium inline-block select-text shadow-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlockComponent
                language={match ? match[1] : undefined}
                codeText={codeString.replace(/\n$/, '')}
              >
                {children}
              </CodeBlockComponent>
            );
          },

          // Links & Source Tags
          a({ href, children }) {
            const childText = extractTextFromNodes(children).trim();
            
            // Check if this link corresponds to a web source or a citation tag
            const matchingSource = sources?.find(s => {
              if (!href) return false;
              if (s.url && (href === s.url || href.replace(/\/$/, '') === s.url.replace(/\/$/, ''))) return true;
              if (s.domain && href.toLowerCase().includes(s.domain.toLowerCase())) return true;
              return false;
            });

            const isExplicitSourceTag = Boolean(
              childText.toLowerCase().startsWith('fonte') ||
              /^\d+$/.test(childText) ||
              /^\d+[:\s]/.test(childText) ||
              childText.toLowerCase().includes('tavily')
            );

            const isSourceTag = Boolean(matchingSource || isExplicitSourceTag);

            if (isSourceTag) {
              const domain = matchingSource?.domain || extractDomain(href || '');
              const sourceTitle = matchingSource?.title || childText || domain || 'Fonte';

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectSource && matchingSource) {
                      onSelectSource(matchingSource);
                    } else if (href) {
                      window.open(href, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded-full text-[11px] font-medium bg-neutral-900/95 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/60 transition-all cursor-pointer select-none align-middle shadow-xs group/tag"
                  title={`Fonte consultada: ${sourceTitle} (${domain}) - Clique para ver detalhes`}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt=""
                    className="w-3.5 h-3.5 rounded-full object-contain shrink-0 bg-neutral-800 p-0.5"
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                  <span className="truncate max-w-[140px] font-mono">{sourceTitle}</span>
                  <span className="text-[10px] text-emerald-400/80 group-hover/tag:translate-x-0.5 group-hover/tag:-translate-y-0.5 transition-transform">
                    ↗
                  </span>
                </button>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-bold underline underline-offset-2 decoration-blue-400/60 inline-flex items-center gap-1 transition-colors cursor-pointer group/link"
                title={`Abrir link: ${href}`}
              >
                <span>{children}</span>
                <span className="text-[11px] font-bold select-none leading-none group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" aria-hidden="true">
                  ↗
                </span>
              </a>
            );
          },

          // Horizontal Divider
          hr() {
            return <hr className="my-4 border-neutral-800/80" />;
          },

          // Custom HTML Divs (like Web Search Step Pill)
          div({ className, children, ...props }: any) {
            if (className?.includes('athenas-search-step-badge')) {
              const isSearching = (props as any)['data-searching'] === 'true' || className.includes('searching');
              if (isSearching) {
                return (
                  <div className="my-3 block select-none">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-xs animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
                      <span>Pesquisando na web</span>
                    </div>
                  </div>
                );
              }

              const rawText = extractTextFromNodes(children);
              const numMatch = rawText.match(/(\d+)/);
              const count = (props as any)['data-sites'] || (numMatch ? numMatch[1] : '10');
              return (
                <div className="my-3 block select-none">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-medium shadow-xs hover:border-emerald-500/30 transition-colors">
                    <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Pesquisou em <strong className="text-white font-semibold">{count} {count === '1' ? 'site' : 'sites'}</strong></span>
                  </div>
                </div>
              );
            }
            return <div className={className} {...props}>{children}</div>;
          }
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
