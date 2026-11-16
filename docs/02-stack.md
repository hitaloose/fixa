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
