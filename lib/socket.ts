import { io, type Socket } from "socket.io-client"

// Флаг для отключения функциональности сокета
const DISABLE_SOCKET = true;

class SocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // начальная задержка в мс

  constructor() {
    // Не инициализируем сокет автоматически, если он отключен
    if (typeof window !== "undefined" && !DISABLE_SOCKET) {
      this.initSocket()
    }
  }

  private initSocket() {
    if (typeof window === "undefined" || DISABLE_SOCKET) return // SSR fix или сокет отключен
    
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
      

      if (!socketUrl) {
        console.error("Socket URL is not defined")
        return
      }

      this.socket = io(socketUrl, {
        transports: ["polling", "websocket"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      })

      this.socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message)

        // Увеличиваем задержку экспоненциально
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 5000)

        this.reconnectAttempts++
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error("Max reconnect attempts reached, giving up")
          this.socket?.disconnect()
        }
      })

      this.socket.on("connect", () => {
        // Сбрасываем счетчики при успешном подключении
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
      })

      this.socket.on("disconnect", (reason) => {
        // Если сервер закрыл соединение, пытаемся переподключиться
        if (reason === "io server disconnect") {
          this.socket?.connect()
        }
      })
    } catch (error) {
      console.error("Error initializing socket:", error)
    }
  }

  public getSocket(): Socket {
    if (DISABLE_SOCKET) {
      // Возвращаем заглушку вместо реального сокета
      const mockSocket = {
        connected: false,
        connect: () => {},
        disconnect: () => {},
        emit: () => {},
        on: () => {},
        off: () => {},
        // Добавляем другие необходимые методы и свойства Socket
        io: {},
        id: "mock-socket-id",
        nsp: "",
        auth: {},
        onAny: () => mockSocket as any,
        prependAny: () => mockSocket as any,
        offAny: () => mockSocket as any,
        listenersAny: () => [],
        onAnyOutgoing: () => mockSocket as any,
        prependAnyOutgoing: () => mockSocket as any,
        offAnyOutgoing: () => mockSocket as any,
        listenersAnyOutgoing: () => [],
        once: () => mockSocket as any,
        removeListener: () => mockSocket as any,
        removeAllListeners: () => mockSocket as any,
        listeners: () => [],
        hasListeners: () => false,
        open: () => mockSocket,
        close: () => mockSocket,
        send: () => mockSocket,
        compress: () => mockSocket,
        volatile: () => mockSocket,
        timeout: () => mockSocket,
        binary: () => mockSocket,
      };
      
      return mockSocket as any;
    }
    
    if (!this.socket) {
      this.initSocket()
    }

    if (!this.socket) {
      throw new Error("Socket could not be initialized")
    }

    return this.socket
  }

  public isSocketConnected(): boolean {
    if (DISABLE_SOCKET) return false;
    return !!this.socket?.connected
  }

  public connect() {
    if (DISABLE_SOCKET) return;
    this.socket?.connect()
  }

  public disconnect() {
    if (DISABLE_SOCKET) return;
    this.socket?.disconnect()
  }

  public reconnect() {
    if (DISABLE_SOCKET) return;
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket.connect()
    } else {
      this.initSocket()
      this.socket?.connect()
    }
  }

  public emit(event: string, data: any) {
    if (DISABLE_SOCKET) return;
    
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn("Socket not connected, cannot emit event:", event)
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (DISABLE_SOCKET) return;
    this.socket?.on(event, callback)
  }

  public off(event: string, callback?: (...args: any[]) => void) {
    if (DISABLE_SOCKET) return;
    this.socket?.off(event, callback)
  }
}

// Создаем синглтон для управления сокетом
export const socketManager = new SocketManager()
