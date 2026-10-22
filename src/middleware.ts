import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// if not provided, it will Allow ALl Origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()) || []
const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Mode',
    'Access-Control-Max-Age': '600',
}

const isOriginCheckEnforced = () => process.env.NODE_ENV === "production" && ALLOWED_ORIGINS.length > 0

export async function middleware(request: NextRequest): Promise<NextResponse> {
    // uploaded files are public & cached as immutable: allow any origin unconditionally, otherwise a copy cached
    // from a plain <img> load (no Origin, no CORS headers) breaks later cross-origin fetches of the same URL
    if (request.method === 'GET' && request.nextUrl.pathname.startsWith('/api/file/')) {
        const response = NextResponse.next()
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
    }

    const origin = request.headers.get("Origin") ?? ''
    const isOriginAllowed = !!origin && (!isOriginCheckEnforced() || ALLOWED_ORIGINS.includes(origin))

    //  preflighted
    if (request.method === 'OPTIONS') {
        if (!isOriginAllowed) return new NextResponse(null, { status: 403 })
        return new NextResponse(null, {
            status: 204,
            headers: { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', ...corsHeaders },
        })
    }

    // Origin Check
    if (request.method !== "GET" && isOriginCheckEnforced()) {
        const host = request.headers.get("Host")
        if (!origin || !host || !isOriginAllowed)
            return new NextResponse(null, { status: 403 })
    }

    const response = NextResponse.next()
    // responses differ per origin (CORS headers), caches must not reuse them across origins
    response.headers.set('Vary', 'Origin')

    if (isOriginAllowed) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value)
        })
    }

    return response
}

export const config = {
    matcher: '/api/:path*',
}
