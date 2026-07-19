"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  formatRupiahInput,
  normalizeRupiahDigits,
  type RupiahInputValue,
} from "@/lib/rupiah";

type RupiahInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "defaultValue" | "inputMode" | "onChange" | "type" | "value"
> & {
  value: RupiahInputValue;
  onValueChange: (rawDigits: string) => void;
};

const RupiahInput = React.forwardRef<HTMLInputElement, RupiahInputProps>(
  ({ onValueChange, value, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={formatRupiahInput(value)}
      onChange={(event) =>
        onValueChange(normalizeRupiahDigits(event.target.value))
      }
    />
  ),
);

RupiahInput.displayName = "RupiahInput";

export { RupiahInput };
