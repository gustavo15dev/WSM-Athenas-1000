/**
 * Fast client & server safety guardrails for Athenas AI.
 * Intercepts dangerous, violent, self-harm, weapon or explosive synthesis queries
 * in sub-milliseconds without waiting for multiple LLM round-trips or safety filter timeouts.
 */

export const EDUCATIONAL_SAFETY_REFUSAL_MESSAGE = 
  "Como tutor educacional da Plataforma Athenas, não posso ajudar com instruções ou receitas para criar substâncias perigosas, armas, explosivos ou qualquer material que ofereça risco à segurança e integridade física.\n\n" +
  "Se você tiver dúvidas teóricas ou acadêmicas sobre Química, Física ou Ciências — como reações químicas, termodinâmica ou transformações da matéria explicadas de forma científica e segura —, terei o maior prazer em ajudar! Qual conceito você gostaria de explorar?";

export function checkFastSafetyViolation(message: string): string | null {
  if (!message || typeof message !== 'string') return null;

  const lower = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  // 1. Safe academic exceptions (MUST NOT be blocked)
  const safeAcademicPatterns = [
    /bomba\s+(de\s+)?(sodio|potassio|sodio-potassio|hidrogenio|protons|calcio)/i,
    /bomba\s+(d'?\s*agua|hidraulica|de\s+combustivel|de\s+infusao|de\s+calor|peniana|de\s+vacuo|eletrica)/i,
    /(historia|contexto|efeitos?|segunda\s+guerra|hiroshima|nagasaki|oppenheimer|manhattan)\s+.*bomba\s+atomica/i,
    /bomba\s+atomica\s+.*(historia|segunda\s+guerra|hiroshima|nagasaki|oppenheimer|manhattan|fisica\s+nuclear|fissao|fusao)/i,
    /como\s+funciona\s+(a\s+|o\s+)?bomba\s+(de\s+sodio|hidraulica|d'?\s*agua|atomica)/i
  ];

  if (safeAcademicPatterns.some(pattern => pattern.test(lower))) {
    return null;
  }

  // 2. Dangerous Weapons, Bombs & Explosives Synthesis
  const explosivePatterns = [
    /\b(como\s+(fazer|fabricar|criar|construir|montar|produzir|preparar)|receita\s+(de|pra|para)|tutorial\s+(de|pra|para)|passo\s+a\s+passo\s+(de|pra|para))\s+([a-z0-9\s]*\s+)?(bomba|explosivo|dinamite|detonador|coquetel\s+molotov|granada|polvora|artefato\s+explosivo)/i,
    /\b(bomba\s+caseira|explosivo\s+caseiro|polvora\s+caseira|coquetel\s+molotov|como\s+fazer\s+(uma\s+)?bomba|fabricar\s+(uma\s+)?bomba|fazer\s+(uma\s+)?bomba|construir\s+(uma\s+)?bomba)/i,
    /\b(como\s+(fazer|fabricar|montar|construir|imprimir)\s+([a-z0-9\s]*\s+)?(arma\s+de\s+fogo|pistola|fuzil|revolver|silenciador\s+caseiro))/i
  ];

  // 3. Dangerous Chemical Weapons & Toxic Poisons
  const poisonPatterns = [
    /\b(como\s+(fazer|fabricar|produzir|sintetizar|preparar)|receita\s+(de|pra|para))\s+([a-z0-9\s]*\s+)?(veneno|ricina|cianeto|gas\s+cloro|gas\s+mostarda|sarim|antrax|chumbinho)/i,
    /\b(veneno\s+caseiro|como\s+envenenar\s+(alguem|uma\s+pessoa|um\s+humano))/i
  ];

  // 4. Illicit Narcotics Synthesis
  const drugSynthesisPatterns = [
    /\b(como\s+(fazer|cozinhar|fabricar|sintetizar|produzir|refinar)|receita\s+(de|pra|para))\s+([a-z0-9\s]*\s+)?(metanfetamina|crack|cocaina|lsd|heroina|krokodil|desomorfina|droga\s+caseira)/i
  ];

  // 5. Self-Harm & Suicide
  const selfHarmPatterns = [
    /\b(como\s+(se\s+matar|me\s+matar|cometer\s+suicidio|me\s+suicidar)|formas\s+de\s+(se\s+matar|suicidio)|metodos\s+(de|para)\s+suicidio|como\s+(se\s+cortar|me\s+cortar|me\s+mutilar))/i
  ];

  // 6. Violent Crimes & Attacks
  const violentCrimePatterns = [
    /\b(como\s+(assassinar|matar\s+(uma\s+pessoa|alguem)|esconder\s+um\s+corpo)|como\s+planejar\s+um\s+(massacre|ataque\s+a\s+tiros|atentado))/i
  ];

  // 7. Cyber Attacks & Destructive Malware
  const malwarePatterns = [
    /\b(como\s+(criar|fazer|programar)\s+(um\s+)?(ransomware|keylogger|trojan|spyware\s+espiao|malware\s+destrutivo))/i
  ];

  const allRules = [
    ...explosivePatterns,
    ...poisonPatterns,
    ...drugSynthesisPatterns,
    ...selfHarmPatterns,
    ...violentCrimePatterns,
    ...malwarePatterns
  ];

  for (const regex of allRules) {
    if (regex.test(lower)) {
      return EDUCATIONAL_SAFETY_REFUSAL_MESSAGE;
    }
  }

  return null;
}
