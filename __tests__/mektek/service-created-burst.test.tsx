import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ServiceCreatedBurst } from "@/components/mektek/ServiceCreatedBurst";

describe("ServiceCreatedBurst", () => {
  it("renders a decorative, non-interactive success burst", () => {
    const markup = renderToStaticMarkup(createElement(ServiceCreatedBurst));

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain("mektek-success-ring");
    expect(markup.match(/data-confetti-particle="true"/g)).toHaveLength(18);
  });
});
