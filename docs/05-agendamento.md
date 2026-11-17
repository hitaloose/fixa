# 05 — Agendamento e fila de estudo

Tudo aqui mora em `src/domain` (`scheduler/`, `queue/`, `day/`) e segue `docs/11-tdd.md`: testes antes, relógio fixo injetado, propriedades com fast-check e mutação ≥ 80%.

## Dia de estudo

- O "dia" começa na **hora de corte** (padrão **04:00** no fuso do dispositivo), igual ao Anki — estudar 00:30 conta para o dia anterior.
- `studyDay(now, cutoffHour, timeZone) → "YYYY-MM-DD"` é a única função que converte instante em dia. Limites diários, sequência, enterrados e estatísticas usam ela.

## Agendador (FSRS via ts-fsrs)

- `answer(card, rating, now, preset) → { nextCard, reviewLog }` — função pura.
- Parâmetros vêm da predefinição: `desiredRetention`, `fsrsWeights` (ou padrão), `maximumIntervalDays`, `enable_fuzz: true`.
- **Etapas de aprendizado** (`learningSteps`, `relearningSteps`) são respeitadas antes de o cartão ir para `review`, como no Anki: cada etapa é um intervalo curto; "De novo" volta para a primeira etapa, "Bom" avança, "Fácil" gradua direto. Usamos as etapas **nativas do ts-fsrs 5** (unidades `m`, `h`, `d`). Como no Anki com FSRS ligado, o intervalo de graduação e o de "Fácil" vêm da estabilidade calculada pelo FSRS: `graduatingIntervalDays` e `easyIntervalDays` ficam guardados (vêm do import do Anki) mas não são usados pelo agendador.
- **Intervalo máximo** é garantido pelo domínio: o ts-fsrs pode passar 1–2 dias de `maximum_interval` para manter Difícil < Bom < Fácil; `answer` e `previewIntervals` cortam no `maximumIntervalDays` da predefinição.
- **`replay(card, logs, preset)`** reconstrói o estado a partir de um cartão novo, aplicando logs não desfeitos em ordem de `reviewedAt`: `review` responde, `reset` recomeça do zero. `reschedule`/`manual` lançam erro até terem semântica definida (fase 1.8). Leech não suspende durante o replay; um cartão suspenso/enterrado continua assim, com o estado FSRS reconstruído.
- `previewIntervals(card, now, preset) → { again, hard, good, easy }` alimenta os rótulos dos botões ("< 1 min", "6 min", "1 dia", "4 dias"). Formatação em `src/lib/format.ts`.
- **Lapsos e cartões problemáticos:** ao chegar em `lapses >= leechThreshold`, aplicar `leechAction` (etiqueta `leech` ou suspender) e avisar com toast.
- **Otimizar parâmetros:** usar o otimizador do ecossistema FSRS sobre os `ReviewLog` do usuário, rodando em Web Worker. Fase 3 — até lá, pesos padrão.

## Montagem da fila (`queue/`)

Entrada: baralho selecionado (inclui subbaralhos), `now`, predefinição + overrides, contagens já feitas hoje (de `ReviewLog`).

1. **Limites efetivos** por baralho: `todayOnly` > `overrides` > preset. Limites de um pai também limitam a soma dos filhos.
2. **Aprendendo/reaprendendo** com `due <= now + learnAheadMinutes (20)` — sem limite diário. Os vencidos (`due <= now`) vêm sempre primeiro; os que ainda vão vencer dentro da janela de 20 min só aparecem depois das revisões e novos, como no Anki.
3. **Revisões** com `due <= fim do dia de estudo`, até `reviewsPerDay − feitasHoje`, ordenadas por `reviewOrder`.
4. **Novos**, até `newPerDay − introduzidosHoje` e sem passar do saldo de revisões, ordenados por `newCardOrder`/`newPosition`.
5. **Intercalação:** novos distribuídos entre as revisões (1 novo a cada N revisões, N = revisões/novos). Aprendendo vencido sempre fura a fila.
6. **Irmãos:** ao responder um cartão, enterrar irmãos conforme `buryNewSiblings`/`buryReviewSiblings` (`queue = "buried"`, `buriedUntilDay = amanhã`).
7. Cartões `suspended`, `buried` (do dia) e excluídos nunca entram.

A fila vive em memória durante a sessão; é recalculada ao abrir a sessão e quando um cartão em aprendizado vence.

## Contagens (tela inicial e do baralho)

`countsFor(deckId, now) → { new, learning, review }` aplicando os mesmos limites da fila (o número mostrado é o que vai ser estudado hoje, não o total existente). Calcular por índice `[deckId+queue+due]`.

## Ações manuais (navegador)

| Ação | Efeito |
|---|---|
| Suspender / reativar | `queue = "suspended"` / volta para a fila derivada do estado FSRS. |
| Enterrar | `queue = "buried"`, `buriedUntilDay = amanhã`. |
| Reagendar | Define `due` para data escolhida, gera `ReviewLog kind="reschedule"`. |
| Esquecer / redefinir | Volta para `new` com nova `newPosition`, zera FSRS, gera `ReviewLog kind="reset"`. |
| Marcar | `flag = 1..7`. |

## Desfazer

Pilha por sessão (últimas 20 ações). Desfazer resposta = restaurar `cardBefore` do `ReviewLog` e setar `undoneAt`. Estatísticas ignoram logs com `undoneAt`.

## Testes obrigatórios

- Sequência de respostas com relógio fixo gera os intervalos esperados (snapshots).
- Virada do dia na hora de corte (inclusive em mudança de fuso).
- Limites de pai com filhos.
- Enterrar irmãos e volta no dia seguinte.
- Desfazer restaura exatamente o estado anterior.
