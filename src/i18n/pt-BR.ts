/** Every UI string lives here (CLAUDE.md › Idioma). */

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
/** pt-BR uses the singular below 2 ("1,5 mês"). */
const unit = (n: number, singular: string, plural: string) =>
  `${decimal.format(n)} ${n < 2 ? singular : plural}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const t = {
  common: { close: "Fechar", cancel: "Cancelar" },
  decks: {
    title: "Baralhos",
    newDeck: "Novo baralho",
    empty: "Nenhum baralho ainda.",
    emptyHint: "Crie um baralho para começar a estudar.",
    search: "Buscar baralhos",
    clearSearch: "Limpar busca",
    noResults: "Nenhum baralho encontrado.",
    listLabel: "Lista de baralhos",
    today: "Hoje",
    todayCards: (n: number) => plural(n, "cartão", "cartões"),
    todayMinutes: (n: number) => `~${n} min`,
    nothingToday: "Nada para estudar hoje.",
    counts: (c: { new: number; learning: number; review: number }) =>
      `${plural(c.new, "novo", "novos")}, ${c.learning} aprendendo, ${c.review} para revisar`,
    expand: (name: string) => `Expandir ${name}`,
    collapse: (name: string) => `Recolher ${name}`,
    actionsFor: (name: string) => `Ações de ${name}`,
    form: {
      name: "Nome",
      pathHint: "Use :: para criar subbaralhos, ex.: Inglês::Phrasal verbs",
      create: "Criar",
      save: "Salvar",
    },
    actions: {
      rename: "Renomear",
      addSubdeck: "Criar subbaralho",
      move: "Mover",
      delete: "Excluir",
      overview: "Abrir visão geral",
    },
    move: { label: "Mover para", topLevel: "Nível superior", confirm: "Mover" },
    remove: {
      title: (name: string) => `Excluir “${name}”?`,
      description: "O baralho, seus subbaralhos e cartões vão para a lixeira.",
      confirm: "Excluir",
    },
    errors: {
      exists: "Já existe um baralho com esse caminho.",
      "name-taken": "Já existe um baralho com esse nome aqui.",
      cycle: "Não dá para mover um baralho para dentro dele mesmo.",
      "invalid-name": "Digite um nome válido, sem partes vazias.",
      "not-found": "Esse baralho não existe mais.",
    },
  },
  app: { name: "Fixa" },
  nav: {
    label: "Navegação principal",
    decks: "Baralhos",
    browse: "Navegar",
    add: "Adicionar",
    stats: "Estatísticas",
  },
  overview: {
    back: "Voltar para baralhos",
    new: "Novos",
    learning: "Aprendendo",
    review: "Revisar",
    estimate: (n: number) => `Cerca de ${n} min hoje`,
    forecast: "Próximos 7 dias",
    forecastItem: (label: string, n: number) => `${label}: ${plural(n, "cartão", "cartões")}`,
    today: "Hoje",
    tomorrow: "Amanhã",
    /** "2026-11-19" → "qui." */
    weekday: (day: string) =>
      new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(
        Date.parse(`${day}T12:00:00Z`),
      ),
    subdecks: "Subbaralhos",
    notFound: "Esse baralho não existe mais.",
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
