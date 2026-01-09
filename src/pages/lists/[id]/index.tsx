import ErrorPage from "@/components/layouts/ErrorPage";
import ListsLoading from "@/components/layouts/loading/ListsLoading";
import ListPageItems from "@/components/page/lists/[id]/ListPageItems";
import ListPageProvider, {
  ListPageContext,
} from "@/components/page/lists/[id]/ListPageProvider";
import ListPageSearchBar from "@/components/page/lists/[id]/ListPageSearchBar";
import ListPageSubNavBar from "@/components/page/lists/[id]/ListPageSubNavBar";
import ListPageTagsList from "@/components/page/lists/[id]/tags/ListPageTagsList";
import TitleBar from "@/components/ui/bars/TitleBar";
import { validateShortID } from "@/utils/lib/generateID";
import {
  itemsQueryOptions,
  setupItemsCache,
} from "@/utils/lib/tanquery/itemsQuery";
import { singleListQueryOptions } from "@/utils/lib/tanquery/listsQuery";
import { tagsQueryOptions } from "@/utils/lib/tanquery/tagsQuery";
import { ListData } from "@/utils/types/list";
import { Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useContext, useEffect } from "react";
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
  const items = useQuery(itemsQueryOptions(listId));
  const tags = useQuery(tagsQueryOptions(listId));

  useEffect(() => {
    if (items.data) setupItemsCache(items.data);
  }, [items.data]);

  if (listQuery.error?.message == "Not Found") return <Error404 />;
  if (isPending || items.isPending || tags.isPending) return <ListsLoading />;
  if (!isSuccess || !items.isSuccess || !tags.isSuccess)
    return <ErrorPage message="Failed To Fetch The List" />;

  return (
    <>
      <Head>
        <title>MediaList - {list.title}</title>
      </Head>

      <ListPageProvider list={list} items={items.data} tags={tags.data}>
        <TitleBar
          title={`${list.title} (${items.data.length})`}
          className="mb-0 p-5 bg-pure-theme"
          startContent={
            <BiCollection className="text-3xl mr-3 flex-none p-0" />
          }
        >
          <ListPageSearchBar />
        </TitleBar>

        <ListPageSubNavBar />
        <div className="relative">
          <ListPageTagsList />
          {items.data.length === 0 && <EmptyScreen />}
          <ListPageItems />
        </div>
      </ListPageProvider>
    </>
  );
}

export default function ListPageHOC() {
  const router = useRouter();
  const listId = router.query.id as ListData["id"];
  return validateShortID(listId) ? <ListPage /> : <Error404 />;
}

const Error404 = () => (
  <ErrorPage
    message="Bad List ID, List Doesn't Exist"
    MainMessage="404!"
    hideTryAgain
  />
);

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
