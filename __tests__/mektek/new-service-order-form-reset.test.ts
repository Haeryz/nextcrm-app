import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("NewServiceOrderForm success reset", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "app/[locale]/(routes)/mektek/_components/NewServiceOrderForm.tsx",
    ),
    "utf8",
  );

  it("remounts and refocuses a fresh form after an order is created", () => {
    expect(source).toMatch(/<form\s+key=\{formResetKey\}/);
    expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*\}, \[formResetKey\]\);/);
    expect(source).toMatch(/scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
    expect(source).toMatch(
      /querySelector<HTMLInputElement>\("input"\)[\s\S]*?\?\.focus\(\)/,
    );
  });
});
