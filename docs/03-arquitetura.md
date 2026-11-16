# 03 — Arquitetura e estrutura de pastas

## Visão geral

Um único app React (sem backend, sem monorepo). Tudo roda no navegador:

```
┌─────────────────────────────── navegador (PWA) ───────────────────────────────┐
│ routes/        telas finas: só compõem features                               │
│   ▼                                                                           │
│ features/      decks · study · editor · browser · options · stats · backup …  │
│   │  componentes + hooks de cada funcionalidade                               │
│   ├──────────────► ui/        design system (primitives + patterns)           │
│   ├──────────────► data/      Dexie: schema, migrações, repositórios          │
│   └──────────────► domain/    regras puras: FSRS, fila, templates, busca …    │
│                    lib/       utilitários técnicos (clock, ids, sanitize…)    │
│ workers/       import .apkg, estatísticas pesadas                             │
│ IndexedDB  ◄── fonte única da verdade                                         │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Por que não Atomic Design (e o que usamos no lugar)

Atomic Design (atoms / molecules / organisms / templates / pages) organiza componentes **pelo tamanho**. Na prática:

- A fronteira entre "molécula" e "organismo" é subjetiva e gera discussão em toda pasta nova — e um agente vai classificar diferente a cada sessão.
- Uma funcionalidade (ex.: sessão de estudo) acaba espalhada em 4 pastas; para mudar uma tela você abre `atoms/`, `molecules/`, `organisms/` e `templates/`.
- Componentes de negócio (o "card de baralho com contagens") não são reutilizáveis de verdade; forçá-los a uma hierarquia genérica não ajuda.

**O que usamos:** organização **por funcionalidade** (feature-based) + um **design system pequeno** em `src/ui`. O espírito do Atomic Design sobrevive só onde ele funciona bem — no design system — em dois níveis claros:

- `ui/primitives`: peças sem conhecimento de negócio e sem composição de outras peças do `ui` (Button, IconButton, Switch, Slider, Input, Chip, Badge, Icon).
- `ui/patterns`: composições genéricas reutilizadas por várias features (ListGroup/ListRow, Sheet, SearchField, SegmentedControl, Stepper, TabBar, EmptyState, Toast).

Regra para decidir: **usado por 2+ features e sem regra de negócio → `ui`; senão, fica na feature.** Começa na feature; sobe para `ui` quando a segunda feature precisar.

## Estrutura

```
fixa/
├─ CLAUDE.md
├─ index.html
├─ package.json
├─ vite.config.ts            # + vite-plugin-pwa
├─ vitest.config.ts          # cobertura com thresholds por pasta
├─ stryker.config.json       # mutação em src/domain
├─ playwright.config.ts
├─ biome.json
├─ .dependency-cruiser.cjs   # regras de camadas
├─ docs/
├─ public/                   # ícones do PWA
├─ tests/
│  ├─ e2e/                   # Playwright
│  ├─ fixtures/              # .apkg, .csv de exemplo
│  └─ factories/             # makeCard(), makeDeck() … para todos os testes
└─ src/
   ├─ main.tsx
   ├─ app/                   # bootstrap: providers, router, registro do SW, estilos globais
   │  └─ styles/theme.css    # tokens (@theme do Tailwind)
   ├─ routes/                # TanStack Router (file-based). Só monta layout + feature.
   ├─ features/
   │  ├─ decks/
   │  │  ├─ components/      # DeckTree.tsx, DeckTree.test.tsx, DeckActionsSheet.tsx …
   │  │  ├─ hooks/           # useDeckTree.ts, useDeckCounts.ts (+ testes)
   │  │  └─ index.ts         # API pública da feature (só isso é importado por routes)
   │  ├─ study/
   │  ├─ editor/             # editor de nota, nó de fórmula, sheet do MathLive
   │  ├─ browser/            # navegador de cartões
   │  ├─ options/
   │  ├─ stats/
   │  ├─ backup/             # exportar/importar backup
   │  └─ import/             # .apkg, .csv
   ├─ ui/
   │  ├─ primitives/
   │  └─ patterns/
   ├─ domain/                # puro, 100% testável sem DOM
   │  ├─ model/              # schemas zod + tipos
   │  ├─ scheduler/
   │  ├─ queue/
   │  ├─ day/
   │  ├─ templates/
   │  ├─ search/
   │  ├─ stats/
   │  ├─ import/             # mapeamento Anki/CSV → entidades
   │  ├─ backup/             # formato do backup, versão, validação
   │  └─ ports.ts            # Clock, IdGenerator
   ├─ data/
   │  ├─ db.ts               # instância Dexie
   │  ├─ schema/             # v1.ts, v2.ts … (uma versão por arquivo, nunca editar publicada)
   │  └─ repositories/       # decks.ts, cards.ts, notes.ts … (+ testes com fake-indexeddb)
   ├─ lib/                   # clock.ts, ids.ts, sanitize.ts, format.ts, math/ (KaTeX, MathLive loaders)
   ├─ i18n/pt-BR.ts
   └─ workers/               # import.worker.ts, stats.worker.ts
```

Testes de unidade/componente ficam **ao lado** do arquivo (`foo.ts` + `foo.test.ts`); E2E e fixtures em `tests/`.

## Regras de dependência (verificadas pelo `pnpm boundaries`)

| De | Pode importar | Não pode |
|---|---|---|
| `routes` | `features/*/index.ts`, `ui`, `app` | internos de feature, `data`, `domain` |
| `features/x` | `ui`, `data`, `domain`, `lib`, `i18n`, a própria feature | outra feature |
| `ui` | `lib`, `i18n` | `features`, `data`, `domain` |
| `data` | `domain` (modelo e regras puras), `lib` | `features`, `ui`, `i18n`, React |
| `domain` | só `domain` (+ libs puras: ts-fsrs, zod) | **qualquer outra pasta**, React, Dexie, DOM |
| `lib` | nada do projeto | — |
| `workers` | `domain`, `lib` | `features`, `ui` |

**Como features chegam aos dados:** `src/data/runtime.ts` guarda `{ db, clock, ids, repos }`, configurado uma vez no bootstrap (`src/app`) e por teste (`configureRuntime`). Hooks de feature usam `runtime().repos`; nenhuma feature importa `app`, e `data` continua sem React.

**`data` usa regras puras do `domain`** (ex.: `planDeckPath`, `checkMove`) dentro da mesma transação em que lê e grava — assim a validação e a escrita não se separam. A dependência continua apontando para o domínio. *(Decisão de 2026-11-16, aprovada pelo usuário.)*

**`lib` não importa `domain`:** as implementações de `Clock`/`IdGenerator` em `lib` são estruturalmente compatíveis com `domain/ports.ts`, sem import.

Se duas features precisam conversar (ex.: "estudar" a partir da tela do baralho), a ligação é por **rota** (navegação), não por import.

## Fluxos principais

**Responder um cartão**
1. A sessão de estudo (estado em Zustand, na feature `study`) tem a fila em memória montada por `domain/queue`.
2. Toque em "Bom" → `domain/scheduler.answer(card, rating, now, preset)` devolve `{ nextCard, reviewLog }`.
3. `cardsRepository.applyReview(nextCard, reviewLog)` grava os dois numa transação Dexie.
4. A sessão avança para o próximo cartão sem esperar o `useLiveQuery`.
5. "Desfazer" restaura `cardBefore` do log e marca `undoneAt`.

**Importar `.apkg`** — roda em `workers/import.worker.ts` usando `domain/import`; devolve lotes validados; a thread principal grava em transações de ~500 registros com barra de progresso.

## Desempenho

- Contagens da árvore por índice composto `[deckId+queue+due]`, sem varrer cartões.
- Navegador de cartões com lista virtualizada (TanStack Virtual).
- KaTeX e MathLive carregados sob demanda.
- `navigator.storage.persist()` no primeiro uso (ver `docs/06-dados-e-backup.md`).

## Segurança

- DOMPurify com allowlist em todo HTML de campo.
- Mídia servida por `URL.createObjectURL` a partir de Blobs locais; nada de URL externa vinda de import.
- CSP no servidor estático: `script-src 'self' 'wasm-unsafe-eval'` (sql.js).
