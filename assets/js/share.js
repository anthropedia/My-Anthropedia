
function shareSession(token) {
  // Connect to WebSocket server with the token
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${protocol}//${window.location.host}?token=${token}`
  const socket = new WebSocket(wsUrl)

  // Handle WebSocket connection open
  socket.addEventListener("open", (event) => {
    if(socket.onOpen) socket.onOpen(event)
    console.info("Connected to the sharing room", token)
  })

  // Handle receiving messages
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data)
    if(socket.onData) socket.onData(data)
    console.debug("message", data)
  })
  
  // Handle WebSocket errors
  socket.addEventListener("error", (event) => {
    if(socket.onError) socket.onError(event)
      console.warn("WebSocket error occurred")
    console.error("WebSocket error:", event)
  })
  
  // Handle WebSocket connection close
  socket.addEventListener("close", (event) => {
    if(socket.onClose) socket.onClose(event)
    console.warn(`Disconnected from the sharing room (Code: ${event.code})`)
  })

  socket.publish = function(data) {
    const publishable = JSON.stringify({ ...data, timestamp: Date.now() })
    console.info("Publishing", publishable)
    this.send(publishable)
  }
  
  // For convenient client debugging purpose
  window.socket = socket

  return socket
}

export { shareSession }
