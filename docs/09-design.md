# 09 — Design

**Referência visual:** canvas "App de flashcards — mobile first" (10 telas, 390×844): https://claude.ai/artifact/6ZCS69wAiwAtj7Atx8DgkW

O canvas é a referência de layout e hierarquia; os tokens abaixo são a fonte de verdade para o código. Implementar em `src/app/styles/theme.css` com `@theme` do Tailwind v4.

## Tokens

### Cores

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#F5F3EE` | Fundo das telas |
| `--color-surface` | `#FFFFFF` | Cartões, listas, sheets |
| `--color-ink` | `#17181C` | Texto principal, blocos escuros (resumo do dia, botão "Mostrar resposta") |
| `--color-muted` | `#5E6068` | Texto secundário |
| `--color-faint` | `#8A8C93` | Zeros, chevrons |
| `--color-line` | `#E3E0D8` | Bordas |
| `--color-line-soft` | `#EEEBE4` | Divisórias internas de lista |
| `--color-primary` | `#2B4FD8` | Ação principal, item ativo da navegação |
| `--color-new` | `#2B4FD8` (fundo `#EEF1FC`, texto em fundo `#2440B8`) | Contagem de novos |
| `--color-learning` | `#B4530A` (fundo `#FCF0E6`, texto `#93430A`) | Aprendendo |
| `--color-review` | `#23744A` (fundo `#E8F3EC`, texto `#1E6640`) | Revisar |
| `--color-danger` | `#B42318` | Excluir, "De novo" |

Botões de resposta: De novo `#FBE9E7`/`#A11F15` · Difícil `#ECEBE6`/`#2F3136` · Bom `#E3F1E8`/`#1A5C39` · Fácil `#E6EBFB`/`#2440B8`.

As três filas diferem também em claridade, não só em matiz (acessível para daltonismo).

### Tipografia

- Títulos e números grandes: **Space Grotesk** 600–700 (32px título de tela, 28px título de baralho, 34px frente do cartão).
- Interface e corpo: **Inter** 400–600 (15px padrão, 13px secundário, 11–12px rótulos).
- Hospedar as fontes localmente (`@fontsource/inter`, `@fontsource/space-grotesk`) — o PWA precisa delas offline.

### Forma e espaço

- Raio: 20px (seções), 16px (listas, CTA), 14px (campos, botões de resposta), 12px (botões secundários), 999px (chips).
- Espaçamento base 4px; padding lateral das telas 16px; gap entre seções 14–16px.
- Navegação inferior: 84px de altura (inclui área segura), 4 itens: Baralhos, Navegar, Adicionar, Estatísticas.
- Respeitar `env(safe-area-inset-*)`.

## Marca

- **Logo "Fração":** o nome escrito como fração empilhada, "fi" sobre "xa", em creme `#F5F3EE` sobre tinta `#17181C`, com a barra da fração em azul `#2B4FD8`. A barra é também a linha que separa frente e verso do cartão; junta os dois assuntos do app, flashcards e fórmulas.
- **Fonte:** Space Grotesk Bold, convertida em contornos em `public/favicon.svg` (o ícone não depende de fonte instalada).
- **Proporções (grade de 512):** canto 112, letras em corpo 170 centralizadas, barra 272 × 28 com pontas arredondadas, conjunto centralizado na vertical.
- **Arquivos:** `public/favicon.svg` é a fonte única; `scripts/render-icons.mjs` gera `pwa-192.png`, `pwa-512.png` e `apple-touch-icon.png` a partir dele. Para mudar o ícone, edite o SVG e rode o script.
- **Tamanho mínimo:** legível em 16 px. Não trocar as cores entre si nem usar a barra em outra cor.

## Componentes de UI (`src/ui`)

- `ui/primitives`: `Button` (primary, secondary, ghost, danger) · `IconButton` (exige `aria-label`) · `Input` · `Textarea` · `Switch` · `Slider` · `Chip` · `Badge` · `Icon`.
- `ui/patterns`: `Sheet` (bottom sheet com Vaul) · `ListGroup`/`ListRow` · `Stepper` · `FilterChip` · `SegmentedControl` · `SearchField` · `TabBar` · `EmptyState` · `Toast`.
- Componentes com regra de negócio ficam na feature, não em `ui` (ex.: `CountTriplet` novos/aprend./revisar fica em `features/decks`).

Todo componente de `ui` tem teste de comportamento e acessibilidade (papel, nome acessível, teclado) — ver `docs/11-tdd.md`.

## Interação

- Alvos de toque ≥ 44px.
- Estudo: atalhos de teclado 1–4 e espaço (mostrar resposta); gestos de deslizar opcionais (esquerda = De novo, direita = Bom), configuráveis.
- Haptics (`navigator.vibrate`) curtos ao responder, desligáveis.
- Animações curtas (≤ 200 ms) e respeitar `prefers-reduced-motion`.
