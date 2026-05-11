import express, { Request, Response } from "express"
import { json } from "body-parser"
import path from "path"
import { Eta } from "eta"
import api from "./src/api.ts"
import session from "express-session"
import { createServer } from "http"
import { Server } from "socket.io"
import shareRoutes from "./src/routes/share"
import middlewares from "./src/middlewares"

const GRIST_DOC_ID = "ea9DA9WWELC5UEfkj94QC7"
const GRIST_BASE_URL = "https://anthropedia.getgrist.com/api"

const PORT = process.env.PORT || 3000
const app = express()
const server = createServer(app)
const io = new Server(server)
const eta = new Eta({ views: path.join(__dirname, "views") })

// Session setup
const sessionMiddleware = session({
  secret: "s3Ssi0nS3kre7",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax'
  }
})

app.use(json())
app.use(express.urlencoded({ extended: true }))
app.use(sessionMiddleware)
app.use(middlewares)
app.engine("eta", buildEtaEngine())
app.set("view engine", "eta")

// Both videos and audios are properly defined
const rawVideos = (await api.getData<MediaType>("Videos")) || []
const rawAudios = (await api.getData<MediaType>("Audios")) || []

function extractAttachmentId(value: unknown): string | number | null {
  if (typeof value === "number" || typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as any).id
    if (typeof id === "number" || typeof id === "string") return id
  }
  return null
}

function getCoverFromMedia(media: MediaType): string | null {
  const coverValue = media["$cover"] ?? media.cover
  if (!coverValue) return null

  if (Array.isArray(coverValue)) {
    if (!coverValue.length) return null

    // Grist attachments can look like ["L", 35] or [{id: 35}, ...]
    const directUrl = coverValue.find((v) => typeof v === "string" && v.startsWith("http")) as string | undefined
    if (directUrl) return directUrl

    for (const item of coverValue) {
      const id = extractAttachmentId(item)
      if (typeof id === "number") return `/grist/attachments/${id}`
      if (typeof id === "string" && /^\d+$/.test(id)) return `/grist/attachments/${id}`
    }

    return null
  }

  if (typeof coverValue === "string") {
    if (coverValue.startsWith("http")) return coverValue
    return `/grist/attachments/${coverValue}`
  }

  if (typeof coverValue === "number") {
    return `/grist/attachments/${coverValue}`
  }

  const id = extractAttachmentId(coverValue)
  return id ? `/grist/attachments/${id}` : null
}

const videos = rawVideos.map((media) => ({
  ...media,
  mediaType: "videos",
  coverUrl: getCoverFromMedia(media),
}))
const audios = rawAudios.map((media) => ({
  ...media,
  mediaType: "Audios",
  coverUrl: getCoverFromMedia(media),
}))

// console.debug(videos)

function getMediaId(s: string): string {
  return s[0].toLowerCase() + s.match(/\d+/)[0]
}

// MediaType properly covers both video and audio items and includes permission
type MediaType = {
  id: number
  reference: string
  permission: string
  General_Description_of_KY: string
  title: string
  description: string
  iframe_v2: string
  cover?: Array<string> | string | number[]
  "$cover"?: Array<string | number> | string | number
  Script_v2: string
  mediaType?: "videos" | "Audios"
  coverUrl?: string | null
}

type UserType = {
  id: number
  name: string
  email: string
  role: string
  permissions: [string]
}

type CoachUserType = UserType & {
  credit: number
  clients: [object]
  is_admin: boolean
  language: string
  subscription_expiration_date: Date
}

type ClientUserType = UserType & {
  language: string
  provider: string
  temporary_password: string
  knowyourself_series: string
}

class User implements CoachUserType | ClientUserType {
  role: string

  get isCoach(): boolean {
    return this.role === "coach"
  }

  get isClient(): boolean {
    return this.role === "client"
  }

  constructor(data: CoachUserType | ClientUserType) {
    Object.assign(this, data)

    // Preserve explicit API role when present; otherwise infer from permissions
    const explicitRole = typeof data.role === "string" ? data.role.toLowerCase() : ""
    if (explicitRole === "coach" || explicitRole === "client") {
      this.role = explicitRole
    } else {
      this.role = (data as any).permissions?.includes("coach") ? "coach" : "client"
    }

    // Convert subscription date for coaches
    if (this.isCoach && this.subscription_expiration_date) {
      this.subscription_expiration_date = new Date(this.subscription_expiration_date)
    }
  }

  // canAccess method properly handles permission checking for both string and number
  canAccess(resource: string | number = null): boolean {
    // Coach access logic
    if (this.isCoach) {
      return !!(
        this.subscription_expiration_date &&
        this.subscription_expiration_date > new Date()
      )
    }

    // Client access logic
    if (this.isClient) {
      // Allow authenticated clients into the app; per-media access is checked below.
      if (!resource) return true

      const resourceStr = typeof resource === "number" ? resource.toString() : resource
      const mediaId = getMediaId(resourceStr)

      if (typeof this.knowyourself_series === "string" && this.knowyourself_series.length > 0) {
        return this.knowyourself_series.includes(mediaId)
      }

      if (Array.isArray((this as any).permissions) && (this as any).permissions.length > 0) {
        const perms = (this as any).permissions.map((p) => String(p))
        return perms.includes(resourceStr) || perms.includes(mediaId)
      }

      return false
    }

    return false
  }
}

function buildEtaEngine() {
  return (path, opts, callback) => {
    try {
      const fileContent = eta.readFile(path)
      const renderedTemplate = eta.renderString(fileContent, opts)
      callback(null, renderedTemplate)
    } catch (error) {
      callback(error)
    }
  }
}

app.use(express.static(path.join(__dirname, "assets")))

// Store active sessions
let activeSessions: Record<string, any> = {}
let clients: any[] = []

// Generate a random 4-character code
const generateCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

// Share routes with Socket.IO server
shareRoutes(app, io)

app.get("/", (req: Request, res: Response) => {
  if (req.session?.token) res.redirect("/dashboard")
  else res.redirect("/login")
})

app.get("/login", (req: Request, res: Response) => {
  res.redirect("/login/coach")
})

// Auth
app.get("/login/client", (req: Request, res: Response) => {
  res.render("login_client")
})

app.post("/login/client", async (req: Request, res: Response) => {
  const { email, password, generate_password } = req.body
  let data = { client_email: email }

  // Generate password
  if (generate_password) {
    try {
      const response = await api.sendClientPassword(email)
      data.message = "An authentication code has been sent to you via email."
    } catch (request) {
      data.error = request.response.data
    }
    return res.render("login_client", data)
  }
  // Regular login with email+password
  try {
    const response = await api.login(email, password)
    const token = response.data
    // Token format: aaaaa.bbbbb.ccccc
    if (token.split(".").length === 3) {
      req.session.token = token
      try {
        const userResponse = await api.getUser(token)
        req.session.rawUser = userResponse.data
        return res.redirect("/dashboard")
      } catch (request) {
        console.error("Login error:", request.response.data)
        data.error = "Some error occured: " + request.response.data
      }
    }
  } catch (request) {
    console.error("Login error:", request)
    console.error("Login error response:", request.response)
    console.error("Login error response data:", request.response?.data)
    console.error("Login error message:", request.message)
    data.error = "Please check your email and the code sent to your email"
  }
  return res.render("login_client", data)
})

app.get("/login/coach", (req: Request, res: Response) => {
  res.render("login_coach")
})

app.post("/login/coach", async (req: Request, res: Response) => {
  const { email, password } = req.body
  try {
    const response = await api.coachLogin(email, password)
    const token = response.data
    // Token format: aaaaa.bbbbb.ccccc
    if (token.split(".").length === 3) {
      req.session.token = token
      const userResponse = await api.getUser(token)
      req.session.rawUser = userResponse.data
      return res.redirect("/dashboard")
    }
  } catch (error) {
    console.error("Login error:", error)
    res.render("login_coach", { error: "Please check your email and password" })
  }
})

app.get("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) console.error(err)
    else res.redirect("/login")
  })
})

app.get("/restricted", (req: Request, res: Response) => {
  res.render("restricted")
})

// Protected routes
app.get("/dashboard", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user

  res.render("dashboard", {
    isCoach: user.isCoach,
    allowedVideos: videos.filter((m) => user.canAccess(m.permission)),
    allowedAudios: audios.filter((m) => user.canAccess(m.permission)),
    user
  })
})

app.get("/grist/attachments/:attachmentId", authenticate, async (req: Request, res: Response) => {
  const attachmentId = req.params.attachmentId
  const url = `${GRIST_BASE_URL}/docs/${GRIST_DOC_ID}/attachments/${attachmentId}/download`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GRIST_TOKEN}`,
      Accept: "*/*",
    },
  })

  if (!response.ok) {
    return res.status(response.status).send("Could not load media cover")
  }

  const contentType = response.headers.get("content-type") || "image/jpeg"
  const bytes = await response.arrayBuffer()

  res.setHeader("Content-Type", contentType)
  res.setHeader("Cache-Control", "public, max-age=3600")
  return res.send(Buffer.from(bytes))
})

app.get("/media/:type/:id", authenticate, (req: Request, res: Response) => {
  const type = req.params.type?.toLowerCase()
  const source = type === "audios" ? audios : videos
  const media: MediaType = source.find((m) => m.id == req.params.id)

  if (!media) return res.status(404).redirect("/restricted")
  if (!(req as any).user.canAccess(media.permission)) {
    return res.status(403).redirect("/restricted")
  }

  res.render("media", { media, user: (req as any).user })
})

// Backward compatible route
app.get("/media/:id", authenticate, (req: Request, res: Response) => {
  const media: MediaType = videos.find((m) => m.id == req.params.id) || audios.find((m) => m.id == req.params.id)

  if (!media) return res.status(404).redirect("/restricted")
  if (!(req as any).user.canAccess(media.permission)) {
    return res.status(403).redirect("/restricted")
  }

  res.render("media", { media, user: (req as any).user })
})

// Authentication middleware attaches user with canAccess(permission: string | number) to req
async function authenticate(req: Request, res: Response, next: () => void) {
  if (!req.session.token) {
    res.redirect("/")
    return
  }

  let user
  if (!req.session.rawUser) {
    const userResponse = await api.getUser(req.session.token)
    const userData = (userResponse as any)?.data || userResponse
    if (!userData) return res.redirect("/")
    req.session.rawUser = userData
    user = new User(userData)
  } else {
    user = new User(req.session.rawUser)
  }

  (req as any).user = user
  if (!user.canAccess()) return res.redirect("/restricted")
  next()
}

// Socket.IO middleware to share session
io.use((socket, next) => {
  sessionMiddleware(socket.request as any, {} as any, next as any)
})

const rooms = new Map()

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  socket.on("create", ({ room, content }) => {
    console.log(`Coach ${socket.id} is creating room ${room}`)
    rooms.set(room, { ids: [socket.id], room, content })
    socket.join(room)
  })

  socket.on("join", (roomId) => {
    if (!rooms.has(roomId)) return socket.emit("error", `Room ${roomId} does not exist`)
    const room = rooms.get(roomId)
    room.ids.push(socket.id)
    socket.join(roomId)
    console.debug(`room ${roomId} has`, room)
    socket.emit("message", room.content)
    console.log(`Client ${socket.id} joined room: ${roomId}`)
  })

  socket.on("message", ({ room, content }) => {
    console.log(`Message received in room ${room}:`, content)
    io.to(room).emit("message", content)
  })

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`)
    rooms.forEach((room, key) => {
      if (room.ids.find(id => id === socket.id)) {
        room.ids = room.ids.filter(id => id !== socket.id)
        if (room.ids.length === 0) rooms.delete(key)
        console.log(`Client ${socket.id} disconnected from room: ${room}`)
      }
    })
  })
})

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
