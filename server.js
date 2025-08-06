const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { initializeSocketServer } = require('./lib/socket-server-cjs')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// Подготавливаем Next.js приложение
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Создаем HTTP сервер
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Инициализируем WebSocket сервер
  const socketServer = initializeSocketServer(server)
  console.log('✅ WebSocket server initialized successfully')

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket server running on ws://${hostname}:${port}`)
  })
}) 