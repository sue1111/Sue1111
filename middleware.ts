import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Add security headers
  const response = NextResponse.next()

  // Set security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  
  // Дополнительные security headers
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("X-DNS-Prefetch-Control", "off")
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

  // Set Content-Security-Policy for production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https://*.supabase.co; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';",
    )
  }

  // Защита от SQL инъекций в URL параметрах
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  
  // Проверяем API endpoints на потенциальные SQL инъекции
  if (pathname.startsWith('/api/')) {
    // Проверяем UUID параметры
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    
    // Извлекаем UUID из URL (например, /api/users/[id])
    const uuidMatch = pathname.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i)
    
    if (uuidMatch && !uuidPattern.test(uuidMatch[1])) {
      return NextResponse.json({ error: "Invalid UUID format" }, { status: 400 })
    }
    
    // Проверяем query параметры на SQL инъекции
    const searchParams = url.searchParams
    for (const [key, value] of searchParams.entries()) {
      // Проверяем на потенциальные SQL инъекции
      if (value.includes("'") || value.includes(";") || value.includes("--") || 
          value.includes("/*") || value.includes("*/") || value.includes("xp_")) {
        return NextResponse.json({ error: "Invalid characters in request" }, { status: 400 })
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
