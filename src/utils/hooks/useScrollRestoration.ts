import Router, { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

const storageKey = (path: string) => 'scroll:' + path

// tracks whether the current navigation is a back/forward one (popstate),
// popstate always fires before next's routeChangeStart
let pendingPopState = false
let isPopNavigation = false
if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => { pendingPopState = true })
    Router.events.on('routeChangeStart', () => {
        isPopNavigation = pendingPopState
        pendingPopState = false
    })
}

/** saves the window scroll position when leaving the page, and restores it
 * when coming back with back/forward once `ready` (the content is rendered) */
export default function useScrollRestoration(ready: boolean) {
    const router = useRouter()
    const path = router.asPath
    const handled = useRef(false)

    useEffect(() => {
        const save = () => {
            try { sessionStorage.setItem(storageKey(path), String(window.scrollY)) } catch { }
        }
        router.events.on('routeChangeStart', save)
        return () => router.events.off('routeChangeStart', save)
    }, [path])

    useEffect(() => {
        if (!ready || handled.current) return
        handled.current = true
        if (!isPopNavigation) return
        isPopNavigation = false

        let y = 0
        try { y = Number(sessionStorage.getItem(storageKey(path))) || 0 } catch { }
        if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y))
    }, [ready])
}
