import ItemFormHeaderSection from "@/components/forms/item/ItemFormHeaderSection";
import ItemFormHeaderTitleBar from "@/components/forms/item/ItemFormHeaderTitleBar";
import ItemFormLayoutSection from "@/components/forms/item/ItemFormLayoutSection";
import ItemFormProvider, {
  ItemFormCounterGen,
  ItemFormData,
  ItemFormField,
  ItemFormLayoutTab,
  ItemFormLogoField,
} from "@/components/forms/item/ItemFormProvider";
import ItemFormLayoutTitleBar from "@/components/forms/item/layoutTitleBar/ItemFormLayoutTitleBar";
import ErrorPage from "@/components/layouts/ErrorPage";
import ListsLoading from "@/components/layouts/loading/ListsLoading";
import StatusSubmitButton from "@/components/ui/buttons/StatusSubmitButton";
import { validateShortID } from "@/utils/lib/generateID";
import httpClient from "@/utils/lib/httpClient";
import { mutateItemCache } from "@/utils/lib/tanquery/itemsQuery";
import { singleListQueryOptions } from "@/utils/lib/tanquery/listsQuery";
import { mutateMediaCache } from "@/utils/lib/tanquery/mediaQuery";
import {
  mutateTagCache,
  tagsQueryOptions,
} from "@/utils/lib/tanquery/tagsQuery";
import { templatesQueryOptions } from "@/utils/lib/tanquery/templatesQuery";
import { errorToast, simpleToast } from "@/utils/toast";
import { ItemData, ItemSaveResponse } from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import {
  addToast,
  Button,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BiCheckDouble, BiRevision, BiSearch } from "react-icons/bi";
import { FaSave } from "react-icons/fa";
import { PiBlueprint } from "react-icons/pi";

function AddItemPage() {
  const router = useRouter();
  const listId = router.query.id as ListData["id"];

  const itemForm = useForm<ItemFormData>({
    defaultValues: {
      header: {
        type: "poster_beside",
      },
      tags: [],
    },
  });
  const { handleSubmit } = itemForm;

  const {
    data: list,
    isSuccess,
    isPending,
  } = useQuery(singleListQueryOptions(listId));
  const tags = useQuery(tagsQueryOptions(listId));
  const templatesQuery = useQuery(templatesQueryOptions());

  const mutation = useMutation({
    mutationFn: (formData: FormData) =>
      httpClient().post(`lists/${listId}/items`, formData),
    onError: () =>
      addToast(errorToast("Try Again", () => handleSubmit(onSubmit)())),
    onSuccess: ({ item, newTags, newMedia }: ItemSaveResponse) => {
      mutateItemCache(item, "add");
      newTags?.forEach((tag) => mutateTagCache(tag, "add"));
      newMedia?.forEach((media) => mutateMediaCache(media, "add"));
      addToast(simpleToast(`${list?.title} / ${item.title} - Created`));
      router.push(`/lists/${listId}/${item.id}`);
    },
  });

  const [layoutTabs, setLayoutTabs] = useState<ItemFormLayoutTab[]>([
    [{ type: "left_sidebar", label: "Main" }, [{ id: "1", type: "tags" }], []],
  ]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  function onSubmit(data: ItemFormData) {
    const formData = new FormData();
    const logoFieldsTypes = ["badge", "link"];

    const genKey = () => String(ItemFormCounterGen.next().value);
    let layout = layoutTabs.map((tab) =>
      tab.map((row, rowIndex) =>
        rowIndex === 0
          ? row //header
          : (row as ItemFormField[]).map((field) => {
              if (logoFieldsTypes.includes(field.type)) {
                const key = genKey();
                const fieldT = field as ItemFormLogoField;
                if (fieldT?.logoPath)
                  formData.append(`logoPaths[${key}]`, fieldT.logoPath as File);
                return {
                  ...field,
                  logoPath: fieldT?.logoPath && key,
                  id: undefined,
                };
              } else {
                return { ...field, id: undefined };
              }
            }),
      ),
    );

    //Header
    formData.append("header", JSON.stringify(data.header));
    formData.append("title", data.title);
    formData.append("description", data.description as string);
    if (data.cover) formData.append("cover", data.cover as File);
    if (data.poster) formData.append("poster", data.poster as File);

    //Layout
    formData.append("layout", JSON.stringify(layout));
    formData.append("tags", JSON.stringify(data.tags));

    if (data.media) {
      const media = data.media.map((media) => {
        const key = media.ref;
        formData.append(`mediaImages[${key}]`, media.path as File);
        return {
          title: media.title,
          keywords: media.keywords,
          path: key,
        };
      });
      formData.append("media", JSON.stringify(media));
    }

    mutation.mutate(formData);
  }

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  if (isPending || tags.isPending) return <ListsLoading />;
  if (!isSuccess || !tags.isSuccess)
    return <ErrorPage message="Failed To Fetch The List" />;

  return (
    <ItemFormProvider
      tags={tags.data}
      list={list}
      itemForm={itemForm}
      layoutTabs={layoutTabs}
      setLayoutTabs={setLayoutTabs}
      activeTabIndex={activeTabIndex}
    >
      <Head>
        <title>MediaList - {list.title} - Add Item</title>
      </Head>
      <ItemFormHeaderTitleBar>
        {templatesQuery.data && templatesQuery.data.length > 0 && (
          <>
            <Button onPress={onOpen} isIconOnly>
              <PiBlueprint size={20} />
            </Button>
            <TemplatePickerModal
              isOpen={isOpen}
              onOpenChange={onOpenChange}
              templates={templatesQuery.data}
              onSelect={(t) => {
                const currentValues = itemForm.getValues();
                // Use reset to reliably populate the form fields while preserving media/tags
                itemForm.reset({
                  ...currentValues,
                  title: t.title,
                  description: t.description || "",
                  header: t.header,
                });

                // Ensure layout fields have unique IDs for dnd-kit
                let idGen = Date.now();
                const layoutWithIds = (t.layout as ItemFormLayoutTab[]).map(
                  (tab) =>
                    tab.map((column, i) =>
                      i === 0
                        ? column
                        : (column as any[]).map((field) => ({
                            ...field,
                            id: String(++idGen),
                          })),
                    ),
                );
                setLayoutTabs(layoutWithIds as ItemFormLayoutTab[]);
              }}
            />
          </>
        )}
        <StatusSubmitButton
          color="primary"
          mutation={mutation}
          onPress={handleSubmit(onSubmit)}
          defaultContent={<FaSave className="text-xl" />}
          savedContent={<BiCheckDouble className="text-xl" />}
          errorContent={<BiRevision className="text-xl" />}
          isIconOnly
        />
      </ItemFormHeaderTitleBar>
      <ItemFormHeaderSection />

      <ItemFormLayoutTitleBar
        layoutTabs={layoutTabs}
        setLayoutTabs={setLayoutTabs}
        activeTabIndex={activeTabIndex}
        setActiveTabIndex={setActiveTabIndex}
      />
      <ItemFormLayoutSection />
    </ItemFormProvider>
  );
}

function TemplatePickerModal({
  isOpen,
  onOpenChange,
  templates,
  onSelect,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ItemData[];
  onSelect: (template: ItemData) => void;
}) {
  const [searchValue, setSearchValue] = useState("");

  const filtered = useMemo(() => {
    return templates.filter((t) =>
      t.title.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [templates, searchValue]);

  return (
    <Modal
      isOpen={isOpen}
      placement="center"
      onOpenChange={onOpenChange}
      size="4xl"
    >
      <ModalContent className="max-h-[80vh] overflow-y-auto">
        {(onClose) => (
          <ModalBody className="w-full p-3">
            <Input
              className="text-foreground shadow-none"
              placeholder="Search templates..."
              startContent={<BiSearch className="opacity-80" size={20} />}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <div className="w-full grid grid-cols-sm-card gap-2">
              {filtered.map((t) => (
                <Card
                  key={t.id}
                  isPressable
                  className="aspect-square border-5 border-accented hover:scale-105 hover:border-primary cursor-pointer animate-fade-in bg-accented overflow-hidden group"
                  onPress={() => {
                    onSelect(t);
                    onClose();
                  }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center relative p-2">
                    <PiBlueprint className="text-6xl font-light opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="absolute inset-x-0 bottom-0 p-2 flex flex-col items-center">
                      <span className="text-xs font-bold truncate w-full text-center text-foreground">
                        {t.title}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}

export default function AddItemPageHOC() {
  const router = useRouter();
  const listId = router.query.id as ListData["id"];
  return validateShortID(listId) ? (
    <AddItemPage />
  ) : (
    <ErrorPage
      message="Bad List ID, Page Doesn't Exist"
      MainMessage="404!"
      hideTryAgain
    />
  );
}
