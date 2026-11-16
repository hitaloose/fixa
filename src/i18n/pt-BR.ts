/** Every UI string lives here (CLAUDE.md › Idioma). */
export const t = {
  app: { name: "Fixa" },
  nav: {
    label: "Navegação principal",
    decks: "Baralhos",
    browse: "Navegar",
    add: "Adicionar",
    stats: "Estatísticas",
  },
  pwa: {
    updateAvailable: "Nova versão disponível.",
    update: "Atualizar",
    dismiss: "Agora não",
  },
  seed: {
    presetName: "Padrão",
    basic: "Básico",
    basicReversed: "Básico (e invertido)",
    cloze: "Omissão",
    front: "Frente",
    back: "Verso",
    text: "Texto",
    extra: "Verso extra",
    card: (n: number) => `Cartão ${n}`,
  },
} as const;
