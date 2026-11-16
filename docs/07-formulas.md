# 07 — Fórmulas matemáticas

Caso de uso central: memorizar fórmulas com frações empilhadas (`3/4` com barra horizontal), raízes, potências, somatórios, integrais.

## Armazenamento

Fórmulas ficam **dentro do HTML do campo** como LaTeX, com os delimitadores do Anki:

| Tipo | Sintaxe | Exibição |
|---|---|---|
| Na linha | `\( \frac{3}{4} \)` | junto do texto |
| Em destaque | `\[ x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} \]` | centralizada, em bloco |

Isso mantém compatibilidade total com `.apkg` (o Anki usa os mesmos delimitadores com MathJax).

## Exibição — KaTeX

- `src/lib/math/render.ts`: depois de montar o HTML do cartão (já sanitizado), chamar `renderMathInElement(el, { delimiters: [{left:"\\(",right:"\\)",display:false},{left:"\\[",right:"\\]",display:true}], throwOnError: false })`.
- Importar KaTeX e o CSS **sob demanda** (dynamic import) só quando o HTML contém `\(` ou `\[`.
- Fórmula com erro: mostrar o LaTeX cru em vermelho discreto, nunca quebrar o cartão.
- Fórmula em bloco larga demais: container com `overflow-x: auto` (rolar no celular em vez de encolher).
- Omissão (cloze) dentro de fórmula: suportar `{{c1::\frac{a}{b}}}` renderizando o trecho oculto como `[…]` — implementar no `domain/templates` antes da etapa do KaTeX.

## Edição — Tiptap + MathLive

- O editor de campo é Tiptap. Existe um **nó `math`** (inline e bloco) que guarda o LaTeX como atributo e é serializado para `\(...\)` / `\[...\]` no HTML salvo.
- No editor, o nó aparece **renderizado pelo KaTeX**. Tocar nele abre um **bottom sheet** com o `<math-field>` do MathLive:
  - teclado matemático virtual do MathLive ativado no celular;
  - digitar `3/4` já vira fração empilhada;
  - pré-visualização ao vivo e alternância "visual / LaTeX" para quem prefere digitar;
  - botões "Na linha" / "Em destaque".
- Botão **Σ** na barra de formatação insere um nó novo e já abre o sheet.
- Colar texto com `\(...\)` no editor converte automaticamente em nós `math`.
- MathLive é carregado sob demanda (é pesado) só ao abrir o sheet.

## Testes

- Ida e volta: HTML com fórmulas → Tiptap → HTML idêntico.
- Cloze dentro de fórmula na frente e no verso.
- Snapshot visual (Playwright) de um cartão com fração, raiz e matriz em 390px.
