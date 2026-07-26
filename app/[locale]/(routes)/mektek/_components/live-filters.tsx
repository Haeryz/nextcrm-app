"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type LiveFilterBase = {
  basePath: string;
  currentQuery: string;
  resetPageOnchange?: boolean;
};

function buildHref(
  basePath: string,
  currentQuery: string,
  paramName: string,
  nextValue: string,
  resetPage: boolean,
): string {
  const params = new URLSearchParams(currentQuery);
  if (nextValue) {
    params.set(paramName, nextValue);
  } else {
    params.delete(paramName);
  }
  if (resetPage) {
    params.delete("page");
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function LiveSearchInput({
  basePath,
  currentQuery,
  paramName,
  defaultValue,
  placeholder,
  ariaLabel,
  resetPageOnchange = true,
  className,
}: LiveFilterBase & {
  paramName: string;
  defaultValue: string;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const commit = (next: string) => {
    router.replace(
      buildHref(basePath, currentQuery, paramName, next, resetPageOnchange),
    );
  };

  const onChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(next), 300);
  };

  const clear = () => {
    setValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit("");
  };

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Hapus pencarian"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function LiveFilterSelect({
  basePath,
  currentQuery,
  paramName,
  defaultValue,
  ariaLabel,
  options,
  resetPageOnchange = true,
  className,
}: LiveFilterBase & {
  paramName: string;
  defaultValue: string;
  ariaLabel: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const router = useRouter();

  const onChange = (next: string) => {
    const value = next === "ALL" ? "" : next;
    router.replace(
      buildHref(basePath, currentQuery, paramName, value, resetPageOnchange),
    );
  };

  return (
    <Select
      value={defaultValue || "ALL"}
      onValueChange={onChange}
    >
      <SelectTrigger aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
