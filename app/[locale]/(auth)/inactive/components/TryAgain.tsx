"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const TryAgain = () => {
  const router = useRouter();
  return <Button onClick={() => router.refresh()}>Coba lagi</Button>;
};

export default TryAgain;
