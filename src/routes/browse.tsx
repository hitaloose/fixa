import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrowserScreen, type BrowserSearch } from "../features/browser";

const SORTS = ["added", "due", "text", "modified"] as const;
const MODES = ["cards", "notes"] as const;

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): BrowserSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    sort: oneOf(SORTS, search.sort, "added"),
    mode: oneOf(MODES, search.mode, "cards"),
  }),
  component: function BrowseRoute() {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: "/browse" });
    return (
      <BrowserScreen
        search={search}
        onSearchChange={(next) => void navigate({ search: next, replace: true })}
      />
    );
  },
});
