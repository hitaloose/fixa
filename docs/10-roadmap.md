# 10 — Roadmap

Marque `[x]` ao concluir. Cada fase termina com o app utilizável. Todo item segue `docs/11-tdd.md`: teste antes, `pnpm check` verde ao final.

## Fase 0 — Fundação

- [x] Vite + React 19 + TypeScript strict + TanStack Router + Tailwind v4 com tokens de `docs/09-design.md`
- [x] Biome (com `noSkippedTests`/`noFocusedTests` como erro), dependency-cruiser com as regras de `docs/03-arquitetura.md`
- [x] Vitest + coverage com thresholds por pasta, Testing Library, fake-indexeddb, fast-check, Stryker em `src/domain`, Playwright
- [x] Script `pnpm check` e GitHub Actions rodando-o (+ mutação e e2e)
- [x] `tests/factories` (makeDeck, makeNote, makeCard, makeReviewLog, makePreset)
- [x] `domain/ports.ts` (Clock, IdGenerator) + implementações em `lib/`
- [x] PWA: manifest, ícones, precache, prompt de atualização, `navigator.storage.persist()`
- [x] Fontes locais (Inter, Space Grotesk)
- [x] `domain/model` com schemas zod de todas as entidades
- [x] Dexie schema v1 + repositórios
- [x] Seed: predefinição "Padrão", tipos Básico, Básico (e invertido), Omissão
- [x] `ui/primitives` e `ui/patterns` base + `TabBar` + layout com área segura
- [x] `i18n/pt-BR.ts`

## Fase 1 — MVP

- [x] `domain/day` (hora de corte) e `domain/scheduler` (ts-fsrs + etapas) com os testes de `docs/05-agendamento.md`
- [x] `domain/queue` (limites, ordem, irmãos, pai/filhos)
- [x] Baralhos: criar (com `::`), renomear, mover, criar subbaralho, excluir, recolher/expandir
- [x] Tela inicial com árvore e contagens corretas
- [x] Visão geral do baralho (contagens, estimativa, previsão de 7 dias)
- [x] `domain/templates`: `{{Campo}}`, `{{FrontSide}}`, cloze (inclusive dentro de fórmula)
- [x] Editor de nota (Tiptap): formatação, imagem e áudio locais, etiquetas, fixar campo, pré-visualização, histórico, duplicatas
- [x] Fórmulas: nó `math` + KaTeX + sheet do MathLive (`docs/07-formulas.md`)
- [x] Sessão de estudo: frente/verso, 4 botões com intervalos, atalhos, desfazer, marcar, enterrar, suspender, editar, cronômetro, áudio
- [x] Opções do baralho (predefinições, overrides "só este baralho"/"só hoje")
- [x] Navegador: `domain/search`, filtros, ordenação, cartões/notas, lista virtualizada, ações em massa
- [x] Estatísticas: hoje, revisões, retenção, sequência, tempo, heatmap, estado dos cartões, respostas por botão
- [x] Backup: exportar, restaurar (substituir/mesclar com replay), lembrete (`docs/06-dados-e-backup.md`)
- [x] E2E offline: criar baralho → cartão com fração → estudar → estatística; exportar → mesclar em outro perfil

## Fase 2 — Compatibilidade Anki

- [x] Importar `.apkg` legado (worker, progresso, dedupe por `guid`)
- [x] Importar `.apkg` `anki21b` (zstd) e `.colpkg`
- [x] Importar CSV/TXT com mapeamento de colunas e diretivas `#`
- [x] Conversão SM-2 → FSRS via replay
- [x] Exportar `.apkg` (formato legado)

## Fase 3 — Polimento

- [x] Backup automático em pasta (File System Access API)
- [x] "Simular carga" (Monte Carlo sobre o agendador, nas opções do baralho)
- [ ] Otimizar parâmetros FSRS (worker) — depende de decisão de hospedagem, ver `docs/02-stack.md`
- [x] Tipos de nota personalizados (campos e templates)
- [x] Estudo personalizado (esquecidos hoje, por etiqueta, adiantar revisões)
- [x] Modo escuro
