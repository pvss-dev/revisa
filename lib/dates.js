// PostgreSQL DATE values are calendar dates, independent of the server timezone.
export function dateValue(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function dateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}
