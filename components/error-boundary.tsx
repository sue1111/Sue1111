"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Логируем ошибку на сервер
    this.logErrorToServer(error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })
  }

  private async logErrorToServer(error: Error, errorInfo: React.ErrorInfo) {
    try {
      await fetch('/api/error-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          type: 'client-side',
          component: 'ErrorBoundary',
          stack: error.stack,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (logError) {
      console.error('Failed to log error to server:', logError)
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
          <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-center mb-6">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            
            <h1 className="mb-4 text-center text-2xl font-bold text-gray-900 dark:text-white">
              Что-то пошло не так
            </h1>
            
            <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
              Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернуться на главную.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                  Детали ошибки (только для разработки)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-red-600 dark:text-red-400">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex flex-col gap-3">
              <Button
                onClick={this.resetError}
                className="flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Попробовать снова
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Вернуться на главную
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary 