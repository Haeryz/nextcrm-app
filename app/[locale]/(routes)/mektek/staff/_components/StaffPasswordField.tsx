"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StaffPasswordField() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="new-subadmin-password">Password</Label>
      <div className="relative">
        <Input
          id="new-subadmin-password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          maxLength={50}
          aria-describedby="new-subadmin-password-hint"
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={
            showPassword ? "Sembunyikan password" : "Tampilkan password"
          }
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <p
        id="new-subadmin-password-hint"
        className="text-xs text-muted-foreground"
      >
        Minimal 8 karakter.
      </p>
    </div>
  );
}
