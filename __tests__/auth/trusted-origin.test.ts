jest.mock("server-only", () => ({}), { virtual: true });

import { isTrustedMutationOrigin } from "@/lib/trusted-origin";

describe("trusted mutation origins", () => {
  it("accepts an exact same-origin request", () => {
    const requestHeaders = new Headers({
      origin: "https://mektek.example",
      "x-forwarded-host": "mektek.example",
      "sec-fetch-site": "same-origin",
    });

    expect(isTrustedMutationOrigin(requestHeaders)).toBe(true);
  });

  it("rejects lookalike and cross-site origins", () => {
    expect(
      isTrustedMutationOrigin(
        new Headers({
          origin: "https://mektek.example.attacker.test",
          "x-forwarded-host": "mektek.example",
        }),
      ),
    ).toBe(false);
    expect(
      isTrustedMutationOrigin(
        new Headers({
          origin: "https://mektek.example",
          "x-forwarded-host": "mektek.example",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toBe(false);
  });
});
