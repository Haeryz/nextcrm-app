import Container from "@/app/[locale]/(routes)/components/ui/Container";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock data — replace with real data source when ready
const mockCustomers = [
  {
    id: "67676767",
    name: "Charlie Kirk",
    vehicle: "Toyota Avanza 2021",
    progress: 87,
    status: "In Progress",
    lastUpdated: "12-4-2026",
    estimatedDone: "30 Feb 2020",
    orders: [
      {
        date: "12-4-2026",
        time: "12:00 PM",
        description: "Penggantian air AC",
      },
      {
        date: "12-4-2026",
        time: "08:00 PM",
        description: "Suku cadang sampai di bengkel",
      },
      {
        date: "12-4-2026",
        time: "06:00 PM",
        description: "Suku cadang sedang dalam pengiriman dari gudang",
      },
    ],
  },
  {
    id: "12345678",
    name: "Budi Santoso",
    vehicle: "Honda Jazz 2019",
    progress: 45,
    status: "In Progress",
    lastUpdated: "11-4-2026",
    estimatedDone: "30 Feb 2020",
    orders: [
      {
        date: "11-4-2026",
        time: "09:00 AM",
        description: "Pengecekan awal kendaraan",
      },
      {
        date: "11-4-2026",
        time: "02:00 PM",
        description: "Pemesanan suku cadang",
      },
    ],
  },
  {
    id: "98765432",
    name: "Siti Rahma",
    vehicle: "Suzuki Ertiga 2022",
    progress: 100,
    status: "Completed",
    lastUpdated: "10-4-2026",
    estimatedDone: "30 Feb 2020",
    orders: [
      {
        date: "10-4-2026",
        time: "08:00 AM",
        description: "Servis berkala 10.000 km",
      },
      {
        date: "10-4-2026",
        time: "11:00 AM",
        description: "Kendaraan selesai dan siap diambil",
      },
    ],
  },
];

export default function MektekPage() {
  return (
    <Container
      title="MEKTEK"
      description="Service order tracking — manage and monitor all repair jobs"
    >
      <div className="space-y-4">
        {mockCustomers.map((customer) => (
          <Link key={customer.id} href={`/mektek/${customer.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: customer info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-muted-foreground font-mono">
                        ID: {customer.id}
                      </span>
                      <Badge
                        variant={
                          customer.status === "Completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {customer.status}
                      </Badge>
                    </div>
                    <p className="font-bold text-lg text-foreground">
                      {customer.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {customer.vehicle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last updated: {customer.lastUpdated}
                    </p>
                  </div>

                  {/* Right: progress */}
                  <div className="flex flex-col items-end gap-2 shrink-0 w-40">
                    <span className="text-sm font-bold text-foreground">
                      {customer.progress}%
                    </span>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full transition-all"
                        style={{ width: `${customer.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Progress
                    </span>
                  </div>
                </div>

                {/* Order count + estimated done */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {customer.orders.length} order step
                    {customer.orders.length !== 1 ? "s" : ""} tracked
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Est. done:{" "}
                    <span className="font-medium text-foreground">
                      {customer.estimatedDone}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
