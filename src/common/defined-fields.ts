// The fields a partial update sets. Nulls are kept, so the database can reject
// them for required columns, which the DriverExceptionFilter turns into a 400.
export function definedFields<T extends object>(dto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
