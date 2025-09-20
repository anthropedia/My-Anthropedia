function computeRemainingDays(expiry) {
  if (!expiry) return NaN
  const exp = new Date(expiry).getTime()
  const now = Date.now()
  const MS_PER_DAY = 86_400_000
  return Math.floor((exp - now) / MS_PER_DAY)
}

function getLocale(req) {
  // Express's built-in negotiation fallback as needed
  return (req.acceptsLanguages && req.acceptsLanguages()[0]) || 'en-US'
}

// Decide where you get the user's TZ. Common: req.user.timeZone or profile field.
// If unknown, prefer 'UTC' over server TZ for predictability.
function getTimeZone(req) {
  return (req.user && req.user.timeZone) || 'UTC'
}

function formatDate(value, { locale, timeZone, dateStyle = 'long', timeStyle } = {}) {
  if (value == null) return ''
  const d = new Date(value)
  if (isNaN(d)) return ''
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle, timeStyle }).format(d)
}

export default function localeMiddleware(req, res, next) {
  const locale = getLocale(req)
  const timeZone = getTimeZone(req)

  // expose to templates
  res.locals.locale = locale
  res.locals.timeZone = timeZone
  res.locals.formatDate = (value, opts = {}) => formatDate(value, { locale, timeZone, ...opts })
  res.locals.computeRemainingDays = computeRemainingDays
  next()
}