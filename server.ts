import express, { Request, Response } from "express"
import { json } from "body-parser"
import path from "path"
import { Eta } from "eta"
import api from "./src/api.ts"
import session from "express-session"

const PORT = process.env.PORT || 3000
const app = express()
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

app.use(sessionMiddleware)
app.use(express.urlencoded({ extended: true }))
app.engine("eta", buildEtaEngine())
app.set("view engine", "eta")

const medias = await api.getData<MediaType>("Videos")

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
    
    // Explicitly set role
    this.role = data.role || (data as any).permissions?.includes('coach') ? 'coach' : 'client'
    
    // Convert subscription date for coaches
    if (this.isCoach && this.subscription_expiration_date) {
      this.subscription_expiration_date = new Date(this.subscription_expiration_date)
    }
  }

  canAccess(resource: string): boolean {
    // Coach access logic
    if (this.isCoach) {
      return this.subscription_expiration_date && 
             this.subscription_expiration_date > new Date()
    }
    
    // Client access logic
    if (this.isClient && this.knowyourself_series) {
      return this.knowyourself_series.includes(getMediaId(resource))
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

app.use(json())
app.use(express.static(path.join(__dirname, "assets")))

// Store active sessions
let activeSessions: Record<string, any> = {}
let clients: any[] = []

// Generate a random 4-character code
const generateCode = () => {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

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
  if(generate_password) {
    try {
      const response = await api.sendClientPassword(email)
      data.message = "A temporary password was sent to you by email."
    }
    catch(request) {
      data.error = request.response.data
    }
    return res.render("login", data)
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
      } catch(request) {
        console.error("Login error:", request.response.data)
        data.error = "Some error occured: " + request.response.data
      }
    }
  } catch(request) {
    console.error("Login error:", request.response.data)
    data.error = "Please check your email and password"
  }
  return res.render("login_client", data)
})

app.get("/login/coach", (req: Request, res: Response) => {
  res.render("login_coach")
})

app.post("/login/coach", async (req: Request, res: Response) => {
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
    res.render("login_coach", { error: "Please check your email and password" })
  }
})

app.get("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) console.error(err)
    else res.redirect("/login")
  })
})

// Protected routes
app.get("/dashboard", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user
  res.render("dashboard", { allowedMedias: medias?.filter((m) => user.canAccess(m.permission)) })
})

app.get("/media/:id", authenticate, (req: Request, res: Response) => {
  const media: MediaType = medias?.find((m) => m.id == req.params.id)
  if(!media) return res.status(404).redirect("/")
  if(!(req as any).user.canAccess(media.permission)) return res.status(403).redirect("/")
  res.render("media", { media, user: (req as any).user })
})

// Authentication middleware
async function authenticate(req: Request, res: Response, next: () => void) {
  // if (!req.session.token) {
  //   res.redirect("/")
  //   return
  // }

  let user
  if (!req.session.rawUser) {
    const userData = await api.getUser(req.session.token)
    if (!userData) return res.redirect("/")
    req.session.rawUser = userData
    user = new User(userData)
  } else {
    user = new User(req.session.rawUser)
  }
  (req as any).user = user
  next()
}

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
