import fs from "fs";
import path from "path";

describe("staff management action feedback", () => {
  it("shows pending feedback for create, save, and delete actions", () => {
    const pageSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/staff/page.tsx",
      ),
      "utf8",
    );
    const listSectionSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/staff/_components/StaffListSection.tsx",
      ),
      "utf8",
    );
    const buttonSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/staff/_components/StaffSubmitButton.tsx",
      ),
      "utf8",
    );
    const formSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/[locale]/(routes)/mektek/staff/_components/StaffActionForm.tsx",
      ),
      "utf8",
    );

    expect(pageSource).toContain("StaffSubmitButton");
    expect(pageSource).toContain("StaffActionForm");
    expect(pageSource).toContain('pendingLabel="Membuat..."');
    expect(listSectionSource).toContain('pendingLabel="Menyimpan..."');
    expect(listSectionSource).toContain('pendingLabel="Menghapus..."');
    expect(buttonSource).toContain("useFormStatus");
    expect(buttonSource).toContain("disabled={pending}");
    expect(formSource).toContain("toast.success");
    expect(formSource).toContain("toast.error");
  });
});
