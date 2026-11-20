import { deepEqual, merge3 } from '@/server/sync/merge';
import { describe, expect, test } from 'vitest';

describe('server/sync/merge', () => {
    describe('deepEqual', () => {
        test('compares primitives, arrays and objects structurally', () => {
            expect(deepEqual(1, 1)).toBe(true)
            expect(deepEqual('a', 'b')).toBe(false)
            expect(deepEqual(null, undefined)).toBe(false)
            expect(deepEqual([1, [2, { a: 3 }]], [1, [2, { a: 3 }]])).toBe(true)
            expect(deepEqual([1, 2], [2, 1])).toBe(false)
            expect(deepEqual({ a: 1, b: { c: [1] } }, { b: { c: [1] }, a: 1 })).toBe(true)
            expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
            expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
            expect(deepEqual([], {})).toBe(false)
        })
    })

    describe('merge3', () => {
        test('takes the only side that changed', () => {
            expect(merge3('base', 'local', 'base', false)).toBe('local')
            expect(merge3('base', 'base', 'remote', true)).toBe('remote')
            expect(merge3('base', 'same', 'same', false)).toBe('same')
        })

        test('scalars conflict => last writer wins', () => {
            expect(merge3('base', 'local', 'remote', true)).toBe('local')
            expect(merge3('base', 'local', 'remote', false)).toBe('remote')
            expect(merge3(false, true, null, true)).toBe(true)
        })

        test('unknown base falls through to preferLocal for scalars', () => {
            expect(merge3(undefined, 'local', 'remote', true)).toBe('local')
            expect(merge3(undefined, 'local', 'remote', false)).toBe('remote')
        })

        describe('arrays of primitives (set merge)', () => {
            test('both sides adding', () => {
                expect(merge3(['a'], ['a', 'b'], ['a', 'c'], false)).toEqual(['a', 'c', 'b'])
                expect(merge3(['a'], ['a', 'b'], ['a', 'c'], true)).toEqual(['a', 'c', 'b'])
            })

            test('both sides removing', () => {
                expect(merge3(['a', 'b', 'c'], ['a', 'c'], ['a', 'b'], false)).toEqual(['a'])
            })

            test('one side adding, other removing', () => {
                expect(merge3(['a', 'b'], ['a', 'b', 'c'], ['b'], false)).toEqual(['b', 'c'])
                expect(merge3(['a', 'b'], ['b'], ['a', 'b', 'c'], true)).toEqual(['b', 'c'])
            })

            test('does not duplicate items added by both sides', () => {
                expect(merge3([], ['x', 'y'], ['y', 'z'], true)).toEqual(['y', 'z', 'x'])
            })

            test('unknown base => union', () => {
                expect(merge3(undefined, ['a', 'b'], ['b', 'c'], false)).toEqual(['b', 'c', 'a'])
            })
        })

        describe('objects', () => {
            test('merges keys independently', () => {
                const base = { titlePlacement: 'title-below', a: 1, b: 1 }
                const local = { titlePlacement: 'hidden', a: 1, b: 1 }
                const remote = { titlePlacement: 'title-below', a: 2, b: 1 }
                expect(merge3(base, local, remote, false)).toEqual({ titlePlacement: 'hidden', a: 2, b: 1 })
            })

            test('keys added on either side are kept, keys removed on one side (unchanged on the other) are removed', () => {
                const base = { a: 1, b: 2 }
                const local = { a: 1, c: 3 }        // removed b, added c
                const remote = { a: 5, b: 2, d: 4 } // changed a, added d
                expect(merge3<unknown>(base, local, remote, false)).toEqual({ a: 5, c: 3, d: 4 })
            })

            test('nested conflicts use preferLocal', () => {
                const base = { type: 'poster_inside', badges: [] as string[] }
                const local = { type: 'poster_beside', badges: ['x'] }
                const remote = { type: 'poster_inside_2', badges: ['y'] }
                expect(merge3(base, local, remote, true)).toEqual({ type: 'poster_beside', badges: ['y', 'x'] })
                expect(merge3(base, local, remote, false)).toEqual({ type: 'poster_inside_2', badges: ['y', 'x'] })
            })
        })

        describe('arrays of objects (layout)', () => {
            const header = { type: 'one_row', label: 'tab' }
            const field = (body: string) => ({ type: 'labelText', label: 'label', body })

            test('same length => element-wise merge', () => {
                const base = [[header, [field('a'), field('b')]]]
                const local = [[{ ...header, label: 'local tab' }, [field('a'), field('b')]]]
                const remote = [[header, [field('a'), field('remote')]]]
                expect(merge3(base, local, remote, false)).toEqual([
                    [{ ...header, label: 'local tab' }, [field('a'), field('remote')]]
                ])
            })

            test('different length => last writer wins', () => {
                const base = [[header, [field('a')]]]
                const local = [[header, [field('a')]], [{ ...header, label: 'new tab' }]]
                const remote = [[header, [field('changed')]]]
                expect(merge3(base, local, remote, true)).toEqual(local)
                expect(merge3(base, local, remote, false)).toEqual(remote)
            })

            test('unknown base => last writer wins', () => {
                const local = [{ a: 1 }]
                const remote = [{ a: 2 }]
                expect(merge3(undefined, local, remote, true)).toEqual(local)
                expect(merge3(undefined, local, remote, false)).toEqual(remote)
            })
        })
    })
})
