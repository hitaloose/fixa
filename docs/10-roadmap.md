# 10 — Roadmap

Marque `[x]` ao concluir. Cada fase termina com o app utilizável. Todo item segue `docs/11-tdd.md`: teste antes, `pnpm check` verde ao final.

## Fase 0 — Fundação

- [ ] Vite + React 19 + TypeScript strict + TanStack Router + Tailwind v4 com tokens de `docs/09-design.md`
- [ ] Biome (com `noSkippedTests`/`noFocusedTests` como erro), dependency-cruiser com as regras de `docs/03-arquitetura.md`
- [ ] Vitest + coverage com thresholds por pasta, Testing Library, fake-indexeddb, fast-check, Stryker em `src/domain`, Playwright
- [ ] Script `pnpm check` e GitHub Actions rodando-o (+ mutação e e2e)
- [ ] `tests/factories` (makeDeck, makeNote, makeCard, makeReviewLog, makePreset)
- [ ] `domain/ports.ts` (Clock, IdGenerator) + implementações em `lib/`
- [ ] PWA: manifest, ícones, precache, prompt de atualização, `navigator.storage.persist()`
- [ ] Fontes locais (Inter, Space Grotesk)
- [ ] `domain/model` com schemas zod de todas as entidades
- [ ] Dexie schema v1 + repositórios
- [ ] Seed: predefinição "Padrão", tipos Básico, Básico (e invertido), Omissão
- [ ] `ui/primitives` e `ui/patterns` base + `TabBar` + layout com área segura
- [ ] `i18n/pt-BR.ts`

## Fase 1 — MVP

- [ ] `domain/day` (hora de corte) e `domain/scheduler` (ts-fsrs + etapas) com os testes de `docs/05-agendamento.md`
- [ ] `domain/queue` (limites, ordem, irmãos, pai/filhos)
- [ ] Baralhos: criar (com `::`), renomear, mover, criar subbaralho, excluir, recolher/expandir
- [ ] Tela inicial com árvore e contagens corretas
- [ ] Visão geral do baralho (contagens, estimativa, previsão de 7 dias)
- [ ] `domain/templates`: `{{Campo}}`, `{{FrontSide}}`, cloze (inclusive dentro de fórmula)
- [ ] Editor de nota (Tiptap): formatação, imagem e áudio locais, etiquetas, fixar campo, pré-visualização, histórico, duplicatas
- [ ] Fórmulas: nó `math` + KaTeX + sheet do MathLive (`docs/07-formulas.md`)
- [ ] Sessão de estudo: frente/verso, 4 botões com intervalos, atalhos, desfazer, marcar, enterrar, suspender, editar, cronômetro, áudio
- [ ] Opções do baralho (predefinições, overrides "só este baralho"/"só hoje")
- [ ] Navegador: `domain/search`, filtros, ordenação, cartões/notas, lista virtualizada, ações em massa
- [ ] Estatísticas: hoje, revisões, retenção, sequência, tempo, heatmap, estado dos cartões, respostas por botão
- [ ] Backup: exportar, restaurar (substituir/mesclar com replay), lembrete (`docs/06-dados-e-backup.md`)
- [ ] E2E offline: criar baralho → cartão com fração → estudar → estatística; exportar → mesclar em outro perfil

## Fase 2 — Compatibilidade Anki

- [ ] Importar `.apkg` legado (worker, progresso, dedupe por `guid`)
- [ ] Importar `.apkg` `anki21b` (zstd) e `.colpkg`
- [ ] Importar CSV/TXT com mapeamento de colunas e diretivas `#`
- [ ] Conversão SM-2 → FSRS via replay
- [ ] Exportar `.apkg` (formato legado)

## Fase 3 — Polimento

- [ ] Backup automático em pasta (File System Access API)
- [ ] Otimizar parâmetros FSRS (worker) e "Simular carga"
- [ ] Tipos de nota personalizados (campos e templates)
- [ ] Estudo personalizado (esquecidos hoje, por etiqueta, adiantar revisões)
- [ ] Modo escuro
