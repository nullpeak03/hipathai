// Chainable Supabase stand-in for route-handler tests.
//
// Route handlers use the whole builder surface (`select`, `eq`, `order`,
// `single`, `upsert`, `then`). Rather than hand-rolling a fake per test, this
// returns a thenable query for each table and records the calls so tests can
// assert what was read and written.

export type TableResult = {
  data?: unknown
  error?: { code?: string; message?: string } | null
  count?: number | null
}

export type RecordedCall = {
  table: string
  method: string
  args: unknown[]
}

export class Query {
  private result: TableResult
  constructor(
    private table: string,
    result: TableResult,
    private calls: RecordedCall[]
  ) {
    this.result = result
  }

  private record(method: string, args: unknown[]) {
    this.calls.push({ table: this.table, method, args })
    return this
  }

  select(...args: unknown[]) {
    return this.record("select", args)
  }
  insert(...args: unknown[]) {
    return this.record("insert", args)
  }
  upsert(...args: unknown[]) {
    this.record("upsert", args)
    return Promise.resolve(this.result)
  }
  update(...args: unknown[]) {
    return this.record("update", args)
  }
  delete(...args: unknown[]) {
    return this.record("delete", args)
  }
  eq(...args: unknown[]) {
    return this.record("eq", args)
  }
  neq(...args: unknown[]) {
    return this.record("neq", args)
  }
  in(...args: unknown[]) {
    return this.record("in", args)
  }
  order(...args: unknown[]) {
    return this.record("order", args)
  }
  limit(...args: unknown[]) {
    return this.record("limit", args)
  }
  single() {
    this.record("single", [])
    return Promise.resolve(this.result)
  }
  maybeSingle() {
    this.record("maybeSingle", [])
    return Promise.resolve(this.result)
  }
  // `await supabase.from(...).select(...)` resolves through this.
  then<TResult1 = TableResult, TResult2 = never>(
    onfulfilled?: ((value: TableResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

export function createSupabaseMock(results: Record<string, TableResult> = {}, fallback: TableResult = { data: null, error: null }) {
  const calls: RecordedCall[] = []
  const client = {
    from: (table: string) => new Query(table, results[table] ?? fallback, calls),
  }
  return { client, calls }
}
