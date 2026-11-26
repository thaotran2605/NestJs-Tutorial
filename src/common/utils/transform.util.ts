export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimStringArray({ value }: { value: unknown }): unknown {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;
}
