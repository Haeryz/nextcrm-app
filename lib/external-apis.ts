const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export function isPrototypeMode(): boolean {
  return isEnabled(process.env.NEXTCRM_PROTOTYPE_MODE);
}

export function areExternalApisDisabled(): boolean {
  return isPrototypeMode() || isEnabled(process.env.DISABLE_EXTERNAL_APIS);
}