import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MektekPaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  itemLabel?: string;
  pageParam?: string;
  query?: Record<string, string>;
};

const getPageNumbers = (page: number, totalPages: number) =>
  Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNumber) =>
      pageNumber === 1 ||
      pageNumber === totalPages ||
      Math.abs(pageNumber - page) <= 1
  );

export default function MektekPagination({
  basePath,
  page,
  totalPages,
  totalCount,
  pageSize,
  itemLabel = "orders",
  pageParam = "page",
  query = {},
}: MektekPaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(page, totalPages);
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);

  const hrefFor = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    if (nextPage > 1) params.set(pageParam, String(nextPage));
    const suffix = params.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="mektek-pagination"
    >
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalCount} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          </Button>
        )}

        {pageNumbers.map((pageNumber, index) => {
          const previous = pageNumbers[index - 1];
          const showGap = previous && pageNumber - previous > 1;
          return (
            <div key={pageNumber} className="flex items-center gap-2">
              {showGap && (
                <span className="px-1 text-sm text-muted-foreground">...</span>
              )}
              <Button
                asChild
                variant={pageNumber === page ? "default" : "outline"}
                size="sm"
                className={cn(pageNumber === page && "pointer-events-none")}
              >
                <Link href={hrefFor(pageNumber)} aria-current={pageNumber === page ? "page" : undefined}>
                  {pageNumber}
                </Link>
              </Button>
            </div>
          );
        })}

        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page + 1)} aria-label="Next page">
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
