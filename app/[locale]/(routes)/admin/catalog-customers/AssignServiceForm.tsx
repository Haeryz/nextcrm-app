"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignCatalogServiceToCustomer } from "@/actions/catalog/admin";

type ServiceOption = {
  id: string;
  title: string;
  customerName: string;
  vehicle: string;
  phone: string;
  status: string;
};

export default function AssignServiceForm({
  customerId,
  services,
}: {
  customerId: string;
  services: ServiceOption[];
}) {
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onAssign() {
    if (!serviceOrderId) return;
    startTransition(async () => {
      const result = await assignCatalogServiceToCustomer({
        customerId,
        serviceOrderId,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setServiceOrderId("");
      toast.success("Service assigned.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={serviceOrderId} onValueChange={setServiceOrderId}>
        <SelectTrigger>
          <SelectValue placeholder="Choose service order" />
        </SelectTrigger>
        <SelectContent>
          {services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.customerName} · {service.vehicle} · {service.status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" onClick={onAssign} disabled={!serviceOrderId || isPending}>
        <LinkIcon className="size-4" />
        Assign
      </Button>
    </div>
  );
}
