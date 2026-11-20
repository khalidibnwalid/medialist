import type { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';

/**
 * Tells a client (e.g. the mobile app via QR) which address it should use to reach this server.
 * No auth: it only exposes addresses the requester could already reach.
 * Set `PUBLIC_URL` to override detection (e.g. behind a reverse proxy / domain).
 */

interface ConnectResponse {
    /** API base, e.g. http://192.168.1.23:3000/api */
    url: string
    candidates: string[]
}

const VIRTUAL_ADAPTER = /vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|vboxnet|docker\d*|br-|veth|virbr/i

const toApiUrl = (base: string) => {
    let url = base.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`
    if (!url.endsWith('/api')) url = `${url}/api`
    return url
}

/** lower is better */
const ipRank = (ip: string) => {
    if (ip.startsWith('192.168.')) return 0
    if (ip.startsWith('10.')) return 1
    const [a, b] = ip.split('.').map(Number)
    if (a === 172 && b >= 16 && b <= 31) return 2
    return 3
}

function getLanAddresses() {
    const interfaces = os.networkInterfaces()
    const all: { ip: string, isVirtual: boolean }[] = []

    for (const [name, addresses] of Object.entries(interfaces)) {
        for (const address of addresses ?? []) {
            // node < 18.4 returns family as number
            const isIPv4 = address.family === 'IPv4' || (address.family as unknown) === 4
            if (!isIPv4 || address.internal) continue
            if (address.address.startsWith('169.254.')) continue // link-local
            all.push({ ip: address.address, isVirtual: VIRTUAL_ADAPTER.test(name) })
        }
    }

    const physical = all.filter(a => !a.isVirtual)
    const chosen = physical.length ? physical : all

    return [...new Set(chosen.map(a => a.ip))]
        .sort((a, b) => ipRank(a) - ipRank(b))
}

const isLocalHostname = (hostname: string) =>
    ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'].includes(hostname.toLowerCase())

export default function handler(req: NextApiRequest, res: NextApiResponse<ConnectResponse | { message: string }>) {
    if (req.method !== 'GET')
        return res.status(405).json({ message: 'Method Not Allowed' })

    res.setHeader('Cache-Control', 'no-store')

    if (process.env.PUBLIC_URL) {
        const url = toApiUrl(process.env.PUBLIC_URL)
        return res.status(200).json({ url, candidates: [url] })
    }

    const hostHeader = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim()
        || req.headers.host
        || ''
    // supports "host:port" and "[ipv6]:port"
    const match = hostHeader.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/)
    const hostname = match?.[1] ?? ''
    const port = match?.[2] || process.env.PORT || '3000'

    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
    const protocol = forwardedProto === 'https' ? 'https' : 'http'

    const withPort = (host: string) => {
        const isDefaultPort = (protocol === 'http' && port === '80') || (protocol === 'https' && port === '443')
        return `${protocol}://${host}${isDefaultPort ? '' : `:${port}`}/api`
    }

    const candidates: string[] = []
    if (hostname && !isLocalHostname(hostname))
        candidates.push(withPort(hostname))

    for (const ip of getLanAddresses()) {
        const url = withPort(ip)
        if (!candidates.includes(url)) candidates.push(url)
    }

    if (!candidates.length)
        candidates.push(withPort(hostname || 'localhost'))

    res.status(200).json({ url: candidates[0], candidates })
}
