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

    if (isOriginAllowed) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Vary', 'Origin')
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value)
        })
    }

    return response
}

export const config = {
    matcher: '/api/:path*',
}
