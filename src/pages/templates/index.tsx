import ErrorPage from "@/components/layouts/ErrorPage";
import ListsLoading from "@/components/layouts/loading/ListsLoading";
import NewTemplateButton from "@/components/page/templates/NewTemplateButton";
import TitleBar from "@/components/ui/bars/TitleBar";
import TemplateCard from "@/components/ui/cards/TemplateCard";
import {
  setupTemplatesCache,
  templatesQueryOptions,
} from "@/utils/lib/tanquery/templatesQuery";
import { ItemData } from "@/utils/types/item";
import { Button, Input } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BiSearch } from "react-icons/bi";
import { PiBlueprint } from "react-icons/pi";

export default function TemplatesPage() {
  const {
    data: templates,
    isPending,
    isError,
    isSuccess,
  } = useQuery(templatesQueryOptions());

  const [visibleTemplates, setVisibleTemplates] = useState<ItemData[]>([]);
  const router = useRouter();

  useEffect(() => {
    setVisibleTemplates(templates || []);
    if (templates) setupTemplatesCache(templates);
  }, [templates]);

  if (isPending) return <ListsLoading />;
  if (isError || !isSuccess)
    return <ErrorPage message="Failed to Fetch Templates" />;

  function onSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!templates) return;
    const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (!value) return setVisibleTemplates(templates);

    const filtered = templates.filter((t: ItemData) =>
      t.title.toLowerCase().includes(value),
    );
    setVisibleTemplates(filtered);
  }

  return (
    <>
      <Head>
        <title>MediaList - Templates</title>
      </Head>

      <TitleBar
        title="Templates"
        startContent={<PiBlueprint className="text-3xl mr-3 flex-none " />}
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
        {visibleTemplates.map((template) => (
          <TemplateCard key={"template-" + template.id} template={template} />
        ))}
        <NewTemplateButton />
      </main>

      {templates?.length === 0 && <EmptyScreen router={router} />}
    </>
  );
}

function EmptyScreen({ router }: any) {
  return (
    <div className="flex items-center justify-center w-full h-70 mt-10">
      <section className="flex justify-center items-center flex-col gap-y-5">
        <span className="text-9xl">📄</span>
        <article className="grid">
          <h2 className="text-4xl text-foreground-600 text-center">
            No Templates Yet?
          </h2>
          <p className="text-foreground-500 text-center mb-4">
            Create your first item layout template!
          </p>
          <Button
            color="primary"
            onPress={() => router.push("/templates/add")}
            size="lg"
          >
            Create Template
          </Button>
        </article>
      </section>
    </div>
  );
}
