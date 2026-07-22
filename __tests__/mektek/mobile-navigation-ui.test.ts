import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("staff mobile navigation", () => {
  const layoutSource = readFileSync(
    resolve(process.cwd(), "app/[locale]/(routes)/layout.tsx"),
    "utf8",
  );
  const sidebarSource = readFileSync(
    resolve(process.cwd(), "app/[locale]/(routes)/components/app-sidebar.tsx"),
    "utf8",
  );
  const navigationSource = readFileSync(
    resolve(process.cwd(), "app/[locale]/(routes)/components/nav-main.tsx"),
    "utf8",
  );

  it("provides an accessible mobile header that opens the shared sidebar", () => {
    expect(layoutSource).toContain("SidebarTrigger");
    expect(layoutSource).toContain('aria-label="Buka menu navigasi"');
    expect(layoutSource).toContain("md:hidden");
  });

  it("keeps the sidebar identity expanded inside the mobile drawer", () => {
    expect(sidebarSource).toContain("isMobile || state === \"expanded\"");
    expect(sidebarSource).toContain('aria-label="Tutup menu navigasi"');
  });

  it("closes the mobile drawer after navigating", () => {
    expect(navigationSource).toContain("setOpenMobile(false)");
    expect(navigationSource).toContain("onClick={closeMobileNavigation}");
  });
});
