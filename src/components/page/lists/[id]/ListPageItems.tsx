import ItemCard from "@/components/ui/cards/ItemCard";
import ItemCardsList from "@/components/ui/cards/ItemCardsList";
import useIntersectionObserver from "@/utils/hooks/useIntersectionObserver";
import { Button, Spinner } from "@heroui/react";
import { useContext, useEffect } from "react";
import { ListPageContext } from "./ListPageProvider";

export default function ListPageItems() {
    const { viewMode, visibleItems, badgeableTags } = useContext(ListPageContext)

    switch (viewMode) {
        // case 'list':
        //     return (
        //         <>
        //         </>
        //     )
        case 'cardsList':
            return (
                <>
                    <div className=" grid grid-cols-2 lg:grid-cols-1 gap-4">
                        {visibleItems.map(item =>
                            <ItemCardsList
                                key={item.title + item.id}
                                className="animate-fade-in"
                                item={item}
                                tagsData={badgeableTags}
                            />
                        )}
                    </div >
                    <ListPageLoadMore />
                </>
            )
        default: //cards
            return (
                <>
                    <div className=" grid grid-cols-md-card gap-4">
                        {visibleItems.map(item =>
                            <ItemCard
                                key={item.title + item.id}
                                className="border-none duration-200 hover:scale-110 animate-fade-in"
                                item={item}
                            />
                        )}
                    </div >
                    <ListPageLoadMore />
                </>
            )
    }
}

/** infinite scroll sentinel: loads the next page when it gets near the viewport */
function ListPageLoadMore() {
    const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = useContext(ListPageContext)
    const { ref, isIntersecting } = useIntersectionObserver({ rootMargin: '0px 0px 800px 0px' })

    useEffect(() => {
        // re-runs when a fetch ends, so it keeps loading while the sentinel is still visible
        if (isIntersecting && hasNextPage && !isFetchingNextPage && !isFetchNextPageError)
            fetchNextPage()
    }, [isIntersecting, hasNextPage, isFetchingNextPage, isFetchNextPageError])

    return (
        <div ref={ref} className="flex justify-center items-center w-full min-h-1 py-4">
            {isFetchingNextPage && <Spinner size="sm" aria-label="Loading more items" />}
            {isFetchNextPageError && !isFetchingNextPage &&
                <Button size="sm" className="bg-accented" onPress={() => fetchNextPage()}>
                    Failed to load more items, retry
                </Button>
            }
        </div>
    )
}
