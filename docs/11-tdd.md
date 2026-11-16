# 11 — TDD e testes

TDD aqui não é sugestão: é como o código é escrito. O objetivo é que os testes sejam a **especificação executável** do app — se o teste passa, o comportamento está certo; se alguém (pessoa ou agente) muda o comportamento sem querer, um teste quebra.

## O ciclo

1. **Vermelho** — escreva **um** teste para o próximo comportamento pequeno. Rode. Ele precisa **falhar, e pelo motivo esperado** (asserção, não erro de import/sintaxe). Se passou de primeira, o teste não está testando nada novo: revise.
2. **Verde** — escreva o **mínimo** de código de produção para passar. Nada além do que o teste pede.
3. **Refatorar** — com tudo verde, melhore nomes, remova duplicação, extraia funções. Os testes não mudam nesta etapa.
4. Repita.

Para agentes (Claude Code): ao implementar uma tarefa, mostre o teste falhando (saída do Vitest) antes de escrever a implementação.

## Proibições (valem para qualquer pessoa ou agente)

| Proibido | Por quê |
|---|---|
| Apagar um teste que está falhando | O teste é a especificação; apagar é mudar o requisito escondido. |
| `.skip`, `.only`, `.todo`, `it.fails` em teste existente | Biome bloqueia (`noSkippedTests`, `noFocusedTests`). Não desabilite a regra. |
| Afrouxar asserção: `toEqual(x)` → `toBeDefined()`, `toBe(3)` → `toBeGreaterThan(0)`, `toHaveBeenCalledWith(a)` → `toHaveBeenCalled()` | Teste mais fraco aceita bug. |
| Trocar o valor esperado para "bater" com o que o código devolve | Isso é ajustar a régua à medida errada. Só muda se o **requisito** mudou. |
| Mockar a própria unidade sob teste, ou mockar `src/domain` em teste de domínio | Testa o mock, não o código. |
| `try/catch` engolindo falha de asserção; asserção dentro de `if` | Teste que não pode falhar não é teste. |
| `vitest -u` / atualizar snapshot sem ler o diff | Snapshot atualizado às cegas aceita qualquer coisa. |
| Diminuir os limites de cobertura ou mutação na config | As metas abaixo só sobem. |
| Teste dependente de ordem, de hora real ou de aleatoriedade | Use relógio e ID injetados; `fake-indexeddb` limpo a cada teste. |

**Quando um teste parece errado:** pare e pergunte ao usuário, explicando o conflito entre o teste e o que você acha certo. Se o usuário confirmar a mudança de comportamento, altere o teste **primeiro** (vermelho), depois o código, e explique no commit (`test(study): interval for "hard" now uses ...`).

**Refatorar teste** (renomear, extrair helper, organizar `describe`) é permitido, desde que cada caso continue verificando exatamente o mesmo comportamento com a mesma força.

## Pirâmide

| Nível | O quê | Ferramenta | Onde |
|---|---|---|---|
| **Unitário (maioria)** | `src/domain/**`: agendador, fila, dia de estudo, templates, cloze, busca, estatísticas, import/export (mapeamento) | Vitest | `*.test.ts` ao lado do arquivo |
| **Integração de dados** | `src/data/repositories/**` contra IndexedDB real em memória: transações, índices, migrações de versão | Vitest + `fake-indexeddb` | `*.test.ts` ao lado |
| **Componente** | `src/ui/**` e componentes de `features/**`: comportamento visível — o que aparece, o que acontece ao tocar | Vitest (jsdom) + Testing Library + `user-event` | `*.test.tsx` ao lado |
| **E2E (poucos, fluxos críticos)** | Criar baralho → adicionar cartão com fração → estudar → estatística; backup/restauração; importação; uso offline | Playwright, viewport 390×844, modo offline | `tests/e2e/` |

Regras por nível:

- **Domínio:** funções puras, entrada → saída. Sem mocks (não há o que mockar). Use **tabelas de casos** (`it.each`) para regras com muitas combinações e **testes de propriedade** (`fast-check`) para invariantes, ex.: "responder nunca gera `due` no passado", "fila nunca excede o limite diário", "export → import devolve os mesmos dados".
- **Componente:** consultar por papel e nome acessível (`getByRole('button', { name: 'Bom' })`). Nunca por classe CSS ou `data-testid` quando existe papel. Não testar detalhes de implementação (estado interno, nomes de hooks).
- **Mocks:** só nas bordas que o teste não controla (relógio, `navigator.vibrate`, `AudioContext`). Repositórios em teste de componente: use o banco real em memória, não mock.
- **Nome do teste** descreve o comportamento: `it("buries new siblings until the next study day")`, não `it("works")`.
- **Um comportamento por teste.** Várias asserções são ok se descrevem o mesmo comportamento.

## Metas automáticas (CI e `pnpm check` falham abaixo delas)

| Escopo | Linhas | Branches | Mutação (Stryker) |
|---|---|---|---|
| `src/domain/**` | 95% | 90% | **score ≥ 80%** |
| `src/data/**` | 90% | 85% | — |
| `src/ui/**`, `src/features/**` | 80% | 75% | — |

- Cobertura via `@vitest/coverage-v8` com `thresholds` por glob no `vitest.config.ts`.
- **Teste de mutação** (`@stryker-mutator/core` + runner do Vitest) em `src/domain`: o Stryker altera o código (troca `>` por `>=`, remove linhas, inverte condições) e verifica se algum teste quebra. É o que garante que os testes não ficam "simples demais" — cobertura alta com asserção fraca é pega aqui. Roda no CI em todo PR que tocar `src/domain`.
- Metas só sobem. Ao superar com folga, aumente o limite.

## Definição de pronto

- [ ] Todo comportamento novo tem teste escrito **antes**.
- [ ] Bug corrigido tem teste de regressão que falhava antes da correção.
- [ ] Nenhum teste existente foi apagado, pulado ou afrouxado.
- [ ] `pnpm check` verde; `pnpm test:mutation` verde se mexeu em `src/domain`.
- [ ] E2E do fluxo afetado passa, se a tarefa mexeu em fluxo crítico.
