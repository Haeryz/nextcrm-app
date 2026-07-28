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
  const sidebarPrimitiveSource = readFileSync(
    resolve(process.cwd(), "components/ui/sidebar.tsx"),
    "utf8",
  );

  it("provides an accessible mobile header that opens the shared sidebar", () => {
    expect(layoutSource).toContain("SidebarTrigger");
    expect(sidebarPrimitiveSource).toContain('"Buka menu navigasi"');
    expect(sidebarPrimitiveSource).toContain('"Tutup menu navigasi"');
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

  it("expands a collapsed desktop sidebar before opening a menu group", () => {
    expect(navigationSource).toContain('state === "collapsed"');
    expect(navigationSource).toContain("setOpen(true)");
  });

  it("uses localized navigation copy and touch-friendly menu controls", () => {
    expect(navigationSource).toContain("Menu utama");
    expect(navigationSource).toContain("min-h-10");
  });
});
