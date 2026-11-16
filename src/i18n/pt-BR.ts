/** Every UI string lives here (CLAUDE.md › Idioma). */

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
/** pt-BR uses the singular below 2 ("1,5 mês"). */
const unit = (n: number, singular: string, plural: string) =>
  `${decimal.format(n)} ${n < 2 ? singular : plural}`;

export const t = {
  app: { name: "Fixa" },
  nav: {
    label: "Navegação principal",
    decks: "Baralhos",
    browse: "Navegar",
    add: "Adicionar",
    stats: "Estatísticas",
  },
  interval: {
    lessThanMinute: "< 1 min",
    minutes: (n: number) => `${n} min`,
    hours: (n: number) => `${n} h`,
    days: (n: number) => unit(n, "dia", "dias"),
    months: (n: number) => unit(n, "mês", "meses"),
    years: (n: number) => unit(n, "ano", "anos"),
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
