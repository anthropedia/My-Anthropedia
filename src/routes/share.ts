import { Server } from "socket.io"

const rooms = new Map<string, Set<any>>()

function routes(app, server) {
  app.get("/share/:token", (req, res) => {
    const token = req.params.token
    res.render("share", { token })
  })

  const io = new Server(server)

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join a room
    socket.on('joinRoom', (room) => {
      socket.join(room)
      console.log(`Socket ${socket.id} joined room ${room}`);
      io.to(room).emit('roomUsers', Array.from(io.sockets.adapter.rooms.get(room) || []));
    });

    // Leave a room
    socket.on('leaveRoom', (room) => {
      socket.leave(room)
      console.log(`Socket ${socket.id} left room ${room}`);
      io.to(room).emit('roomUsers', Array.from(io.sockets.adapter.rooms.get(room) || []));
    });

    // Disconnect event
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });


}

export default routes
