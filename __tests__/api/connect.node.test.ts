import connectHandler from '@/pages/api/connect';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type Iface = Partial<os.NetworkInterfaceInfo> & { address: string }

const v4 = (address: string, internal = false): Iface => ({ address, family: 'IPv4', internal })
const v6 = (address: string): Iface => ({ address, family: 'IPv6', internal: false })

function mockInterfaces(interfaces: Record<string, Iface[]>) {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue(interfaces as ReturnType<typeof os.networkInterfaces>)
}

// the handler is sync, $mockHttp expects an async one
const handler = async (req: NextApiRequest, res: NextApiResponse) => connectHandler(req, res)

const get = (headers: Record<string, string> = {}) => $mockHttp(handler).get(undefined, { headers })

beforeEach(() => {
    vi.stubEnv('PUBLIC_URL', undefined)
    vi.stubEnv('PORT', undefined)
    mockInterfaces({})
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('GET api/connect', () => {
    test('only GET is allowed', async () => {
        for (const method of ['post', 'put', 'patch', 'delete'] as const) {
            const { statusCode, body } = await $mockHttp(handler)[method]()
            expect(statusCode).toBe(405)
            expect(body).toEqual({ message: 'Method Not Allowed' })
        }
    })

    test('uses PUBLIC_URL when set and appends /api', async () => {
        vi.stubEnv('PUBLIC_URL', 'https://media.example.com/')
        mockInterfaces({ Ethernet: [v4('192.168.1.5')] })

        const { statusCode, body, headers } = await get({ host: 'localhost:3000' })

        expect(statusCode).toBe(200)
        expect(body).toEqual({ url: 'https://media.example.com/api', candidates: ['https://media.example.com/api'] })
        expect(headers).toHaveProperty('cache-control', 'no-store')
    })

    test('PUBLIC_URL: adds http://, keeps sub-paths and does not double /api', async () => {
        vi.stubEnv('PUBLIC_URL', 'media.lan:8080/medialist')
        expect((await get()).body.url).toBe('http://media.lan:8080/medialist/api')

        vi.stubEnv('PUBLIC_URL', 'https://media.example.com/api//')
        expect((await get()).body.url).toBe('https://media.example.com/api')
    })

    test('a non-localhost Host header comes first, then LAN addresses', async () => {
        mockInterfaces({ Ethernet: [v4('192.168.1.5')] })

        const { body } = await get({ host: 'myserver.local:3000' })

        expect(body.url).toBe('http://myserver.local:3000/api')
        expect(body.candidates).toEqual(['http://myserver.local:3000/api', 'http://192.168.1.5:3000/api'])
    })

    test('a localhost Host header is skipped in favour of the LAN address', async () => {
        mockInterfaces({ Ethernet: [v4('192.168.1.5')] })

        for (const host of ['localhost:3000', '127.0.0.1:3000', '0.0.0.0:3000', '[::1]:3000']) {
            const { body } = await get({ host })
            expect(body).toEqual({ url: 'http://192.168.1.5:3000/api', candidates: ['http://192.168.1.5:3000/api'] })
        }
    })

    test('the Host header is not duplicated when it is also a LAN address', async () => {
        mockInterfaces({ Ethernet: [v4('192.168.1.5')] })
        const { body } = await get({ host: '192.168.1.5:3000' })
        expect(body.candidates).toEqual(['http://192.168.1.5:3000/api'])
    })

    test('LAN candidates are ordered 192.168 > 10. > 172.16-31 > others', async () => {
        mockInterfaces({
            eth0: [v4('172.20.0.3'), v4('8.8.4.4')],
            eth1: [v4('10.0.0.7')],
            wlan0: [v4('192.168.0.42')],
        })

        const { body } = await get({ host: 'localhost:4000' })

        expect(body.candidates).toEqual([
            'http://192.168.0.42:4000/api',
            'http://10.0.0.7:4000/api',
            'http://172.20.0.3:4000/api',
            'http://8.8.4.4:4000/api',
        ])
        expect(body.url).toBe(body.candidates[0])
    })

    test('skips internal, IPv6, link-local (169.254) and virtual adapters', async () => {
        mockInterfaces({
            lo: [v4('127.0.0.1', true)],
            Ethernet: [v4('169.254.10.10'), v6('fe80::1'), v4('10.1.2.3')],
            'vEthernet (WSL)': [v4('192.168.100.1')],
            docker0: [v4('192.168.50.1')],
            'VirtualBox Host-Only Network': [v4('192.168.56.1')],
        })

        const { body } = await get({ host: 'localhost:3000' })

        expect(body.candidates).toEqual(['http://10.1.2.3:3000/api'])
    })

    test('falls back to virtual adapters when there is no physical one', async () => {
        mockInterfaces({ 'vEthernet (WSL)': [v4('172.18.0.1')] })
        const { body } = await get({ host: 'localhost:3000' })
        expect(body.candidates).toEqual(['http://172.18.0.1:3000/api'])
    })

    test('falls back to the host (or localhost) when nothing else is found', async () => {
        expect((await get({ host: 'localhost:3000' })).body.candidates).toEqual(['http://localhost:3000/api'])
        expect((await get()).body.candidates).toEqual(['http://localhost:3000/api'])
    })

    test('uses PORT when the host has no port, and honours x-forwarded-* headers', async () => {
        vi.stubEnv('PORT', '4567')
        mockInterfaces({ Ethernet: [v4('192.168.1.5')] })
        expect((await get({ host: 'localhost' })).body.url).toBe('http://192.168.1.5:4567/api')

        const { body } = await get({ host: 'localhost:3000', 'x-forwarded-host': 'media.example.com:443', 'x-forwarded-proto': 'https' })
        expect(body.url).toBe('https://media.example.com/api')
    })
})
