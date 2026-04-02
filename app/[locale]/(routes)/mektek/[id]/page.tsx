import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";

// Mock data — same source as the list page; swap for DB call when ready
const mockCustomers = [
  {
    id: "67676767",
    name: "Charlie Kirk",
    vehicle: "Toyota Avanza 2021",
    phone: "+62 812-3456-7890",
    address: "Jl. Merdeka No. 12, Jakarta",
    estimatedDone: "30 Feb 2020",
    progress: 87,
    status: "In Progress",
    orders: [
      {
        date: "12-4-2026",
        time: "12:00 PM",
        description: "Penggantian air AC",
        completed: true,
      },
      {
        date: "12-4-2026",
        time: "08:00 PM",
        description: "Suku cadang sampai di bengkel",
        completed: true,
      },
      {
        date: "12-4-2026",
        time: "06:00 PM",
        description: "Suku cadang sedang dalam pengiriman dari gudang",
        completed: false,
      },
    ],
    notes:
      "Pelanggan meminta pengerjaan selesai sebelum tanggal 15 April 2026. Sudah dikonfirmasi oleh kepala mekanik.",
  },
  {
    id: "12345678",
    name: "Budi Santoso",
    vehicle: "Honda Jazz 2019",
    phone: "+62 821-9876-5432",
    address: "Jl. Sudirman No. 88, Bandung",
    estimatedDone: "30 Feb 2020",
    progress: 45,
    status: "In Progress",
    orders: [
      {
        date: "11-4-2026",
        time: "09:00 AM",
        description: "Pengecekan awal kendaraan",
        completed: true,
      },
      {
        date: "11-4-2026",
        time: "02:00 PM",
        description: "Pemesanan suku cadang",
        completed: false,
      },
    ],
    notes: "",
  },
  {
    id: "98765432",
    name: "Siti Rahma",
    vehicle: "Suzuki Ertiga 2022",
    phone: "+62 857-1122-3344",
    address: "Jl. Gajah Mada No. 5, Surabaya",
    estimatedDone: "30 Feb 2020",
    progress: 100,
    status: "Completed",
    orders: [
      {
        date: "10-4-2026",
        time: "08:00 AM",
        description: "Servis berkala 10.000 km",
        completed: true,
      },
      {
        date: "10-4-2026",
        time: "11:00 AM",
        description: "Kendaraan selesai dan siap diambil",
        completed: true,
      },
    ],
    notes: "Servis rutin selesai tepat waktu.",
  },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MektekDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = mockCustomers.find((c) => c.id === id);

  if (!customer) notFound();

  return (
    <Container
      title={`MEKTEK — ${customer.name}`}
      description={`Service order detail · ID ${customer.id}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: IDENTITAS + PROGRESS ── */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* IDENTITAS */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Identitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Customer ID</p>
                <p className="font-mono font-semibold text-foreground">
                  {customer.id}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Nama</p>
                <p className="font-semibold text-foreground">{customer.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Kendaraan</p>
                <p className="font-semibold text-foreground">
                  {customer.vehicle}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Telepon</p>
                <p className="font-semibold text-foreground">{customer.phone}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Alamat</p>
                <p className="font-semibold text-foreground">
                  {customer.address}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PROGRESS */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-foreground">
                  {customer.progress}%
                </span>
                <Badge
                  variant={
                    customer.status === "Completed" ? "default" : "secondary"
                  }
                >
                  {customer.status}
                </Badge>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${customer.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {customer.orders.filter((o) => o.completed).length} of{" "}
                {customer.orders.length} steps completed
              </p>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Estimated Done</p>
                <p className="font-semibold text-foreground">
                  {customer.estimatedDone}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: PESANAN timeline ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Pesanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Dashed vertical connector line */}
                {customer.orders.length > 1 && (
                  <div
                    className="absolute left-[7px] top-5 border-l-2 border-dashed border-border"
                    style={{
                      height: `calc(100% - 2.5rem)`,
                    }}
                  />
                )}

                <div className="space-y-4">
                  {customer.orders.map((order, index) => (
                    <div key={index} className="relative flex gap-5">
                      {/* Timeline dot */}
                      <div
                        className={`mt-1 shrink-0 w-4 h-4 rounded-full border-2 z-10 ${
                          order.completed
                            ? "bg-foreground border-foreground"
                            : "bg-background border-muted-foreground"
                        }`}
                      />

                      {/* Order card */}
                      <Card
                        className={`flex-1 border shadow-sm ${
                          order.completed
                            ? "bg-card"
                            : "bg-muted/30"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{order.date}</span>
                              <span>·</span>
                              <span>{order.time}</span>
                            </div>
                            {order.completed ? (
                              <Badge variant="default" className="text-xs">
                                Done
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-foreground text-sm">
                            {order.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes panel */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
                Catatan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.notes ? (
                <p className="text-sm text-foreground">{customer.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Tidak ada catatan.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
