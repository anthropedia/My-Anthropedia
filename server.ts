import express from "express"
import { json } from "body-parser"
import path from "path"
import { Eta } from "eta"
import api from "./src/api.ts"

const PORT = process.env.PORT || 3000
const app = express()
const eta = new Eta({ views: path.join(__dirname, "views") })

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
      callback(null, renderedTemplate);
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
};

// Routes
app.get("/media/:id", (req, res) => {
  res.render("media", { media: medias?.find(m => m.id == req.params.id) })
});

app.get("/", async (req, res) => {
  res.render("index", { medias })
})

app.get("/media", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "media.html"));
});

// Server-Sent Events route
app.get("/events/:code", (req, res) => {
  const code = req.params.code;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push(res);

  // Send existing session data if it exists
  if (activeSessions[code]) {
    res.write(`data: ${JSON.stringify(activeSessions[code])}\n\n`);
  }

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

// Endpoint to create a new session for a coach
app.post("/create-session", (req, res) => {
  const code = generateCode()
  activeSessions[code] = { mediaId: null }; // Initialize with no media

  res.json({ code });
});

// Endpoint to update session state
app.post("/session/:code", (req, res) => {
  const code = req.params.code;

  if (!activeSessions[code]) return res.status(404).send("Session not found.");

  activeSessions[code] = { ...activeSessions[code], ...req.body };

  // Notify all clients in this session
  sendToClients(activeSessions[code]);

  res.sendStatus(200);
});

function sendToClients(data: any) {
  clients.forEach((client) =>
    client.write(`data: ${JSON.stringify(data)}\n\n`)
  );
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
