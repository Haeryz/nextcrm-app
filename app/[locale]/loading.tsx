import { Skeleton } from "@/components/ui/skeleton";

// This boundary covers the whole public storefront (app/[locale]/customer/**),
// none of which has a loading.tsx of its own. Returning null is worse than having
// no file at all: Next still swaps this in, so every catalog and profile
// navigation blanked the page and read as a crash.
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Memuat halaman…</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </div>
    </div>
  );
}
