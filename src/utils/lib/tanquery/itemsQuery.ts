import { queryClient } from '@/components/providers/RootProviders'
import { ItemData } from '@/utils/types/item'
import { ListData } from '@/utils/types/list'
import { InfiniteData, infiniteQueryOptions, Query, queryOptions } from '@tanstack/react-query'
import httpClient from '../httpClient'
import { compareItems, hasItemsFilters, isItemUnderFilters, ItemsFilters, ItemsPage, ITEMS_PAGE_SIZE } from '../itemsPagination'

export const trashItemsKey = ['items', { trash: true }]

/** prefix of all the (filtered) items queries of a list */
export const listItemsKey = (listId: ListData['id']) => ['items', listId, { trash: false }] as const

/** stable filters object (same filters => same query key) */
export const normalizeItemsFilters = (filters: ItemsFilters): ItemsFilters => ({
    q: filters.q?.trim() || undefined,
    tags: filters.tags?.length ? [...filters.tags].sort() : undefined,
    fav: filters.fav || undefined,
})

/** Items of a list, paginated (infinite scroll) & filtered server-side
 *  @example Key: ['items', listId, { trash: false }, { q, tags, fav }] */
export const itemsQueryOptions = (listId: ListData['id'], filters: ItemsFilters = {}) => {
    const normalized = normalizeItemsFilters(filters)
    return infiniteQueryOptions({
        queryKey: [...listItemsKey(listId), normalized],
        queryFn: async ({ pageParam }): Promise<ItemsPage> => {
            const params = new URLSearchParams({ limit: String(ITEMS_PAGE_SIZE) })
            if (pageParam) params.set('cursor', pageParam)
            if (normalized.q) params.set('q', normalized.q)
            if (normalized.tags) params.set('tags', normalized.tags.join(','))
            if (normalized.fav) params.set('fav', 'true')
            return await httpClient().get(`lists/${listId}/items?${params}`)
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
}

/** Single Item */
export const itemQueryOptions = (itemId: ItemData['id']) => queryOptions<ItemData>({
    queryKey: ['item', itemId],
    queryFn: async () => await httpClient().get(`items/${itemId}`),
})

/** will create a cache key for each item */
export const setupItemsCache = (items: ItemData[]) =>
    items.forEach(item => {
        queryClient.setQueryData(['item', item.id], item)
    })

type ItemsInfiniteData = InfiniteData<ItemsPage, string | null>

/** - Edit All Items Cache
 * updates every loaded (filtered) items query of the item's list */
export const mutateItemCache = (data: ItemData, type: "edit" | "add" | "delete") => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: listItemsKey(data.listId) })

    queries.forEach((query: Query) => {
        const old = query.state.data as ItemsInfiniteData | undefined
        if (!old?.pages) return
        const filters = (query.queryKey[3] || {}) as ItemsFilters
        queryClient.setQueryData<ItemsInfiniteData>(query.queryKey, updateItemsPages(old, data, type, filters))

        // the client-side filter check may differ slightly from SQLite's (e.g. non-ASCII case folding),
        // refetch filtered queries next time they are used
        if (hasItemsFilters(filters))
            queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: 'none' })
    })

    if (queryClient.getQueryData(trashItemsKey)) // for trash page
        queryClient.invalidateQueries({ queryKey: trashItemsKey })

    if (type === 'delete') queryClient.removeQueries({ queryKey: ['item', data.id], exact: true })
    else queryClient.setQueryData(['item', data.id], data)
}

/** immutably removes / (re)inserts the item at its sorted position in the loaded pages */
function updateItemsPages(old: ItemsInfiniteData, data: ItemData, type: "edit" | "add" | "delete", filters: ItemsFilters): ItemsInfiniteData {
    let removed = false
    let pages = old.pages.map(page => {
        const items = page.items.filter(item => item.id !== data.id)
        if (items.length !== page.items.length) removed = true
        return { ...page, items }
    })

    if (type !== 'delete' && isItemUnderFilters(data, filters)) {
        // first item that should come after it, if none is loaded and there are unloaded pages,
        // it belongs to an unloaded page and will come with it
        let pageIndex = -1, itemIndex = -1
        for (let p = 0; p < pages.length && pageIndex === -1; p++) {
            const i = pages[p].items.findIndex(item => compareItems(data, item) < 0)
            if (i !== -1) { pageIndex = p; itemIndex = i }
        }
        const lastPage = pages[pages.length - 1]
        if (pageIndex === -1 && lastPage && !lastPage.nextCursor) {
            pageIndex = pages.length - 1
            itemIndex = lastPage.items.length
        }
        if (pageIndex !== -1) {
            const items = [...pages[pageIndex].items]
            items.splice(itemIndex, 0, data)
            pages[pageIndex] = { ...pages[pageIndex], items }
        }
    }

    // total counts the items matching the filters, not just the loaded ones.
    // an item that isn't loaded may still be counted (it's in an unloaded page): assume its membership didn't change
    // (filtered queries are refetched anyway)
    const isCounted = type !== 'delete' && isItemUnderFilters(data, filters)
    const wasCounted = removed
        || (type === 'delete' && !hasItemsFilters(filters))
        || (type === 'edit' && isCounted)
    const diff = (isCounted ? 1 : 0) - (wasCounted ? 1 : 0)
    if (diff) pages = pages.map(page => ({ ...page, total: Math.max(0, page.total + diff) }))

    return { ...old, pages }
}

/** all loaded items of an infinite items query */
export const flattenItemsPages = (data?: { pages: ItemsPage[] }) =>
    data?.pages.flatMap(page => page.items) ?? []
