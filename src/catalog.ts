export function createCatalog<T>(fetchRecords: () => Promise<T[] | null>, refreshMs = 60_000) {
  let records: T[] = []
  let available = false
  let lastRefresh = 0
  let pending: Promise<void> | null = null

  return {
    get records() { return records },
    get available() { return available },
    async refresh() {
      if (lastRefresh && Date.now() - lastRefresh < refreshMs) return
      if (pending) return pending

      pending = (async () => {
        const result = await fetchRecords()
        if (result !== null) {
          records = result
          available = true
        }
        lastRefresh = Date.now()
      })().finally(() => { pending = null })
      return pending
    },
  }
}
