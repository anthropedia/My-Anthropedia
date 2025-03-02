const sessions = {}

function routes(app: express.Express) {
  app.post("/share", async (req, res) => {
    const token = Math.floor(1000 + Math.random() * 9000)
    sessions[token] = { mediaId: req.body.media_id }
    res.json({ token })
  })

  app.get("/share/:token", (req, res) => {
    const token = req.params.token
    res.render("share", { token })
  })
  
  app.get("/events/:token", (req, res) => {
    const token = req.params.token
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // Send an initial event
    sendEvent({ message: "Hello, SSE!" })

    // Send events every 5 seconds
    const intervalId = setInterval(() => {
      sendEvent({ message: `Current time: ${new Date().toISOString()}` })
    }, 5000)

    // Clean up when the client closes the connection
    req.on("close", () => {
      clearInterval(intervalId)
      res.end()
    })
  })
}

export default routes
