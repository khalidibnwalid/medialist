import ErrorPage from "@/components/layouts/ErrorPage";
import ListsLoading from "@/components/layouts/loading/ListsLoading";
import ListPageItems from "@/components/page/lists/[id]/ListPageItems";
import ListPageProvider, {
  ListPageContext,
  tagsLabelsToIds,
  useListPageFilters,
} from "@/components/page/lists/[id]/ListPageProvider";
import ListPageSearchBar from "@/components/page/lists/[id]/ListPageSearchBar";
import ListPageSubNavBar from "@/components/page/lists/[id]/ListPageSubNavBar";
import ListPageTagsList from "@/components/page/lists/[id]/tags/ListPageTagsList";
import TitleBar from "@/components/ui/bars/TitleBar";
import useScrollRestoration from "@/utils/hooks/useScrollRestoration";
import { validateShortID } from "@/utils/lib/generateID";
import { hasItemsFilters } from "@/utils/lib/itemsPagination";
import {
  flattenItemsPages,
  itemsQueryOptions,
  setupItemsCache,
} from "@/utils/lib/tanquery/itemsQuery";
import { singleListQueryOptions } from "@/utils/lib/tanquery/listsQuery";
import { tagsQueryOptions } from "@/utils/lib/tanquery/tagsQuery";
import { ListData } from "@/utils/types/list";
import { Button } from "@heroui/react";
import {
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useContext, useEffect, useMemo } from "react";
import { BiCollection, BiPlus } from "react-icons/bi";

function ListPage() {
  const router = useRouter();
  const listId = router.query.id as ListData["id"];

  const {
    data: list,
    isSuccess,
    isPending,
    ...listQuery
  } = useQuery(singleListQueryOptions(listId));
  const tags = useQuery(tagsQueryOptions(listId));

  // search, tags & fav live in the URL, the server does the filtering
  const filters = useListPageFilters();
  const tagsIds = useMemo(
    () => (tags.data ? tagsLabelsToIds(filters.tagsQuery, tags.data) : []),
    [filters.tagsQuery, tags.data]
  );
  const itemsFilters = { q: filters.q, tags: tagsIds, fav: filters.fav };

  const items = useInfiniteQuery({
    ...itemsQueryOptions(listId, itemsFilters),
    enabled: tags.isSuccess, // tags labels (URL) => ids
    // keep showing the old results while a new filter loads (same list only)
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === listId ? previous : undefined,
  });
  const loadedItems = useMemo(
    () => flattenItemsPages(items.data),
    [items.data]
  );
  const total = items.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    setupItemsCache(loadedItems);
  }, [loadedItems]);

  useScrollRestoration(items.isSuccess && isSuccess);

  if (listQuery.error?.message == "Not Found") return <Error404 />;
  if (isPending || items.isPending || tags.isPending) return <ListsLoading />;
  if (!isSuccess || !items.isSuccess || !tags.isSuccess)
    return <ErrorPage message="Failed To Fetch The List" />;

  const isFiltered = hasItemsFilters(itemsFilters);

  return (
    <>
      <Head>
        <title>MediaList - {list.title}</title>
      </Head>

      <ListPageProvider
        list={list}
        items={loadedItems}
        total={total}
        tags={tags.data}
        filters={filters}
        pagination={{
          hasNextPage: items.hasNextPage && !items.isPlaceholderData,
          isFetchingNextPage: items.isFetchingNextPage,
          isFetchNextPageError: items.isFetchNextPageError,
          fetchNextPage: items.fetchNextPage,
        }}
      >
        <TitleBar
          title={`${list.title} (${total})`}
          className="mb-0 p-5 bg-pure-theme"
          startContent={
            <BiCollection className="text-3xl mr-3 flex-none p-0" />
          }
        >
          <ListPageSearchBar />
        </TitleBar>

        <ListPageSubNavBar />
        <div
          className={
            "relative duration-200 " +
            (items.isPlaceholderData ? "opacity-60" : "")
          }
        >
          <ListPageTagsList />
          {total === 0 && (isFiltered ? <NoResults /> : <EmptyScreen />)}
          <ListPageItems />
        </div>
      </ListPageProvider>
    </>
  );
}

export default function ListPageHOC() {
  const router = useRouter();
  const listId = router.query.id as ListData["id"];
  // query (id & filters) isn't available before the router is ready on a page reload
  if (!router.isReady) return <ListsLoading />;
  return validateShortID(listId) ? <ListPage /> : <Error404 />;
}

const Error404 = () => (
  <ErrorPage
    message="Bad List ID, List Doesn't Exist"
    MainMessage="404!"
    hideTryAgain
  />
);

function NoResults() {
  return (
    <div className="flex items-center justify-center w-full h-48">
      <p className="text-foreground-500 text-center">
        No items match the current filters
      </p>
    </div>
  );
}

function EmptyScreen() {
  const router = useRouter();
  const { list } = useContext(ListPageContext);

  return (
    <div className="flex items-center justify-center w-full h-96">
      <section className="flex justify-center items-center flex-col gap-y-5">
        <span className="text-9xl ml-1">🎉</span>
        <article className="grid">
          <h2 className="text-4xl text-foreground-600 text-center">
            Create Your First Item
          </h2>
          <p className="text-foreground-500 text-center">
            Add an item and watch your list grow!
          </p>
        </article>
        <Button
          className="bg-accented"
          onPress={() => router.push(`/lists/${list.id}/add`)}
          title="Create List"
          size="lg"
        >
          <BiPlus size={24} />
        </Button>
      </section>
    </div>
  );
}
