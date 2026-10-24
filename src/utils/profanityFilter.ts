/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Comprehensive list of Brazilian Portuguese profanities, insults, offensive slurs and common internet acronyms
const PROFANITY_WORDS: string[] = [
  // Expressões compostas (verificadas primeiro)
  'filho da puta',
  'filha da puta',
  'filhos da puta',
  'filhas da puta',
  'vai tomar no cu',
  'vai se foder',
  'vai se foder',
  'vai pro inferno',
  'casa do caralho',
  'puta que pariu',
  'puta que me pariu',
  'vai tomar no cu',
  'pau no cu',

  // Palavrões e variações
  'porra',
  'porras',
  'porralouca',
  'merda',
  'merdas',
  'merdinha',
  'merdao',
  'merdão',
  'bosta',
  'bostas',
  'bostinha',
  'caralho',
  'caralhos',
  'caralhada',
  'cacete',
  'cacetes',
  'cacilda',
  'buceta',
  'bucetas',
  'bucetao',
  'bucetão',
  'bucetinha',
  'bct',
  'bctz',
  'cu',
  'cus',
  'cuzao',
  'cuzão',
  'cuzaos',
  'cuzões',
  'cuzinho',
  'cuzinhos',
  'foda',
  'fodas',
  'foder',
  'fodendo',
  'fodeu',
  'fodido',
  'fodida',
  'fodidos',
  'fodidas',
  'foda-se',
  'fodase',
  'fodasse',
  'fudido',
  'fudida',
  'fuder',

  // Ofensas e xingamentos
  'idiota',
  'idiotas',
  'imbecil',
  'imbecis',
  'otario',
  'otaria',
  'otarios',
  'otarias',
  'otário',
  'otária',
  'otários',
  'otárias',
  'babaca',
  'babacas',
  'escroto',
  'escrota',
  'escrotos',
  'escrotas',
  'arrombado',
  'arrombada',
  'arrombados',
  'arrombadas',
  'desgracado',
  'desgracada',
  'desgracados',
  'desgracadas',
  'desgraçado',
  'desgraçada',
  'desgraçados',
  'desgraçadas',
  'desgraca',
  'desgraça',
  'desgracas',
  'desgraças',
  'vacilao',
  'vacilão',
  'vaciloes',
  'vacilões',
  'lazarento',
  'lazarenta',
  'lazarentos',
  'lazarentas',
  'peste',
  'pestes',
  'droga',
  'drogas',
  'porcaria',
  'porcarias',
  'inferno',
  'infernos',
  'puta',
  'putas',
  'puto',
  'putos',
  'putaria',
  'corno',
  'corna',
  'cornos',
  'viado',
  'veado',
  'viadinho',
  'viados',
  'bicha',
  'bichinha',
  'bixas',
  'piranha',
  'piranhas',
  'vadia',
  'vadias',
  'vagabundo',
  'vagabunda',
  'vagabundos',
  'vagabundas',
  'boçal',
  'bocal',
  'cretino',
  'cretina',
  'estupido',
  'estupida',
  'estúpido',
  'estúpida',
  'canalha',
  'canalhas',
  'chupa',
  'chupador',
  'chupadora',
  'trouxa',
  'trouxas',
  'troxa',

  // Siglas e abreviações da internet
  'pqp',
  'vsf',
  'fdp',
  'fdps',
  'tmnc',
  'tnc',
  'krl',
  'krlh',
  'kct',
  'fds', // contexto ofensivo
  'vtnc'
];

// Helper to remove accents for matching
function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Escapes regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Censura palavras ofensivas substituindo-as por "##########"
 * e detecta se houve ocorrência de palavras feias.
 */
export function censorProfanity(text: string): {
  censoredText: string;
  hasProfanity: boolean;
  matchedWords: string[];
} {
  if (!text || typeof text !== 'string') {
    return { censoredText: text || '', hasProfanity: false, matchedWords: [] };
  }

  let result = text;
  let hasProfanity = false;
  const matchedWords: string[] = [];

  // Sort by length descending so multi-word phrases get censored before single words
  const sortedWords = [...PROFANITY_WORDS].sort((a, b) => b.length - a.length);

  for (const word of sortedWords) {
    const isMultiWord = word.includes(' ');
    const normalizedWord = normalizeText(word);
    
    // Pattern to catch the word respecting word boundaries or common letter repetitions
    let pattern: RegExp;
    if (isMultiWord) {
      const parts = word.split(' ').map(p => escapeRegex(normalizeText(p)));
      pattern = new RegExp(`\\b${parts.join('\\s+')}\\b`, 'gi');
    } else if (['cu', 'pqp', 'vsf', 'krl', 'kct', 'fdp', 'tnc', 'tmnc', 'bct', 'fds', 'vtnc'].includes(normalizedWord)) {
      // Short acronyms must have exact word boundaries
      pattern = new RegExp(`(?<=^|\\s|[.,!?;:()\\-"'])${escapeRegex(normalizedWord)}(?=$|\\s|[.,!?;:()\\-"'])`, 'gi');
    } else {
      // General words with word boundaries
      pattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, 'gi');
    }

    // Check with accent normalization while preserving original replacement positions
    const normalizedOriginal = normalizeText(result);
    let match: RegExpExecArray | null;

    // Reset regex index
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(normalizedOriginal)) !== null) {
      hasProfanity = true;
      const matchIndex = match.index;
      const matchLength = match[0].length;
      const originalMatchedChunk = result.substring(matchIndex, matchIndex + matchLength);
      
      matchedWords.push(originalMatchedChunk);

      // Generate replacement: "##########" proportional to length (min 10 chars)
      const hashLength = Math.max(10, matchLength);
      const replacement = '#'.repeat(hashLength);

      result = result.substring(0, matchIndex) + replacement + result.substring(matchIndex + matchLength);
      
      // Update loop context because result length may have changed
      break; // re-run loop or continue safely
    }
  }

  // Second pass for remaining occurrences
  for (const word of sortedWords) {
    const isMultiWord = word.includes(' ');
    const normalizedWord = normalizeText(word);
    
    let pattern: RegExp;
    if (isMultiWord) {
      const parts = word.split(' ').map(p => escapeRegex(normalizeText(p)));
      pattern = new RegExp(`\\b${parts.join('\\s+')}\\b`, 'gi');
    } else if (['cu', 'pqp', 'vsf', 'krl', 'kct', 'fdp', 'tnc', 'tmnc', 'bct', 'fds', 'vtnc'].includes(normalizedWord)) {
      pattern = new RegExp(`(?<=^|\\s|[.,!?;:()\\-"'])${escapeRegex(normalizedWord)}(?=$|\\s|[.,!?;:()\\-"'])`, 'gi');
    } else {
      pattern = new RegExp(`\\b${escapeRegex(normalizedWord)}\\b`, 'gi');
    }

    const normalizedCurrent = normalizeText(result);
    if (pattern.test(normalizedCurrent)) {
      hasProfanity = true;
      pattern.lastIndex = 0;
      result = result.replace(pattern, (m) => {
        matchedWords.push(m);
        return '#'.repeat(Math.max(10, m.length));
      });
    }
  }

  return {
    censoredText: result,
    hasProfanity,
    matchedWords
  };
}
