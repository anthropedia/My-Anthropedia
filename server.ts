import express, { Request, Response } from "express"
import { json } from "body-parser"
import path from "path"
import { Eta } from "eta"
import api from "./src/api.ts"
import session from "express-session"

const PORT = process.env.PORT || 3000
const app = express()
const eta = new Eta({ views: path.join(__dirname, "views") })

app.use(express.urlencoded({ extended: true }))
app.engine("eta", buildEtaEngine())
app.set("view engine", "eta")

function getMediaId(s: string): string {
  return s[0].toLowerCase() + s.match(/\d+/)[0]
}

type MediaType = {
  id: number
  reference: string
  permission: string
  General_Description_of_KY: string
  title: string
  description: string
  iframe_v2: string
  cover: Array<string>
  Script_v2: string
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
  vod_access_code: string
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
    if(this.isCoach) this.subscription_expiration_date = new Date(this.subscription_expiration_date)
    if(this.isClient) console.debug(this)
  }

  canAccess(ressource: string): boolean {
    if(this.subscription_expiration_date > Date.now()) return true
    if(this.knowyourself_series) {
      if(this.knowyourself_series.includes(getMediaId(ressource))) return true
    }
    return false
  }
}

const medias = await api.getData<MediaType>("Videos")

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

app.use(json())
app.use(express.static(path.join(__dirname, "assets")))

// Store active sessions
let activeSessions: Record<string, any> = {}
let clients: any[] = []

// Generate a random 4-character code
const generateCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

// Session setup
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
)

app.get("/", (req: Request, res: Response) => {
  if (req.session.token) {
    res.redirect("/dashboard")
  } else {
    res.redirect("/login")
  }
})

// Auth
app.get("/login", (req: Request, res: Response) => {
  res.render("login")
})

app.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body
  try {
    const response = await api.login(email, password)
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
    res.render("login", { error: "Please check your email and password" })
  }
})

app.get("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err)
    } else {
      res.redirect("/login")
    }
  })
})

// Protected routes
app.get("/dashboard", authenticate, (req: Request, res: Response) => {
  const user = req.session.user
  res.render("dashboard", { allowedMedias: medias?.filter((m) => user.canAccess(m.permission)) })
})

app.get("/media/:id", authenticate, (req: Request, res: Response) => {
  const media: MediaType = medias?.find((m) => m.id == req.params.id)
  if(!req.session.user.canAccess(media.permission)) return res.status(403).render()
  res.render("media", { media })
})

// Authentication middleware
function authenticate(req: Request, res: Response, next: () => void) {
  if (req.session.token) {
    req.session.user = new User(req.session.rawUser)
    console.info("User", req.session.user)
    next()
  } else {
    res.redirect("/login")
  }
}

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
