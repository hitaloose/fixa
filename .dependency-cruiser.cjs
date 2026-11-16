/** Layer rules from docs/03-arquitetura.md. Do not loosen. */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-pure",
      comment: "domain imports only domain (+ pure libs ts-fsrs, zod).",
      severity: "error",
      from: { path: "^src/domain/", pathNot: "\\.test\\.tsx?$" },
      to: {
        pathNot: ["^src/domain/", "node_modules/(ts-fsrs|zod)/"],
      },
    },
    {
      name: "lib-imports-nothing-from-project",
      severity: "error",
      from: { path: "^src/lib/" },
      to: { path: "^src/", pathNot: "^src/lib/" },
    },
    {
      name: "ui-only-lib-i18n",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: "^src/(features|data|domain|routes|app|workers)/" },
    },
    {
      name: "data-only-domain-model-and-lib",
      severity: "error",
      from: { path: "^src/data/" },
      to: {
        path: ["^src/(features|ui|routes|app|workers|i18n)/", "^src/domain/(?!model/|ports\\.ts)"],
      },
    },
    {
      name: "data-no-react",
      severity: "error",
      from: { path: "^src/(data|domain)/" },
      to: { path: "node_modules/(react|react-dom)/" },
    },
    {
      name: "features-do-not-import-each-other",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/([^/]+)/", pathNot: "^src/features/$1/" },
    },
    {
      name: "features-not-routes-or-app",
      severity: "error",
      from: { path: "^src/features/" },
      to: { path: "^src/(routes|app|workers)/" },
    },
    {
      name: "routes-only-feature-public-api",
      severity: "error",
      from: { path: "^src/routes/" },
      to: {
        path: ["^src/(data|domain|lib)/", "^src/features/[^/]+/(?!index\\.ts$)"],
      },
    },
    {
      name: "workers-only-domain-lib",
      severity: "error",
      from: { path: "^src/workers/" },
      to: { path: "^src/(features|ui|data|routes|app)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "routeTree\\.gen\\.ts$" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
