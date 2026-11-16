import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";
import { TabBar, type TabBarItem } from "./TabBar";

function FakeLink(props: { href: string; className?: string; children?: React.ReactNode }) {
  return <a {...props} data-router="yes" />;
}

const items: TabBarItem[] = [
  { href: "/", label: "Baralhos", icon: "decks", active: true },
  { href: "/browse", label: "Navegar", icon: "browse", active: false },
  { href: "/add", label: "Adicionar", icon: "add", active: false },
  { href: "/stats", label: "Estatísticas", icon: "stats", active: false },
];

describe("TabBar", () => {
  it("is a labelled navigation landmark", () => {
    render(<TabBar label="Navegação principal" items={items} />);
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("renders one link per item, in order, named by its label", () => {
    render(<TabBar label="Navegação principal" items={items} />);
    const nav = screen.getByRole("navigation");
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Baralhos", "Navegar", "Adicionar", "Estatísticas"]);
    expect(screen.getByRole("link", { name: "Navegar" })).toHaveAttribute("href", "/browse");
  });

  it("marks only the active item as the current page", () => {
    render(<TabBar label="Navegação principal" items={items} />);
    expect(screen.getByRole("link", { name: "Baralhos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Navegar" })).not.toHaveAttribute("aria-current");
  });

  it("renders links with a custom link component (for the router)", () => {
    render(<TabBar label="Nav" items={items} linkAs={FakeLink} />);
    expect(screen.getByRole("link", { name: "Adicionar" })).toHaveAttribute("data-router", "yes");
  });
});

describe("AppShell", () => {
  it("renders content in the main landmark and the navigation after it", () => {
    render(
      <AppShell nav={<TabBar label="Navegação principal" items={items} />}>
        <h1>Baralhos</h1>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { name: "Baralhos" })).toBeInTheDocument();
    expect(within(main).queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });
});
