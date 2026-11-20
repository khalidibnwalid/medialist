import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

/** ALLOWED_ORIGINS is read at module load, so re-import after stubbing env */
async function loadMiddleware(env: { NODE_ENV?: string, ALLOWED_ORIGINS?: string } = {}) {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', env.NODE_ENV ?? 'development')
    // stubbing to undefined removes the variable (an empty string would count as one "" origin)
    vi.stubEnv('ALLOWED_ORIGINS', env.ALLOWED_ORIGINS)
    return (await import('@/middleware')).middleware
}

const request = (method: string, headers: Record<string, string> = {}, path = '/api/lists') =>
    new NextRequest(`http://localhost:3000${path}`, { method, headers })

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('middleware CORS', () => {
    test('OPTIONS preflight → 204 with the request origin and allowed methods/headers', async () => {
        const middleware = await loadMiddleware()
        const res = await middleware(request('OPTIONS', {
            Origin: 'http://localhost:8081',
            'Access-Control-Request-Method': 'PATCH',
            'Access-Control-Request-Headers': 'authorization, x-auth-mode',
        }))

        expect(res.status).toBe(204)
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081')
        expect(res.headers.get('Vary')).toBe('Origin')
        const methods = res.headers.get('Access-Control-Allow-Methods')!.split(',').map(s => s.trim())
        expect(methods).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']))
        const allowedHeaders = res.headers.get('Access-Control-Allow-Headers')!.split(',').map(s => s.trim().toLowerCase())
        expect(allowedHeaders).toEqual(expect.arrayContaining(['content-type', 'authorization', 'x-auth-mode']))
    })

    test('OPTIONS without an Origin → 403', async () => {
        const middleware = await loadMiddleware()
        const res = await middleware(request('OPTIONS'))
        expect(res.status).toBe(403)
    })

    test('non-GET request with an origin gets the CORS headers', async () => {
        const middleware = await loadMiddleware()
        const res = await middleware(request('PATCH', { Origin: 'http://localhost:8081', Host: 'localhost:3000' }))

        expect(res.status).toBe(200)
        expect(res.headers.get('x-middleware-next')).toBe('1')
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081')
        expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PATCH')
        expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    })

    test('request without an origin passes without CORS headers', async () => {
        const middleware = await loadMiddleware()
        const res = await middleware(request('POST', { Host: 'localhost:3000' }))

        expect(res.headers.get('x-middleware-next')).toBe('1')
        expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    test('ALLOWED_ORIGINS is not enforced outside production', async () => {
        const middleware = await loadMiddleware({ NODE_ENV: 'development', ALLOWED_ORIGINS: 'https://good.example' })
        const res = await middleware(request('POST', { Origin: 'https://evil.example', Host: 'localhost:3000' }))

        expect(res.headers.get('x-middleware-next')).toBe('1')
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://evil.example')
    })

    describe('production with ALLOWED_ORIGINS', () => {
        const env = { NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://good.example, https://other.example' }

        test('disallowed origin → 403 (preflight and request)', async () => {
            const middleware = await loadMiddleware(env)

            const preflight = await middleware(request('OPTIONS', { Origin: 'https://evil.example' }))
            expect(preflight.status).toBe(403)

            const post = await middleware(request('POST', { Origin: 'https://evil.example', Host: 'medialist.example' }))
            expect(post.status).toBe(403)
        })

        test('non-GET without an origin → 403', async () => {
            const middleware = await loadMiddleware(env)
            const res = await middleware(request('DELETE', { Host: 'medialist.example' }))
            expect(res.status).toBe(403)
        })

        test('allowed origin passes (origins are trimmed)', async () => {
            const middleware = await loadMiddleware(env)

            const preflight = await middleware(request('OPTIONS', { Origin: 'https://other.example' }))
            expect(preflight.status).toBe(204)
            expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://other.example')

            const post = await middleware(request('POST', { Origin: 'https://good.example', Host: 'medialist.example' }))
            expect(post.headers.get('x-middleware-next')).toBe('1')
            expect(post.headers.get('Access-Control-Allow-Origin')).toBe('https://good.example')
        })

        test('GET from a disallowed origin passes but without CORS headers', async () => {
            const middleware = await loadMiddleware(env)
            const res = await middleware(request('GET', { Origin: 'https://evil.example', Host: 'medialist.example' }))

            expect(res.headers.get('x-middleware-next')).toBe('1')
            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
        })
    })

    describe('uploaded files & caching', () => {
        test('GET /api/file/* always allows any origin, even without an Origin header', async () => {
            const middleware = await loadMiddleware()
            const res = await middleware(request('GET', {}, '/api/file/u/l/i/thumbnails/a.webp'))

            expect(res.headers.get('x-middleware-next')).toBe('1')
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
        })

        test('GET /api/file/* allows any origin in production even with ALLOWED_ORIGINS', async () => {
            const middleware = await loadMiddleware({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.example.com' })
            const res = await middleware(request('GET', { Origin: 'https://evil.example.com' }, '/api/file/u/l/a.webp'))

            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
        })

        test('other API responses always vary on Origin', async () => {
            const middleware = await loadMiddleware()
            const withoutOrigin = await middleware(request('GET'))
            const withOrigin = await middleware(request('GET', { Origin: 'http://localhost:8081' }))

            expect(withoutOrigin.headers.get('Vary')).toBe('Origin')
            expect(withOrigin.headers.get('Vary')).toBe('Origin')
        })
    })
})
