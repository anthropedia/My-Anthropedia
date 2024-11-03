import express, { Request, Response } from "express"
import { json } from "body-parser"
import path from "path"
import { Eta } from "eta"
import api from "./src/api.ts"
import session from "express-session"
import { all } from "axios"

const PORT = process.env.PORT || 3000
const app = express()
const eta = new Eta({ views: path.join(__dirname, "views") })

app.use(express.urlencoded({ extended: true }))
app.engine("eta", buildEtaEngine())
app.set("view engine", "eta")

type MediaType = {
  id: number
  reference: string
  General_Description_of_KY: string
  title: string
  description: string
  iframe_v2: string
  cover: Array<string>
  Script_v2: string
}

type UserType = {
  id: null
  email: string
  name: string
  role: string
  permissions: [string]
  credit: number
  clients: [object]
  is_admin: boolean
  language: string
  subscription_expiration_date: Date
}

class User {
  constructor(data: UserType) {
    Object.assign(this, data)
    this.subscription_expiration_date = new Date(this.subscription_expiration_date)
  }

  canAccess(ressource: string): boolean {
    if(this.role === "coach" && this.subscription_expiration_date > Date.now()) return true
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
      req.session.user = userResponse.data
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
  res.render("dashboard", { allowedMedias: medias?.filter((m) => user?.canAccess(m.reference)) })
})

app.get("/media/:id", authenticate, (req: Request, res: Response) => {
  const media: MediaType = medias?.find((m) => m.id == req.params.id)
  if(!req.session.user?.canAccess(media.reference)) return res.status(403).render()
  res.render("media", { media })
})

// Authentication middleware
function authenticate(req: Request, res: Response, next: () => void) {
  if (req.session.token) {
    req.session.user = new User(req.session.user)
    next()
  } else {
    res.redirect("/login")
  }
}

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
