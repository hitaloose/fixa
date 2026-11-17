# 08 — Importação e exportação

Todo import roda em `src/workers/import.worker.ts`; a lógica de conversão fica em `src/domain/import/` e é testada com arquivos de exemplo em `tests/fixtures/`.

## Backup próprio

Formato, restauração e mescla estão em `docs/06-dados-e-backup.md`.

## `.apkg` / `.colpkg` do Anki (fase 2)

Um `.apkg` é um zip com:

| Arquivo | Formato |
|---|---|
| `collection.anki21b` | SQLite **comprimido com zstd** (exportações recentes) |
| `collection.anki21` / `collection.anki2` | SQLite sem compressão (formato legado / "suportar versões antigas") |
| `media` | Mapa número → nome do arquivo (JSON no legado; protobuf + zstd no formato novo) |
| `0`, `1`, `2`… | Arquivos de mídia (podem estar comprimidos com zstd no formato novo) |

Pipeline: `fflate.unzip` → (se `anki21b`) `fzstd.decompress` → `sql.js` abre o banco → ler tabelas → mapear → validar com zod → enviar em lotes para a thread principal.

**Implementado (2026-11-17):** legado e `anki21b`. No `anki21b` o leitor (`lib/anki/apkg.ts`) descomprime com fzstd e remonta, a partir das tabelas `notetypes`/`fields`/`templates`/`decks`/`deck_config` (blobs protobuf, números de campo conferidos nos `.proto` oficiais), o mesmo JSON do formato legado, então o mapeamento é um só. Pacotes com `meta` de versão desconhecida (> 3) recebem a mensagem para reexportar. Fixtures: `tests/fixtures/anki/legacy.apkg` (script Python) e `anki21b.apkg` (script Node); um teste garante que os dois importam igual.

Comece pelo **formato legado** (`collection.anki2`/`anki21`, media em JSON) — é o que o Anki gera com "Suportar versões antigas do Anki" marcado — e depois o `anki21b`. Se o arquivo for de um formato ainda não suportado, mostrar mensagem clara pedindo para reexportar com essa opção.

Mapeamento:

| Anki | Fixa |
|---|---|
| `decks` (tabela ou `col.decks` JSON), nome com `\x1f` como separador de hierarquia no formato novo / `::` no legado | `Deck` com `parentId` |
| `deck_config` / `col.dconf` | `DeckPreset` (limites, etapas, `desiredRetention` se FSRS) |
| `notetypes` + `fields` + `templates` / `col.models` | `NoteType` (templates convertidos; CSS mantido) |
| `notes.flds` (campos separados por `\x1f`), `notes.tags` (separadas por espaço) | `Note` |
| `cards` (`type`, `queue`, `due`, `ivl`, `factor`, `reps`, `lapses`, `odid`) | `Card` |
| `revlog` | `ReviewLog` |

**Estado de agendamento:** se o cartão tem dados FSRS (`cards.data` com `s`/`d`), usar. Senão (SM-2), estimar com o replay do `revlog` via ts-fsrs; sem revlog, usar `ivl` como `scheduledDays` e stability ≈ `ivl`. `due` no Anki é **dia relativo à criação da coleção** para revisões e **segundos** para aprendizado — converter com `col.crt`.

**IDs:** gerar UUIDv7 novos; guardar `ankiId` em um mapa para reimportações não duplicarem (`notes.guid` do Anki é estável — usar para dedupe).

**Mídia:** calcular SHA-256, gravar em `Media`, reescrever `src="nome.png"` no HTML para o novo `fileName`.

## `.csv` / `.txt` (fase 2)

- Detectar separador (vírgula, ponto e vírgula, tab) e cabeçalho; respeitar diretivas do Anki (`#separator:`, `#html:`, `#deck:`, `#notetype:`, `#tags:`).
- Tela de mapeamento coluna → campo, com pré-visualização das 5 primeiras linhas.
- Dedupe pelo `checksum` do primeiro campo: pular, atualizar ou duplicar.

## Exportar `.apkg` (fase 2)

Gerar no formato legado para máxima compatibilidade.

**Implementado (2026-11-17):** `collection.anki2` (esquema 11) + mapa de mídia em JSON, gerado no worker. `domain/export/anki` converte entidades em linhas do Anki: tipos de nota, baralhos com caminho `::`, predefinições (etapas em minutos), notas (`[sound:]` de volta), cartões (tipo/fila/vencimento no formato do Anki, memória FSRS em `cards.data` como `{s, d}`) e respostas não desfeitas. `notes.csum` é o SHA-1 do primeiro campo. Exporta um baralho com subbaralhos (ações do baralho) ou tudo (Ajustes). **Verificação:** ida e volta exportar → importar no próprio Fixa (domínio, dados e e2e). Ainda não foi validado abrindo o arquivo no Anki de verdade; fazer isso antes de anunciar a função.
