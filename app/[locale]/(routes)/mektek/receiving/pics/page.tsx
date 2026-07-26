import Link from "next/link";

import {
  createMektekLogisticsPic,
  deleteMektekLogisticsPic,
  updateMektekLogisticsPic,
} from "@/actions/mektek/logistics-pics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";
import StaffSubmitButton from "@/app/[locale]/(routes)/mektek/staff/_components/StaffSubmitButton";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default async function ReceivingPicManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireAdmin();
  const { locale } = await params;
  const pics = await prismadb.logisticsPic.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { receipts: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="space-y-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/mektek/receiving`}>Kembali ke Receiving</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">PIC Receiving</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola person in charge yang dapat ditugaskan ke setiap shipment.
          </p>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-medium">Tambah PIC</h2>
        <form action={createMektekLogisticsPic} className="flex flex-col gap-3 sm:flex-row">
          <Input
            name="name"
            placeholder="Nama PIC"
            required
            maxLength={120}
            aria-label="Nama PIC baru"
          />
          <Button type="submit">Tambah</Button>
        </form>
      </section>

      <section className="space-y-4">
        {pics.map((pic) => (
          <article key={pic.id} className="rounded-lg border bg-card p-5">
            <form
              action={updateMektekLogisticsPic}
              className="grid gap-3 sm:grid-cols-[1fr_160px_auto]"
            >
              <input type="hidden" name="id" value={pic.id} />
              <Input
                name="name"
                defaultValue={pic.name}
                required
                maxLength={120}
                aria-label={`Nama PIC ${pic.name}`}
              />
              <select
                name="isActive"
                className={selectClass}
                defaultValue={String(pic.isActive)}
                aria-label={`Status PIC ${pic.name}`}
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
              <StaffSubmitButton
                idleLabel="Simpan Perubahan"
                pendingLabel="Menyimpan..."
              />
            </form>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {pic._count.receipts} shipment
              </p>
              <form action={deleteMektekLogisticsPic}>
                <input type="hidden" name="id" value={pic.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={pic._count.receipts > 0}
                >
                  Hapus
                </Button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
