import ErrorPage from "@/components/layouts/ErrorPage";
import ListsLoading from "@/components/layouts/loading/ListsLoading";
import NewListButton from "@/components/page/lists/NewListButton";
import TitleBar from "@/components/ui/bars/TitleBar";
import ListCard from "@/components/ui/cards/ListCard";
import {
  listsQueryOptions,
  setupListsCache,
} from "@/utils/lib/tanquery/listsQuery";
import { ListData } from "@/utils/types/list";
import { Input } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useEffect, useState } from "react";
import { BiCollection, BiSearch } from "react-icons/bi";

export default function ListsPage() {
  const {
    data: Lists,
    isPending,
    isError,
    isSuccess,
  } = useQuery(listsQueryOptions());

  const [visibleLists, setVisibleLists] = useState<ListData[]>([]);
  useEffect(() => {
    setVisibleLists(Lists || []);
    if (Lists) setupListsCache(Lists);
  }, [Lists]);

  if (isPending) return <ListsLoading />;
  if (isError || !isSuccess)
    return <ErrorPage message="Failed to Fetch Lists" />;

  function onSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!Lists) return;
    const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (!value) return setVisibleLists(Lists);

    const filtered = Lists.filter((list) =>
      list.title.toLowerCase().includes(value)
    );
    setVisibleLists(filtered);
  }

  return (
    <>
      <Head>
        <title>MediaList - Lists</title>
      </Head>

      <TitleBar
        title="Lists"
        startContent={<BiCollection className="text-3xl mr-3 flex-none " />}
        className="bg-pure-theme p-5 mb-5"
      >
        <Input
          onKeyUp={onSearch}
          radius="lg"
          placeholder="Type to search..."
          startContent={<BiSearch className="opacity-80" size={20} />}
          className="text-foreground shadow-none"
        />
      </TitleBar>

      <main className="grid grid-cols-sm-card gap-x-4 gap-y-4 animate-fade-in">
        {visibleLists.map((list) => (
          <ListCard key={"list-" + list.id} list={list} />
        ))}
        <NewListButton />
      </main>
      {Lists?.length === 0 && <EmptyScreen />}
    </>
  );
}

function EmptyScreen() {
  return (
    <div className="flex items-center justify-center w-full h-70">
      <section className="flex justify-center items-center flex-col gap-y-5">
        <span className="text-9xl">✨</span>
        <article className="grid">
          <h2 className="text-4xl text-foreground-600 text-center">
            No Lists Yet?
          </h2>
          <p className="text-foreground-500 text-center">
            Create your first list!
          </p>
        </article>
      </section>
    </div>
  );
}
