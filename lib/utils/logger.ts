// Simple logger utility for consistent logging

type LogLevel = "debug" | "info" | "warn" | "error"

class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(data ? { data } : {}),
    }

    switch (level) {
      case "debug":
        if (process.env.NODE_ENV !== "production") {
          console.debug(JSON.stringify(logEntry))
        }
        break
      case "info":
        console.info(JSON.stringify(logEntry))
        break
      case "warn":
        console.warn(JSON.stringify(logEntry))
        break
      case "error":
        console.error(JSON.stringify(logEntry))
        break
    }
  }

  debug(message: string, data?: any): void {
    this.log("debug", message, data)
  }

  info(message: string, data?: any): void {
    this.log("info", message, data)
  }

  warn(message: string, data?: any): void {
    this.log("warn", message, data)
  }

  error(message: string, data?: any): void {
    this.log("error", message, data)
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context)
}
