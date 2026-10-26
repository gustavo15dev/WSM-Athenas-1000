# Conta dos Pais (Parent Portal) & Vínculo Familiar — WSM Athenas

Implementação completa do portal para pais e responsáveis no WSM Athenas, permitindo o acompanhamento em tempo real das métricas acadêmicas, simulados, notas e visualização fidedigna das conversas do aluno com a IA Athenas, com sistema seguro de vínculo por código de 4 dígitos.

---

## Decisões Críticas & Validações

> [!IMPORTANT]
> **Segurança e Isolamento**: 
> - O aluno gera um código de 4 caracteres alfanuméricos maiúsculos (ex: `K7A9`) na aba *Ajustes/Configurações*.
> - Cada aluno pode ter no máximo **5 responsáveis vinculados**.
> - Cada conta de pai/mãe pode vincular **ilimitados filhos** e alternar entre eles instantaneamente.
> - Sem pelo menos 1 aluno vinculado, os pais ficam restritos à tela inicial de vínculo.
> - O chat da IA é espelhado em modo de leitura com a mesma interface visual, preservando mensagens, anexos e raciocínio da IA.

---

## 1. Visão Geral & Escopo do Produto

- **Público-Alvo**: Pais, mães e responsáveis legais de alunos matriculados nas turmas do WSM Athenas.
- **Proposta de Valor**: Transparência pedagógica e tranquilidade para a família. Os pais acompanham a evolução dos filhos, frequência de estudos, notas em simulados e a interação com a tutora inteligente (Athenas AI) sem interferir no aprendizado direto do estudante.
- **Novos Papéis**: Expansão do sistema de autenticação para suportar `role: 'parent'` em conjunto com `student`, `teacher` e `admin`.

---

## 2. Experiência do Usuário (UX) & Fluxos Visuais

### Fluxo 1: Descoberta na Página Inicial (`PortalHome.tsx`)
- Logo abaixo do título "Athenas", é exibido um card exclusivo em destaque com a tag **`NOVO`** (estilizada em verde-esmeralda/âmbar vibrante).
- O card traz o tutorial visual ilustrado passo a passo:
  1. *Peça ao seu filho para abrir o WSM Athenas e acessar os Ajustes.*
  2. *Na aba "Vínculo com Pais", ele clica em "Gerar Código de 4 Dígitos".*
  3. *Crie sua conta de Responsável ou faça login.*
  4. *Insira o código de 4 dígitos para acompanhar tudo em tempo real!*
- No cabeçalho da Home, além de "Entrar Aluno" e "Entrar Professor", há o novo botão de ação: **`Área dos Pais`** (com ícone familiar / escudo de proteção).

### Fluxo 2: Cadastro e Primeiro Acesso dos Pais (`LoginModal.tsx`)
- Formulário simples e direto: **E-mail** e **Senha**.
- Ao criar a conta e entrar pela primeira vez:
  - Abre um modal de onboarding ilustrado explicando detalhadamente o passo a passo para obter o código com o filho.
  - Botão **`Avançar`** que fecha a explicação e leva à tela inicial do painel.

### Fluxo 3: Tela Inicial dos Pais com Bloqueio de Segurança (`ParentDashboard.tsx`)
- Se o responsável ainda não tiver nenhum filho vinculado:
  - Fica restrito à tela de boas-vindas com o card central em destaque para digitação do código de 4 dígitos (letras maiúsculas e números, auto-capitalizados).
  - Abaixo do card de inserção, repete o tutorial passo a passo para consulta imediata.
  - O menu e as demais abas do dashboard permanecem bloqueados até que o primeiro vínculo seja estabelecido com sucesso.

### Fluxo 4: Aluno Gerando o Código nos Ajustes (`StudentDashboard.tsx`)
- Dentro do modal de **Ajustes** do aluno, é adicionada a aba **`Vínculo com Pais`**.
- Mostra o indicador de vagas: `X de 5 responsáveis vinculados`.
- Botão interativo para gerar/renovar o código de 4 dígitos (ex: `H8N2`) com botão de copiar em um clique.
- Lista dos pais já vinculados com e-mail, data do vínculo e opção do aluno remover o vínculo caso necessário.
- Caso atinja o limite de 5 responsáveis, a geração de novos códigos é bloqueada e informa o limite atingido.

### Fluxo 5: Dashboard Completo dos Pais (Pós-Vínculo)
- **Seletor de Filhos (Multi-filhos)**: Barra superior elegante com abas ou dropdown para trocar entre os filhos vinculados (ex: *Lucas Silva - 8ºA*, *Mariana Silva - 6ºB*), com botão "+ Vincular outro filho".
- **Aba 1: Métricas & Progresso**: Integração direta com o componente `StudentProgress`, exibindo tempo ativo de estudo, engajamento, radar de habilidades e taxa de acertos.
- **Aba 2: Notas & Simulados**: Histórico de todos os simulados realizados pelo filho, notas obtidas, comparação com a média e devolutivas dos professores.
- **Aba 3: Chat Athenas AI (Fidedigno)**: Réplica visual exata da interface do WSM Chat (mascote da coruja com animação de piscar, mensagens do aluno à direita, respostas da IA à esquerda com tempo de reflexão e raciocínio expansível), permitindo que os pais leiam na íntegra as dúvidas e interações do filho com a IA.

---

## 3. Arquitetura do Sistema & Diagrama de Dados

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PORTAL HOME                                   │
│  [Entrar Aluno]   [Entrar Professor]   [Área dos Pais (NOVO Card)]     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴────────────────────────┐
         ▼                                                  ▼
┌──────────────────┐                              ┌──────────────────┐
│ StudentDashboard │                              │ ParentDashboard  │
│ - Ajustes        │                              │ - Onboarding     │
│ - Aba Vínculo    │                              │ - Código 4 chars │
│ - Gerar Código   │                              │ - Troca de Filho │
│ - Limite: 5 pais │                              │ - Métricas       │
└────────┬─────────┘                              │ - Simulados      │
         │                                        │ - Chat IA Fiel   │
         │ Cria código pendente                   └────────┬─────────┘
         ▼                                                 │
┌────────────────────────────────────────────────────────┐ │ Consulta
│       Tabela Supabase: wsm_student_parent_links        │◄┘ e Ativa
│ - id: UUID                                             │
│ - student_email: TEXT                                  │
│ - student_name: TEXT                                   │
│ - parent_email: TEXT                                   │
│ - link_code: VARCHAR(4) [A-Z0-9]                       │
│ - status: 'pending' | 'active'                         │
│ - created_at, linked_at: TIMESTAMPTZ                   │
└────────────────────────────────────────────────────────┘
```

---

## 4. Script SQL para o Supabase

Abaixo está o script SQL que deverá ser executado no console SQL do Supabase para criar a infraestrutura necessária:

```sql
-- 1. Criação da tabela de vínculos entre alunos e pais/responsáveis
CREATE TABLE IF NOT EXISTS wsm_student_parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  student_name TEXT,
  parent_email TEXT,
  link_code VARCHAR(4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  linked_at TIMESTAMPTZ
);

-- 2. Criação de índices otimizados para rápida verificação sem sobrecarregar o banco
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON wsm_student_parent_links(student_email);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON wsm_student_parent_links(parent_email);
CREATE INDEX IF NOT EXISTS idx_parent_links_code ON wsm_student_parent_links(link_code);

-- 3. Habilitação de Row Level Security (RLS) permissivo para a aplicação
ALTER TABLE wsm_student_parent_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Politica de acesso publico para links de pais e alunos" ON wsm_student_parent_links;
CREATE POLICY "Politica de acesso publico para links de pais e alunos" 
  ON wsm_student_parent_links 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
```

---

## 5. Plano de Implementação em Arquivos

1. **`src/types.ts`**:
   - Atualizar `PortalRole` para `'student' | 'teacher' | 'parent'`.
   - Atualizar `ScreenType` para incluir `'PARENT_DASHBOARD'`.
   - Criar interface `StudentParentLink`.

2. **`src/components/PortalHome.tsx`**:
   - Adicionar o botão "Área dos Pais" no topo.
   - Adicionar o card com a tag **`NOVO`** abaixo do título com o tutorial passo a passo dos pais.

3. **`src/components/LoginModal.tsx`**:
   - Suporte ao papel de `parent`: cadastro com apenas e-mail e senha (sem necessidade de turma/número de chamada).
   - Card explicativo de primeiro acesso para pais com botão "Avançar".

4. **`src/components/StudentDashboard.tsx`**:
   - Na seção de Ajustes, criar a aba "Vínculo com Pais".
   - Gerador do código de 4 dígitos (letras maiúsculas e números aleatórios).
   - Validador do teto de 5 responsáveis vinculados.
   - Lista dos pais atualmente vinculados.

5. **`src/components/ParentDashboard.tsx` (Novo componente)**:
   - Seletor de filhos ativos (com suporte a alternância instantânea).
   - Bloqueio inicial se não tiver filho vinculado (mostrando o input de 4 dígitos e passo a passo).
   - Exibição de Minhas Métricas (`StudentProgress`).
   - Exibição de Simulados e Notas.
   - Visualizador fidedigno do chat da IA Athenas em primeira mão (com todas as conversas e respostas).

6. **`src/App.tsx`**:
   - Roteamento e persistência de sessão para o perfil de `parent` e tela `PARENT_DASHBOARD`.

7. **Verificação & Testes**:
   - Execução de `compile_applet` e `lint_applet` para validação rigorosa de tipos e compilação.
