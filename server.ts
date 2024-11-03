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

type Media = {
  id: number
  reference: string
  General_Description_of_KY: string
  title: string
  description: string
  iframe_v2: string
  cover: Array<string>
  Script_v2: string
}

const medias = await api.getData<Media>("Videos")

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
    // Token format: aaaaa.bbbbb.ccccc
    if (response.data.split(".").length === 3) {
      req.session.token = response.data
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
  res.render("dashboard")
})

app.get("/media/:id", authenticate, (req: Request, res: Response) => {
  res.render("media", { media: medias?.find((m) => m.id == req.params.id) })
})

// Authentication middleware
function authenticate(req: Request, res: Response, next: () => void) {
  if (req.session) {
    next()
  } else {
    res.redirect("/login")
  }
}

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
