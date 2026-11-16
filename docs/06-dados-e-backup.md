# 06 — Dados, persistência e backup

Não há servidor: **o IndexedDB do navegador é o único lugar onde os dados existem.** Tudo neste doc serve para que o usuário nunca perca o que estudou.

## Persistência

- No primeiro uso, chamar `navigator.storage.persist()`. Sem isso, o navegador pode apagar o IndexedDB quando faltar espaço (Safari/iOS é o mais agressivo).
- Mostrar em Ajustes: se o armazenamento está persistente e o uso (`navigator.storage.estimate()`).
- **iOS:** dados de um site no Safari e do mesmo app instalado na tela inicial são separados. Orientar a instalar antes de começar a estudar.

## Migrações de schema

- Cada versão do Dexie fica em `src/data/schema/vN.ts` e **nunca é editada depois de publicada**.
- Mudança = nova versão com `upgrade(tx => …)`.
- Toda migração tem teste: cria banco na versão anterior com dados de exemplo (via `tests/factories`), abre na nova, verifica os dados transformados.

## Backup (é o "sync" do projeto)

### Formato

`fixa-backup-YYYY-MM-DD.fixa` — JSON comprimido com gzip (fflate):

```ts
{
  format: "fixa-backup",
  version: 1,                 // versão do formato, independente do schema do Dexie
  exportedAt: number,
  appVersion: string,
  data: { presets, decks, noteTypes, notes, cards, reviewLogs, settings },
  media: [{ id /* sha-256 */, fileName, mime, base64 }]
}
```

Schema zod em `src/domain/backup/`. Importar backup de versão antiga: converter versão a versão (`v1 → v2 → …`), cada conversão testada.

### Exportar

- Completo (com mídia e histórico) ou leve (sem mídia; sem histórico de revisões).
- Usa a **Web Share API** com arquivo quando disponível (celular: salvar no Drive/Arquivos, mandar para si mesmo) e download comum como alternativa.

### Restaurar / mesclar

Ao importar um backup, o usuário escolhe:

| Modo | Efeito |
|---|---|
| **Substituir** | Apaga tudo local e carrega o backup. Pede confirmação digitando "substituir". |
| **Mesclar** | Para cada registro: se não existe, insere; se existe, fica o de `updatedAt` maior. `ReviewLog` é só inserção (dedupe por `id`). Cartões que receberam logs novos têm o estado **recalculado por replay** dos logs (`domain/scheduler.replay`), para não perder revisões feitas nos dois aparelhos. |

É assim que se usa em dois dispositivos: exporta de um, mescla no outro.

### Lembrete de backup

- Guardar `lastBackupAt` em `settings`.
- Se passaram **7 dias** (configurável) com revisões novas, mostrar aviso discreto na tela inicial: "Seu último backup foi há 9 dias".
- Backup automático opcional usando a **File System Access API** (Chrome/Edge desktop e Android): o usuário escolhe uma pasta uma vez, e o app grava o backup lá ao fim de cada sessão. Onde a API não existe, fica só o lembrete.

## Exclusão

- Entidades de usuário usam `deletedAt` (lixeira). "Esvaziar lixeira" e exclusões com mais de 30 dias são apagadas fisicamente.
- O motivo do `deletedAt` é a **mescla de backups**: sem ele, um cartão apagado num aparelho voltaria ao mesclar o backup do outro.

## Testes obrigatórios

- Propriedade (fast-check): `import(export(db))` devolve dados equivalentes.
- Mescla é comutativa para os dados finais: mesclar A em B e B em A produz o mesmo conteúdo.
- Revisões feitas no mesmo cartão nos dois lados: replay produz o mesmo estado nos dois.
- Exclusão num lado sobrevive à mescla.
- Migração de cada versão de schema e de cada versão do formato de backup.
