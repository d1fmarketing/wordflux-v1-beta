import { createServer } from 'http'
import { Server } from 'socket.io'

const port = Number(process.env.WS_PORT || 3002)
const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
})

const io = new Server(httpServer, {
  cors: { origin: '*' }
})

io.on('connection', socket => {
  console.log('[WS] Client connected:', socket.id)

  socket.on('disconnect', () => {
    console.log('[WS] Client disconnected:', socket.id)
  })

  socket.on('board:update', data => {
    io.emit('board:changed', data)
  })

  socket.on('card:moved', data => {
    io.emit('card:updated', data)
  })
})

httpServer.listen(port, () => {
  console.log(`[WS] WebSocket server running on :${port}`)
})
