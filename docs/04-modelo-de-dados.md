# 04 — Modelo de dados

Os tipos canônicos ficam em `src/domain/model/` como **schemas zod**; tipos TS são inferidos (`z.infer`). O schema do Dexie (`src/data/schema/`) espelha esses schemas.

## Campos comuns a toda entidade de usuário

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `string` (UUIDv7) | Gerado no cliente. |
| `createdAt` | `number` (epoch ms) | |
| `updatedAt` | `number` (epoch ms) | Atualizado a cada escrita. Decide quem vence na mescla de backups. |
| `deletedAt` | `number \| null` | Exclusão lógica — necessária para a mescla de backups (ver `docs/06-dados-e-backup.md`). |

## Entidades

### `DeckPreset`
| Campo | Tipo | Padrão |
|---|---|---|
| `name` | string | "Padrão" |
| `newPerDay` | int | 20 |
| `reviewsPerDay` | int | 200 |
| `learningSteps` | string[] (`"1m"`, `"10m"`, `"1d"`) | `["1m","10m"]` |
| `relearningSteps` | string[] | `["10m"]` |
| `graduatingIntervalDays` | int | 1 |
| `easyIntervalDays` | int | 4 |
| `newCardOrder` | `"sequential" \| "random"` | sequential |
| `reviewOrder` | `"due" \| "random" \| "deck"` | due |
| `leechThreshold` | int | 8 |
| `leechAction` | `"tag" \| "suspend"` | tag |
| `desiredRetention` | float 0.70–0.99 | 0.90 |
| `fsrsWeights` | number[] \| null | null (usa os padrões do ts-fsrs) |
| `maximumIntervalDays` | int | 36500 |
| `buryNewSiblings` / `buryReviewSiblings` | bool | true / false |
| `showTimer` / `autoplayAudio` | bool | false / true |

### `Deck`
| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | Só o nome do nó (`"Phrasal verbs"`), não o caminho. |
| `parentId` | string \| null | Hierarquia. O caminho `Inglês::Phrasal verbs` é derivado. |
| `presetId` | string | |
| `description` | string | HTML sanitizado. |
| `collapsed` | bool | Estado da árvore na tela inicial. |
| `overrides` | `{ newPerDay?: int; reviewsPerDay?: int; todayOnly?: { day: string; newPerDay?: int; reviewsPerDay?: int } }` | "Só este baralho" e "Só hoje" da tela de opções. |
| `position` | int | Ordem manual entre irmãos (padrão: alfabética). |

### `NoteType`
| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | "Básico", "Básico (e invertido)", "Omissão" |
| `kind` | `"standard" \| "cloze"` | |
| `fields` | `{ id: string; name: string; sticky: boolean; rtl: boolean }[]` | Ordem importa. |
| `templates` | `{ id: string; name: string; front: string; back: string }[]` | Sintaxe estilo Anki (`{{Frente}}`, `{{FrontSide}}`, `{{cloze:Texto}}`). Cloze tem um template só. |
| `css` | string | CSS do cartão, aplicado num container isolado. |

Tipos padrão criados no primeiro uso (seed) com IDs fixos conhecidos.

### `Note`
| Campo | Tipo | Notas |
|---|---|---|
| `noteTypeId` | string | |
| `fields` | `Record<fieldId, string>` | HTML sanitizado. Fórmulas como `\(...\)` / `\[...\]`. |
| `tags` | string[] | Minúsculas, sem espaço; hierarquia com `::`. |
| `sortField` | string | Texto puro do primeiro campo (para ordenar/buscar). |
| `checksum` | string | Hash do primeiro campo — detecção de duplicatas. |

### `Card`
| Campo | Tipo | Notas |
|---|---|---|
| `noteId` | string | |
| `deckId` | string | O cartão pertence ao baralho, não a nota (igual Anki). |
| `templateOrd` | int | Índice do template (ou número do cloze − 1). |
| `queue` | `"new" \| "learning" \| "review" \| "relearning" \| "suspended" \| "buried"` | Fila efetiva. `suspended`/`buried` guardam o estado FSRS intacto. |
| `state` | `"new" \| "learning" \| "review" \| "relearning"` | Estado FSRS. Igual a `queue`, exceto quando suspenso/enterrado — é o que permite reativar o cartão sem perder o estado. Também vai no snapshot `cardBefore` do `ReviewLog`. |
| `buriedUntilDay` | string \| null | `"2026-11-17"` — volta automaticamente. |
| `newPosition` | int | Ordem de introdução dos novos. Ao criar, recebe o instante de criação da nota (epoch ms), como o Anki faz com o id da nota: cartões irmãos ficam juntos e a ordem sobrevive a backup/mescla. |
| `due` | number (epoch ms) | Próxima apresentação. |
| `stability` | float | FSRS. |
| `difficulty` | float | FSRS. |
| `elapsedDays` / `scheduledDays` | int | FSRS. |
| `learningStep` | int | Índice da etapa atual de aprendizado/reaprendizado. |
| `reps` / `lapses` | int | |
| `lastReviewAt` | number \| null | |
| `flag` | 0–7 | 0 = sem marca. |

### `ReviewLog` (append-only)
| Campo | Tipo | Notas |
|---|---|---|
| `cardId` | string | |
| `reviewedAt` | number | |
| `rating` | 0–4 | De novo (1), Difícil, Bom, Fácil (4) em `kind="review"`; 0 nos outros tipos, que não são respostas. |
| `stateBefore` | `"new" \| "learning" \| "review" \| "relearning"` | |
| `cardBefore` | snapshot dos campos FSRS | Permite "desfazer" e replay. |
| `scheduledDays` / `elapsedDays` | int | |
| `durationMs` | int | Tempo até responder (limitado a 60 s, configurável). |
| `kind` | `"review" \| "manual" \| "reschedule" \| "reset"` | Reagendar/redefinir no navegador também gera log. |
| `undoneAt` | number \| null | "Desfazer" não apaga; marca. |

### `Media`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | **SHA-256 do conteúdo** (não UUID) — deduplicação natural. |
| `fileName` | string | Nome como referenciado no HTML (`<img src="sha.png">`). |
| `mime` | string | |
| `size` | int | |
| `blob` | Blob | Só no cliente. |

### Tabelas auxiliares (não entram na mescla)

- `addHistory`: últimos N `noteId` adicionados (tela "Histórico de adições").
- `settings`: preferências do dispositivo (hora de corte do dia, tema, haptics, `lastBackupAt`).

## Índices Dexie (ponto de partida)

```ts
db.version(1).stores({
  presets:    "id, deletedAt",
  decks:      "id, parentId, presetId, deletedAt",
  noteTypes:  "id, deletedAt",
  notes:      "id, noteTypeId, checksum, *tags, updatedAt, deletedAt",
  cards:      "id, noteId, deckId, [deckId+queue+due], [deckId+queue+newPosition], queue, due, flag, deletedAt",
  reviewLogs: "id, cardId, reviewedAt, [cardId+reviewedAt]",
  media:      "id, fileName",
  addHistory: "++id, noteId",
  settings:   "key",
});
```

Toda mudança de schema = nova `db.version(n)` com `upgrade()` em `src/data/schema/vN.ts`; nunca editar uma versão publicada; toda migração tem teste.
