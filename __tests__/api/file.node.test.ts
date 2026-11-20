import fileHandler from '@/pages/api/file/[...path]';
import { $generateID } from '@/server/utils/lib/generateID';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// real fs on purpose: express.static reads from ./public/users
const dirName = `test-file-route-${$generateID(6)}`
const dir = join('public', 'users', dirName)

let server: Server
let base: string

beforeAll(async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'hello.txt'), 'hello world')

    server = createServer(fileHandler)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
    await new Promise(resolve => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
})

describe('GET api/file/[...path]', () => {
    test('serves uploaded files with an immutable 1 year cache', async () => {
        const res = await fetch(`${base}/api/file/${dirName}/hello.txt`)

        expect(res.status).toBe(200)
        expect(await res.text()).toBe('hello world')
        expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    })

    test('missing files are not served', async () => {
        const res = await fetch(`${base}/api/file/${dirName}/missing.txt`)
        expect(res.status).toBe(404)
    })

    test('does not serve outside public/users', async () => {
        const res = await fetch(`${base}/api/file/..%2F..%2Fpackage.json`)
        expect(res.status).not.toBe(200)
    })
})
