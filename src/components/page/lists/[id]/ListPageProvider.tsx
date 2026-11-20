import useLocalStorage from "@/utils/hooks/useLocalStorage";
import { TagData } from "@/utils/types/global";
import { ItemData } from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { createContext, Dispatch, SetStateAction, useMemo, useState } from "react";

export const ListPageContext = createContext({} as ListPageContext)

/** list page filters, kept in the URL (?q=&tags=&fav=) so they survive navigating back, reloading and sharing */
export function useListPageFilters() {
    const [{ q, tags: tagsQuery, fav }, setFilters] = useQueryStates({
        q: parseAsString.withDefault(''),
        tags: parseAsArrayOf(parseAsString),
        fav: parseAsBoolean.withDefault(false),
    })

    return {
        q,
        setQ: (value: string) => setFilters({ q: value || null }),
        fav,
        setFav: (value: boolean) => setFilters({ fav: value || null }),
        /** tags labels */
        tagsQuery,
        setTagsQuery: (value: string[] | null | ((old: string[] | null) => string[] | null)) =>
            setFilters(old => {
                const next = typeof value === 'function' ? value(old.tags) : value
                return { tags: next?.length ? next : null }
            }),
    }
}

export type ListPageFilters = ReturnType<typeof useListPageFilters>

/** ids of the tags in the URL, labels that don't exist are kept as is (they won't match any item) */
export const tagsLabelsToIds = (labels: string[] | null, tags: TagData[]) =>
    labels?.map(label => tags.find(tag => tag.label === label)?.id || label) || []

export default function ListPageProvider({
    children,
    list,
    items,
    total,
    tags,
    filters,
    pagination,
}: {
    children: React.ReactNode,
    list: ListData,
    /** loaded items (already filtered by the server) */
    items: ItemData[],
    /** count of all the items matching the filters */
    total: number,
    tags: TagData[],
    filters: ListPageFilters,
    pagination: ListPagePagination,
}) {
    const [viewMode, setViewMode] = useLocalStorage<ViewMode>('viewMode-' + list.id, 'cards')
    const [showTags, setShowTags] = useState(false)

    const badgeableTags = useMemo(() => tags.filter(tag => tag.badgeable), [tags])

    const toggleTagQuery = (tag: TagData) => filters.setTagsQuery(q =>
        q?.includes(tag.label)
            ? q?.length === 1 ? null : q?.filter(tagLabel => tagLabel !== tag.label) //remove
            : q?.concat(tag.label) || [tag.label] //add
    )

    return (
        <ListPageContext.Provider value={{
            list,
            items,
            visibleItems: items,
            total,
            viewMode,
            tags,
            setViewMode,
            showTags,
            setShowTags,
            ...filters,
            toggleTagQuery,
            badgeableTags,
            ...pagination,
        }}>
            {children}
        </ListPageContext.Provider>
    )
}

export interface ListPagePagination {
    hasNextPage: boolean
    isFetchingNextPage: boolean
    isFetchNextPageError: boolean
    fetchNextPage: () => unknown
}

interface ListPageContext extends ListPageFilters, ListPagePagination {
    list: ListData
    items: ItemData[],
    /** same as items, filtering is done by the server */
    visibleItems: ItemData[],
    total: number,
    tags: TagData[]
    viewMode: ViewMode
    setViewMode: Dispatch<SetStateAction<ViewMode>>
    showTags: boolean
    setShowTags: Dispatch<SetStateAction<boolean>>
    toggleTagQuery: (tag: TagData) => void,
    badgeableTags: TagData[],
}

type ViewMode = 'cards' | 'cardsList' | 'list';
