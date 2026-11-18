# 01 — Produto

## O que é

Um app de flashcards com repetição espaçada para estudar no celular, pelo navegador (PWA instalável). Inspirado no Anki, com interface pensada para toque e com suporte de primeira classe a **fórmulas matemáticas**.

Princípios:

1. **Offline-first.** Tudo roda no navegador, sem backend nem conta. Estudar, criar e editar funcionam sem internet; troca entre dispositivos é por arquivo de backup.
2. **Mobile first.** Projetado para 390px de largura; desktop é a mesma interface com mais respiro.
3. **Compatível com Anki.** Importar `.apkg` e manter o modelo mental (baralhos, notas, cartões, tipos de nota, predefinições).
4. **Rápido.** Responder um cartão e ver o próximo deve levar < 50 ms percebidos.

## Conceitos

| Termo | Significado |
|---|---|
| **Baralho** (`Deck`) | Agrupa cartões. Pode ter subbaralhos (`Inglês::Phrasal verbs`). Contagens do pai incluem os filhos. |
| **Predefinição** (`DeckPreset`) | Conjunto de opções (limites, etapas, FSRS) compartilhado entre baralhos. |
| **Tipo de nota** (`NoteType`) | Define campos (Frente, Verso, …) e modelos de cartão. Ex.: Básico, Básico (e invertido), Omissão (cloze). |
| **Nota** (`Note`) | O conteúdo que o usuário digita (valores dos campos + etiquetas). Uma nota gera 1+ cartões. |
| **Cartão** (`Card`) | O que é estudado. Tem estado de agendamento próprio. Cartões da mesma nota são "irmãos". |
| **Revisão** (`ReviewLog`) | Registro imutável de cada resposta (botão, tempo, estado antes/depois). |

## Telas (design de referência no canvas — ver `docs/09-design.md`)

| Tela | Funções |
|---|---|
| **Baralhos (início)** | Resumo do dia (cartões, tempo estimado, sequência), busca, árvore de baralhos com contagens Novos/Aprendendo/Revisar, recolher/expandir, menu de ações por baralho, botão "Novo baralho", aviso de backup atrasado. |
| **Visão geral do baralho** | Contagens, estimativa, previsão de 7 dias, subbaralhos, estudar, estudo personalizado (esquecidos hoje, etiqueta, adiantar revisões, modo infinito), desfazer, atalhos para navegar/opções/estatísticas/exportar. |
| **Estudo — frente** | Cartão, áudio, progresso, contagens com fila atual destacada, cronômetro, desfazer, marcar (flag), editar, enterrar, suspender, "Mostrar resposta". |
| **Estudo — resposta** | Frente + verso, botões De novo / Difícil / Bom / Fácil com o próximo intervalo, atalhos 1–4, gesto de deslizar. |
| **Estatísticas** | Filtro por baralho e período, resumo de hoje, revisões, retenção real, sequência, tempo, mapa de atividade, estado dos cartões, respostas por botão. |
| **Adicionar / editar cartão** | Tipo de nota, baralho, editor de campos (negrito, itálico, sublinhado, imagem, áudio, omissão, fórmula), fixar campo, etiquetas, pré-visualizar cartões, histórico de adições. |
| **Navegador de cartões** | Busca com sintaxe (`deck:`, `tag:`, `is:`), filtros rápidos, ordenação, modo cartões/notas, seleção múltipla com mover, etiquetar, reagendar, suspender, excluir. |
| **Opções do baralho** | Predefinição (trocar, clonar, renomear, excluir), limites diários (predefinição / só este baralho / só hoje), etapas, intervalos, ordem, lapsos e cartões problemáticos, FSRS (retenção desejada, otimizar, simular), exibição e áudio, enterrar irmãos, restaurar padrões. |
| **Ações do baralho** | Estudar, adicionar, navegar, opções, renomear, criar subbaralho, mover, exportar, redefinir progresso, excluir. |
| **Novo baralho / importar** | Nome (com `::`), baralho-pai, predefinição, descrição; importar `.apkg`/`.colpkg`, `.csv`/`.txt`, restaurar backup. |

## MVP (fases 0–1 do roadmap)

Entra: baralhos e subbaralhos, tipos de nota padrão (Básico, Básico e invertido, Omissão), editor com fórmulas, estudo com FSRS, navegador com busca, opções de baralho, estatísticas, PWA offline, backup com exportar/restaurar/mesclar.

Fica para depois: importação/exportação `.apkg` e CSV (fase 2), backup automático em pasta, tipos de nota personalizados, estudo personalizado, modo escuro (fase 3).

Fora do escopo: backend, conta de usuário, sync em nuvem, baralhos compartilhados online.
