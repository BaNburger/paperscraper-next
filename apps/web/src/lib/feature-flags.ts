function isEnabled(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function isRedesignUiEnabled(): boolean {
  if (typeof import.meta === 'undefined') {
    return true;
  }
  return isEnabled(import.meta.env?.VITE_FLAG_REDESIGN_UI);
}

export function isS2W1ActionsEnabled(): boolean {
  if (typeof import.meta === 'undefined') {
    return true;
  }
  return isEnabled(import.meta.env?.VITE_FLAG_S2W1_ACTIONS);
}

export function isObjectNotesEnabled(): boolean {
  if (typeof import.meta === 'undefined') {
    return true;
  }
  return isEnabled(import.meta.env?.VITE_FLAG_OBJECT_NOTES);
}
