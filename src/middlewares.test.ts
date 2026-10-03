import { expect, test } from "bun:test"
import localeMiddleware from "./middlewares.js"

test("wildcard Accept-Language does not break coach dashboard date formatting", () => {
  const res = { locals: {} as Record<string, any> }
  localeMiddleware({ acceptsLanguages: () => ["*"] }, res, () => {})
  expect(res.locals.locale).toBe("en-US")
  expect(res.locals.formatDate("2027-01-30")).toContain("2027")
})
