import { TagData } from "../types/global"
import { ItemData } from "../types/item"

/** max (and default) page size of api/lists/[id]/items */
export const ITEMS_PAGE_SIZE = 100

/** response of `GET api/lists/[id]/items` when `limit` or `cursor` is passed */
export interface ItemsPage {
    items: ItemData[]
    /** pass it as `cursor` to get the next page, null if this is the last page */
    nextCursor: string | null
    /** count of all items matching the filters (not just this page) */
    total: number
}

/** server-side filters of `GET api/lists/[id]/items` */
export interface ItemsFilters {
    /** case-insensitive title search */
    q?: string
    /** item must have all of these tags */
    tags?: TagData['id'][]
    /** favorites only */
    fav?: boolean
}

/** same order as the server (SQLite BINARY collation on title, then id) */
export const compareItems = (a: Pick<ItemData, 'title' | 'id'>, b: Pick<ItemData, 'title' | 'id'>) =>
    a.title < b.title ? -1
        : a.title > b.title ? 1
            : a.id < b.id ? -1
                : a.id > b.id ? 1 : 0

/** client-side equivalent of the server filters, used to keep the cache in sync */
export function isItemUnderFilters(item: ItemData, filters: ItemsFilters) {
    if (filters.fav && !item.fav) return false
    if (filters.q && !item.title.toLowerCase().includes(filters.q.toLowerCase())) return false
    if (filters.tags?.length) {
        const itemTags = new Set(item.tags || [])
        if (!filters.tags.every(tagId => itemTags.has(tagId))) return false
    }
    return true
}

export const hasItemsFilters = (filters: ItemsFilters) =>
    Boolean(filters.q || filters.fav || filters.tags?.length)
