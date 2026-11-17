# 02 — Stack

**Só frontend.** Um app estático (HTML/JS/CSS) que roda inteiro no navegador. Não há servidor de aplicação, banco remoto nem conta de usuário.

## Escolhas

| Área | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (strict) | Tipos de ponta a ponta. |
| Runtime de dev | **Node 22 LTS**, **pnpm** | Só para build e testes. |
| Build | **Vite** | Rápido; plugin de PWA maduro. |
| UI | **React 19** | Ecossistema (Tiptap, MathLive, Dexie hooks, Testing Library). |
| Rotas | **TanStack Router** (file-based) | Rotas e search params tipados (útil no navegador de cartões). |
| Estilo | **Tailwind CSS v4**, tokens em `@theme` | Tokens do design em um lugar só. |
| Primitivas acessíveis | **Radix UI** (Dialog, Switch, Slider, Tabs, Popover) + **Vaul** (bottom sheet) | Teclado, foco e ARIA prontos. |
| Banco local | **Dexie 4** (IndexedDB) + `dexie-react-hooks` | Consultas reativas com `useLiveQuery`. |
| Estado efêmero | **Zustand** | Só sessão de estudo e seleção; dado persistente fica no Dexie. |
| PWA | **vite-plugin-pwa** (Workbox) | Offline, instalação, prompt de atualização. |
| Agendamento | **ts-fsrs** | Implementação de referência do FSRS. |
| Editor | **Tiptap** + nó de fórmula próprio | Campos em HTML, compatíveis com Anki. |
| Fórmulas | **KaTeX** (exibir) + **MathLive** (editar) | Ver `docs/07-formulas.md`. |
| Sanitização | **DOMPurify** | Todo HTML de campo. |
| Validação | **zod** | Arquivos importados e backup. |
| IDs | **uuid** (v7) | Ordenáveis, gerados offline. |
| Compressão / zip | **fflate** | Backup `.gz` e leitura de `.apkg`. |
| Import Anki | **sql.js** (SQLite WASM) + **fzstd** | Em Web Worker. |
| Listas longas | **TanStack Virtual** | Navegador de cartões. |
| Fontes | `@fontsource/inter`, `@fontsource/space-grotesk` | Servidas localmente (offline). |
| **Qualidade** | | |
| Lint/format | **Biome** (com `noSkippedTests`, `noFocusedTests` como erro) | Rápido; bloqueia `.skip`/`.only`. |
| Camadas | **dependency-cruiser** | Faz valer as regras de import de `docs/03-arquitetura.md`. |
| Testes | **Vitest** + `@vitest/coverage-v8` | Mesma config do Vite; thresholds por pasta. |
| Componentes | **@testing-library/react** + `user-event` + jsdom | Testa por papel/nome acessível. |
| Banco em teste | **fake-indexeddb** | IndexedDB real em memória nos testes de `data/`. |
| Propriedades | **fast-check** | Invariantes do agendador, fila e backup. |
| Mutação | **Stryker** (`@stryker-mutator/vitest-runner`) | Garante que os testes de `domain` são fortes. |
| E2E | **Playwright** (viewport 390×844, modo offline) | Fluxos críticos. |
| CI | **GitHub Actions** | `pnpm check`, mutação em PRs que tocam `src/domain`, e2e. |
| Hospedagem | **Estática**: Cloudflare Pages / GitHub Pages, ou Caddy no homelab | Qualquer servidor de arquivos; HTTPS obrigatório (service worker). |

## Decisões

Formato: **data — decisão — motivo — alternativas descartadas.**

- **2026-11-16 — Sem backend.** Tudo no navegador; menos infraestrutura, privacidade total, funciona offline por natureza. Troca entre dispositivos por arquivo de backup (`docs/06-dados-e-backup.md`). *Descartado:* API própria com sync (custo de manter servidor, auth, conflitos).
- **2026-11-16 — Projeto único, sem monorepo.** Sem backend não há o que compartilhar entre pacotes. A pureza do domínio é garantida pelo dependency-cruiser, não por fronteira de pacote.
- **2026-11-16 — Organização por funcionalidade + design system pequeno, não Atomic Design.** Ver `docs/03-arquitetura.md`.
- **2026-11-16 — TDD estrito com teste de mutação no domínio.** Cobertura sozinha não garante teste forte; mutação sim. Ver `docs/11-tdd.md`.
- **2026-11-16 — FSRS como único agendador.** Padrão atual do Anki; um algoritmo só. SM-2 de cartões importados é convertido.
- **2026-11-16 — Campos em HTML com fórmulas `\(...\)` / `\[...\]`.** Compatibilidade com `.apkg`.
- **2026-11-16 — KaTeX para exibir, MathLive para editar.** KaTeX é mais rápido no celular que MathJax; fallback para MathJax só se aparecer comando não suportado.
- **2026-11-16 — TypeScript fixado em 6.x.** O dependency-cruiser ainda não suporta a API do TypeScript 7 (sem ele, `pnpm boundaries` passa sem analisar nada). *Revisitar* quando o dependency-cruiser suportar TS 7.
- **2026-11-16 — Ferramentas de suporte às escolhas acima** (sem nova decisão de produto): `@tailwindcss/vite` (Tailwind v4 no Vite), `@tanstack/router-plugin` (rotas file-based), `@vitejs/plugin-react`, `@testing-library/jest-dom` (matchers de acessibilidade/DOM), `@types/node` (testes de arquitetura leem `src/`).
- **2026-11-16 — Pureza do domínio em três camadas:** dependency-cruiser (imports), Biome `noRestrictedGlobals` em `src/domain` (window, document, navigator, crypto, storage) e `tests/architecture/domain-purity.test.ts` (proíbe `Date.now()`, `new Date()` sem argumento e `Math.random()`; `Date`/`Math` em si são permitidos porque o ts-fsrs usa `Date` e arredondamento usa `Math`).
- **2026-11-16 — `workbox-window`** como devDependency: peer do `virtual:pwa-register/react` (vite-plugin-pwa) para o prompt de atualização. Ícones PNG do PWA gerados de `public/favicon.svg` por `scripts/render-icons.mjs` (Playwright), sem ferramenta nova.
- **2026-11-16 — zod no domínio, mas encapsulado.** zod é puro (sem IO), então pode morar em `domain`, mas é detalhe de implementação: `domain/model` expõe só tipos TS e funções `parseX`; schemas ficam internos. zod só é importado em `domain/model`, `domain/backup` e `domain/import`, e o resto do domínio (agendador, fila, templates, busca) trabalha com objetos simples. Verificado por regras do dependency-cruiser. Critério para outra lib no domínio: pura, sem IO e escondida atrás de funções do próprio domínio (ts-fsrs fica atrás de `domain/scheduler`). *Descartado:* tipos e validação escritos à mão (duplicação e divergência).
- **2026-11-16 — ts-fsrs 5.4.2 (FSRS-6), versão exata.** O v6 usa FSRS-7 por padrão (campo de memória extra `stabilityFast`), declara Node ≥ 24 e tem API nova assíncrona. O v5 bate com o modelo de dados, com o Node 22 do projeto e com o estado FSRS-6 que vem do `.apkg` do Anki. Fuzz do v5 é determinístico (semente derivada do instante da revisão), então o domínio continua puro. *Revisitar:* migrar para FSRS-7 exige migração de schema (`stabilityFast`) e Node 24.
- **2026-11-16 — KaTeX 0.19 com `trust` só para `\htmlClass`.** A omissão dentro de fórmula é marcada como `\htmlClass{cloze}{…}` (o KaTeX roda depois do template e não aceita HTML), então `trust` libera apenas esse comando; `\href`, `\url` e afins continuam bloqueados. `strict: "ignore"` evita avisos com texto acentuado em fórmulas.
- **2026-11-16 — CSS do tipo de nota isolado com `@scope (.fixa-card)`**, sem Shadow DOM: o CSS do usuário (inclusive o importado do Anki, que mira `.card`) não vaza para o app, e testes e leitores de tela continuam vendo o conteúdo do cartão no DOM normal. *Descartado:* Shadow DOM (o CSS do KaTeX teria de ser injetado em cada raiz e o Testing Library não atravessa a sombra).
- **2026-11-16 — Tiptap 3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/core`).** StarterKit já traz negrito, itálico, sublinhado, listas e desfazer; título, código, citação e link ficam desligados (não existem em campo do Anki). Áudio é um nó próprio. Mídia fica no documento pelo nome do arquivo (`<sha256>.png`) e aparece no editor por `blob:` via *node view*, então o HTML salvo nunca contém URL temporária. O `<p>` que o Tiptap sempre gera vira linhas com `<br>` ao salvar (`features/editor/model/fieldHtml.ts`), como nos campos do Anki. Digitação tecla a tecla é testada no Playwright: no jsdom o ProseMirror não tem seleção nem layout reais.
- **2026-11-16 — Sessão de estudo sem Zustand (por enquanto).** O estado da sessão (fila em memória, cartão revelado, pilha de desfazer) é de uma tela só e vive num hook da feature `study` (`useStudySession`) sobre funções puras (`features/study/model/session.ts`). As gravações no IndexedDB entram numa fila serial, então um desfazer nunca ultrapassa a resposta que ele reverte. Zustand continua na pilha para quando houver estado efêmero compartilhado entre telas (seleção do navegador).
- **2026-11-16 — MathLive 0.111 carregado sob demanda, com as fontes do KaTeX.** As fontes do MathLive têm os mesmos nomes das do KaTeX (`KaTeX_*`), então `fontsDirectory = null` e o CSS do KaTeX fornece as fontes (já precacheadas pelo PWA); sons desligados. O teclado virtual cobre a parte de baixo da tela: o sheet de fórmula reserva o espaço dele (evento `geometrychange`). No editor, a fórmula é um nó atômico `math` serializado como `\(…\)`/`\[…\]`; omissão dentro da fórmula aparece só com a resposta no editor e continua no LaTeX salvo.
