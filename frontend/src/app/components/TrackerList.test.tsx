import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrackerList from "./TrackerList";

describe("TrackerList", () => {
  it("lista cada rastreador com a sua categoria e explica a origem no título", () => {
    render(
      <TrackerList
        trackers={[
          { name: "fbclid", category: "social", kind: "param", inFinal: true },
          { name: "sendgrid.net", category: "email", kind: "domain", inFinal: false },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: /rastreadores no link/i });
    expect(group).toHaveTextContent("2 rastreadores no link");
    expect(screen.getByText("fbclid").closest("li")).toHaveAttribute("title", "Parâmetro no destino final");
    expect(screen.getByText("sendgrid.net").closest("li")).toHaveAttribute(
      "title",
      expect.stringMatching(/domínio de rastreamento/),
    );
    expect(group).toHaveTextContent("e-mail marketing");
  });

  it("usa o singular com um só rastreador", () => {
    render(<TrackerList trackers={[{ name: "utm_source", category: "analytics", kind: "param", inFinal: false }]} />);
    expect(screen.getByRole("group")).toHaveTextContent("1 rastreador no link");
  });

  it("não renderiza nada sem rastreadores", () => {
    const { container } = render(<TrackerList trackers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
