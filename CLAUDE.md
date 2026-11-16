# Fixa

App web **mobile first** de flashcards com repetição espaçada (estilo Anki), instalável como PWA. **Só frontend: não existe backend.** Todos os dados vivem no navegador (IndexedDB); backup e troca entre dispositivos são por arquivo.

## Regra nº 1: TDD

Este projeto é desenvolvido com **TDD estrito**. Leia `docs/11-tdd.md` antes de qualquer código. Resumo inegociável:

1. **Nenhum código de produção sem um teste falhando antes.** Escreva o teste, rode, veja falhar pelo motivo certo, só então implemente.
2. **Nunca enfraqueça um teste para ele passar.** Proibido: apagar teste, `.skip`, `.only`, `.todo` no lugar de teste existente, afrouxar asserção (`toEqual` → `toBeDefined`, valor exato → `toBeTruthy`), trocar valor esperado para bater com a saída atual, mockar a própria unidade sob teste, atualizar snapshot sem revisar o diff.
3. **Se um teste parece errado, pare e pergunte.** Não "corrija" o teste por conta própria. A única exceção é quando o próprio pedido do usuário muda o comportamento esperado — e aí o teste muda **primeiro**, no mesmo commit, com o motivo na mensagem.
4. **Bug = teste de regressão primeiro**, reproduzindo o bug, falhando.
5. Uma tarefa só está pronta com `pnpm check` verde (lint + boundaries + typecheck + testes + cobertura).

## Leia antes de codar

| Doc | Quando ler |
|---|---|
| `docs/11-tdd.md` | **Sempre.** Como testar, o que é proibido, metas de cobertura e mutação |
| `docs/01-produto.md` | Escopo, telas, MVP |
| `docs/02-stack.md` | Toda escolha de lib/ferramenta e o porquê; registro de decisões |
| `docs/03-arquitetura.md` | **Estrutura de pastas e regras de dependência** |
| `docs/04-modelo-de-dados.md` | Antes de mexer em entidade ou schema |
| `docs/05-agendamento.md` | Fila de estudo, FSRS, limites diários |
| `docs/06-dados-e-backup.md` | Persistência, migrações, backup e troca entre dispositivos |
| `docs/07-formulas.md` | Fórmulas (LaTeX, KaTeX, MathLive) |
| `docs/08-import-export.md` | `.apkg`, `.csv` |
| `docs/09-design.md` | Tokens visuais, componentes de UI, acessibilidade |
| `docs/10-roadmap.md` | Fases e checklist — **marque o que concluir** |

## Comandos

```bash
pnpm install
pnpm dev              # Vite
pnpm test             # Vitest (watch em dev)
pnpm test:run         # Vitest uma vez, com cobertura
pnpm test:mutation    # Stryker em src/domain
pnpm test:e2e         # Playwright (viewport 390×844)
pnpm lint             # Biome
pnpm format           # Biome --write
pnpm typecheck        # tsc --noEmit
pnpm boundaries       # dependency-cruiser (regras de import entre camadas)
pnpm check            # lint + boundaries + typecheck + test:run  ← obrigatório antes de concluir
```

## Regras do projeto

- **Idioma:** código, nomes, testes, commits e comentários em **inglês**. Textos da interface em **pt-BR**, só em `src/i18n/pt-BR.ts`.
- **Camadas** (detalhe em `docs/03-arquitetura.md`): `routes → features → ui | data | domain | lib`. `domain` não importa nada do projeto além de si mesmo. `features` não importam umas das outras. Isso é verificado pelo `pnpm boundaries` — não contorne.
- **`src/domain` é puro:** sem React, sem Dexie, sem DOM, sem `Date.now()`/`Math.random()` diretos (relógio e IDs são injetados).
- **Acesso a dados só por `src/data/repositories`.** Componentes usam hooks da própria feature.
- **IDs UUIDv7** gerados no cliente. **Exclusão lógica** (`deletedAt`) em entidades de usuário.
- **HTML de campo sempre sanitizado** (DOMPurify) antes de renderizar.
- **TypeScript strict**, sem `any`; dados externos (arquivos importados) validados com zod.
- **Acessibilidade:** alvo de toque ≥ 44px, `<button>`/`<a>` reais, `aria-label` em botão só com ícone, contraste ≥ 4.5:1. Testes de componente buscam por papel (`getByRole`), o que já cobra isso.
- **Dependências novas:** só com justificativa registrada em `docs/02-stack.md`.
- **Commits:** Conventional Commits. Em TDD, o histórico pode mostrar `test:` antes de `feat:`.
- Ao concluir item do roadmap, marque em `docs/10-roadmap.md`.
