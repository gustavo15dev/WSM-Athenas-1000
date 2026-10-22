# Menção de Provas com '@' e Ajuste dos Cards de Ação

Alinhamento visual dos cartões de ação na tela inicial do chat, comportamento de preenchimento de texto na caixa de entrada sem disparo automático, novo placeholder intuitivo e implementação do menu flutuante de menção com `@` para anexar provas e simulados pendentes da turma com injeção contextual de conteúdo de estudos na IA Athenas.

### User Review & Critical Decisions

> [!IMPORTANT]
> Decisões alinhadas diretamente com as instruções e respostas do usuário:

- **Confirmed Decision 1 - Alinhamento Visual dos Cards**: Ajuste de flexbox/grid (`items-stretch`, `h-full`, alinhamento superior com títulos e descrições na mesma linha) para que o 3º card ("Revise para prova") não fique deslocado verticalmente para baixo em relação aos outros dois.
- **Confirmed Decision 2 - Preenchimento sem Envio Automático**: Clicar nos botões agora apenas insere o texto pré-definido correspondente no campo de digitação e foca o cursor no final do texto, sem enviar a mensagem:
  - **Crie Simulados**: `"Crie um simulado pra mim sobre "`
  - **Aprenda Conteúdo**: `"Quero aprender sobre: "`
  - **Revise para prova**: `"Quero estudar para prova. A Matéria é "`
- **Confirmed Decision 3 - Novo Placeholder da Caixa de Entrada**: Substituição do placeholder `"Pergunte alguma coisa"` por `"Digite algo ou @ para anexar alguma prova..."`.
- **Confirmed Decision 4 - Menu Flutuante ao Digitar '@'**: Ao digitar `@` no campo de texto, abre-se um popover flutuante suspenso acima do input (estilo Gemini/Google, adaptado ao tema escuro Athenas) listando as provas presenciais e simulados pendentes da turma do aluno.
- **Confirmed Decision 5 - Destaque em Negrito Verde-Água & Contexto para IA**: A prova selecionada é inserida na mensagem como `@NomeDaProva` destacada em negrito verde-água. Ao submeter a mensagem, o conteúdo programático/descrição cadastrado pelo professor para aquela avaliação é injetado como contexto na IA Athenas para guiar os estudos e simulados.

---

### 1. Overview & Core Concept

- **What It Does**: Facilita a interação do estudante com o chat da IA por meio de botões que preparam prompts com um toque e permite que o aluno mencione diretamente avaliações pendentes digitando `@`, abrindo um menu de seleção inteligente com dados da sua turma.
- **Target Audience / Persona**: Estudantes do WSM Athenas que desejam direcionar suas dúvidas e simulados especificamente para as provas marcadas por seus professores.
- **Key Value**: Elimina o trabalho manual de copiar o conteúdo da prova para a IA e padroniza a preparação focada nas matérias oficiais do calendário escolar.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Cards da Tela Inicial**:
   - O estudante vê os 3 cards perfeitamente alinhados lado a lado, com ícones no topo, títulos alinhados no mesmo nível e descrições com leitura limpa.
   - Ao clicar em um card, o texto é preenchido imediatamente na caixa de envio e o teclado/cursor é ativado.
2. **Uso da Menção '@'**:
   - O aluno digita `@` em qualquer ponto do campo de entrada.
   - Um card suspenso flutuante surge acima do input exibindo a lista de **Provas e Simulados Pendentes da sua turma**.
   - Cada item do menu apresenta:
     - Ícone temático (Calendário para Prova Presencial, Computador/Troféu para Simulado Online).
     - Título da prova em destaque (`text-sm font-semibold text-white`).
     - Data e disciplina (`text-xs text-neutral-400`).
   - O aluno clica (ou navega com as setas) e seleciona a prova.
   - O `@` é substituído pela tag `@NomeDaProva`, estilizada visualmente em negrito verde-água (`text-emerald-400 font-bold`).
3. **Envio da Mensagem com Contexto Delimitado**:
   - Ao enviar a mensagem (ex: *"Quero estudar para a prova de @História - Era Vargas"*), o sistema extrai o conteúdo delimitado que a professora cadastrou para a prova e envia para a IA com `studyExamTheme` e `studyExamContent`.
   - A IA Athenas responde no modo focado socrático com base no plano de aula e conteúdo daquela avaliação específica.

#### Visual Identity & Theme
- **Cards Superiores**:
  - `grid-cols-1 sm:grid-cols-3 gap-3 items-stretch`.
  - Altura uniforme, alinhamento flexível `flex flex-col justify-start items-start`, garantindo que os títulos e textos comecem no mesmo ponto vertical.
- **Menu Popover do '@'**:
  - `bg-[#121622] border border-neutral-800 rounded-2xl shadow-2xl p-2 max-h-64 overflow-y-auto`.
  - Cabeçalho do menu: `text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-3 py-1.5`.
  - Itens: `px-3 py-2 rounded-xl hover:bg-neutral-800/80 text-left transition-colors cursor-pointer`.
  - Badge de status e data em `text-xs text-emerald-400/80 font-mono`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 - Alinhamento dos Cards de Ação**:
  - *Chosen Approach*: Mudar a estrutura interna de cada card de `justify-between` para `justify-start` com espaçamento padrão (`gap-1.5` ou `space-y-1.5`), garantindo que tanto o título quanto a descrição iniciem exatamente na mesma altura horizontal.
  - *Why*: Evita o desnivelamento quando um card tem mais ou menos linhas que os outros.

- **Decision 2 - Interceptação do Caractere '@' no Input**:
  - *Chosen Approach*: Monitorar o valor do `inputText` no `onChange` e `onKeyDown`. Quando o caractere `@` é digitado, ativa `showExamPicker = true`. Se apagado ou após seleção, oculta o popover.
  - *Why*: Interface ágil e sem fricção, idêntica ao padrão de menções modernas.

- **Decision 3 - Origem dos Dados de Provas e Simulados**:
  - *Chosen Approach*: Passar a lista de `exams` e `mockExams` de `StudentDashboard` para `WsmChat`, com fallback de busca no Supabase (`wsm_exams` e `wsm_mock_exams`) caso o chat seja acessado diretamente.
  - *Why*: Resposta instantânea sem recarregar a rede ao abrir o menu de menções.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                       StudentDashboard.tsx                      │
│  - exams (provas presenciais) & mockExams (simulados)           │
│  - Passa como props para WsmChat                                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                           WsmChat.tsx                           │
│  - 3 Cards com alinhamento vertical uniforme (justify-start)    │
│  - onClick dos cards: preenche inputText e foca inputRef        │
│  - Placeholder: "Digite algo ou @ para anexar alguma prova..."  │
│  - Estado showExamMentionPopup: abre ao digitar '@'             │
│  - FloatingExamMentionCard: lista provas pendentes              │
│  - Ao selecionar: insere "@NomeDaProva" e armazena metadados    │
│  - Ao enviar: transmite studyExamTheme e studyExamContent à IA  │
└─────────────────────────────────────────────────────────────────┘
```
