import { readFileSync } from "fs";
import { resolve } from "path";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Finance contract CRUD", () => {
  const actionSource = read("actions/mektek/finance.ts");
  const managerSource = read(
    "app/[locale]/(routes)/mektek/finance/_components/ContractCrudManager.tsx",
  );
  const workspaceSource = read(
    "app/[locale]/(routes)/mektek/finance/_components/FinanceWorkspace.tsx",
  );

  it("exposes create, update and delete actions", () => {
    expect(actionSource).toContain(
      "export async function createFinanceContractEntry",
    );
    expect(actionSource).toContain(
      "export async function updateFinanceContractEntry",
    );
    expect(actionSource).toContain(
      "export async function deleteFinanceContractEntry",
    );
  });

  it("validates the contract period and type", () => {
    expect(actionSource).toContain("Nomor kontrak wajib diisi");
    expect(actionSource).toContain(
      "Tanggal berakhir tidak boleh mendahului tanggal mulai",
    );
    expect(actionSource).toContain("Jenis kontrak tidak valid");
    expect(actionSource).toContain(
      "Kontrak Consignment wajib memiliki item dan batas suplai",
    );
  });

  it("refuses to delete a contract that is already in use", () => {
    expect(actionSource).toContain("CONTRACT_IN_USE");
    expect(actionSource).toContain(
      "_count: { select: { invoices: true, purchaseOrders: true } }",
    );
  });

  it("chains a successor contract when one is renewed", () => {
    expect(actionSource).toContain("export async function renewFinanceContract");
    // The successor carries the previous version forward and closes the old one.
    expect(actionSource).toContain("version: existing.version + 1");
    expect(actionSource).toContain("supersedesId: existing.id");
    expect(actionSource).toContain('data: { status: "TERMINATED" }');
    expect(actionSource).toContain("CONTRACT_ALREADY_RENEWED");
    expect(actionSource).toContain("CONTRACT_NOT_STARTED");
  });

  it("copies the agreed items into the renewal", () => {
    expect(actionSource).toContain("create: existing.lines.map((line) => ({");
    expect(actionSource).toContain("contractedQuantity: line.contractedQuantity");
  });

  it("renders the contract manager instead of a read-only list", () => {
    expect(workspaceSource).toContain("<ContractCrudManager");
    expect(workspaceSource).toContain("hasSuccessor: renewedIds.has(row.id)");
    expect(managerSource).toContain("Tambah kontrak");
    expect(managerSource).toContain("Buat kontrak lanjutan");
    expect(managerSource).toContain("Ubah");
    expect(managerSource).toContain("Hapus");
  });

  it("blocks renewal for drafts and for already-renewed contracts", () => {
    expect(managerSource).toContain(
      'pending || row.status === "DRAFT" || row.hasSuccessor',
    );
  });

  it("keeps the interface copy in Bahasa Indonesia", () => {
    expect(managerSource).toContain("Nomor kontrak");
    expect(managerSource).toContain("Tanggal mulai");
    expect(managerSource).toContain("Tanggal berakhir");
    expect(managerSource).toContain("Nilai kontrak");
  });
});
