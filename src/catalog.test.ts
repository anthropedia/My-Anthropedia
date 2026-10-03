import { describe, expect, test } from "bun:test"
import { createCatalog } from "./catalog"

describe("media catalog", () => {
  test("recovers after an initial fetch failure", async () => {
    let attempts = 0
    const catalog = createCatalog(async () => {
      attempts++
      return attempts === 1 ? null : [{ permission: "a1" }]
    }, 0)

    await catalog.refresh()
    expect(catalog.available).toBe(false)
    expect(catalog.records).toEqual([])

    await catalog.refresh()
    expect(catalog.available).toBe(true)
    expect(catalog.records).toEqual([{ permission: "a1" }])
  })

  test("retains the last good catalog when Grist fails later", async () => {
    let fail = false
    const catalog = createCatalog(async () => fail ? null : [{ permission: "a2" }], 0)
    await catalog.refresh()
    fail = true
    await catalog.refresh()
    expect(catalog.available).toBe(true)
    expect(catalog.records).toEqual([{ permission: "a2" }])
  })

  test("treats an empty successful catalog as available", async () => {
    const catalog = createCatalog(async () => [], 0)
    await catalog.refresh()
    expect(catalog.available).toBe(true)
    expect(catalog.records).toEqual([])
  })
})
