"use client";

import dynamic from "next/dynamic";

import type { CommandPaletteProps } from "./command-palette";

/**
 * Client-side boundary that keeps the command palette out of the app shell's
 * initial JavaScript.
 *
 * The palette is mounted on every authenticated staff page but renders nothing
 * until Ctrl/Cmd+K is pressed, yet it statically pulls in the whole Dialog stack
 * and the Mektek menu tree. Loading it on demand removes that from the critical
 * path of every navigation.
 *
 * `dynamic(..., { ssr: false })` is only allowed inside a Client Component, and
 * `(routes)/layout.tsx` is an async Server Component — hence this wrapper. There
 * is no `loading` fallback on purpose: the palette occupies no layout space, so
 * a placeholder would be visible dead weight. The Ctrl/Cmd+K listener simply
 * starts working once the chunk lands, a moment after hydration.
 */
const CommandPaletteImpl = dynamic(
  () => import("./command-palette").then((mod) => mod.CommandPalette),
  { ssr: false },
);

export function CommandPaletteLazy(props: CommandPaletteProps) {
  return <CommandPaletteImpl {...props} />;
}
