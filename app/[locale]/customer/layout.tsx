import type { ReactNode } from "react";

export default function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="customer-light min-h-screen">{children}</div>;
}
