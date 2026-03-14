import ExtractorParamsModal from "@/components/forms/template/ExtractorParamsModal";
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
import TemplatePickerModal from "@/components/forms/item/TemplatePickerModal";
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
import {
  ItemCardField,
  ItemData,
  ItemField,
  ItemLabelTextField,
  ItemLinkField,
  ItemRatingField,
  ItemSaveResponse,
  ItemTextField,
} from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import { addToast, Button, useDisclosure } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BiCheckDouble, BiRevision } from "react-icons/bi";
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

  const {
    isOpen: isTemplatePickerOpen,
    onOpen: onTemplatePickerOpen,
    onClose: onTemplatePickerClose,
    onOpenChange: onTemplatePickerOpenChange,
  } = useDisclosure();

  const {
    isOpen: isExtractorParamsOpen,
    onOpen: onExtractorParamsOpen,
    onClose: onExtractorParamsClose,
    onOpenChange: onExtractorParamsOpenChange,
  } = useDisclosure();

  const [selectedTemplate, setSelectedTemplate] = useState<ItemData | null>(
    null,
  );
  const [isExtracting, setIsExtracting] = useState(false);

  function applyTemplate(
    t: ItemData,
    resolvedData: Record<string, string | File> = {},
  ) {
    const currentValues = itemForm.getValues();

    const header = { ...t.header };
    if (header.badges) {
      header.badges = header.badges.map((badge, idx) => {
        const val = resolvedData[`header.badges.${idx}`];
        if (val !== undefined) return { ...badge, label: String(val) };
        return badge;
      });
    }

    itemForm.reset({
      ...currentValues,
      title: (resolvedData.title as string) || t.title,
      description: (resolvedData.description as string) || t.description || "",
      header: header,
      poster: resolvedData.poster || currentValues.poster,
      cover: resolvedData.cover || currentValues.cover,
    });

    // Ensure layout fields have unique IDs for dnd-kit
    let idGen = 100;
    const layout = t.layout.map((tab, tabIndex) =>
      tab.map((column, colIndex) =>
        colIndex !== 0
          ? (column as ItemField[]).map((field, fieldIndex) => {
              const fieldKey = `layout.${tabIndex}.${colIndex}.${fieldIndex}`;
              const baseField: ItemField & { id?: string } = {
                ...field,
                id: String(++idGen),
              };

              // Compatibility: check both direct key and property-suffixed key
              const extractedValue = resolvedData[fieldKey];

              if (field.type === "text") {
                const val = resolvedData[`${fieldKey}.text`] ?? extractedValue;
                if (val !== undefined)
                  (baseField as ItemTextField).text = String(val);
              } else if (field.type === "labelText") {
                const val = resolvedData[`${fieldKey}.body`] ?? extractedValue;
                if (val !== undefined)
                  (baseField as ItemLabelTextField).body = String(val);
              } else if (field.type === "link") {
                const val = resolvedData[`${fieldKey}.url`] ?? extractedValue;
                if (val !== undefined)
                  (baseField as ItemLinkField).url = String(val);
              } else if (field.type === "rating") {
                const val =
                  resolvedData[`${fieldKey}.rating`] ?? extractedValue;
                if (val !== undefined)
                  (baseField as ItemRatingField).rating =
                    parseInt(String(val)) || 0;
              } else if (field.type === "card") {
                const titleVal = resolvedData[`${fieldKey}.title`];
                const subTextVal = resolvedData[`${fieldKey}.subText`];
                if (titleVal !== undefined)
                  (baseField as ItemCardField).title = String(titleVal);
                if (subTextVal !== undefined)
                  (baseField as ItemCardField).subText = String(subTextVal);
              }

              return baseField;
            })
          : column,
      ),
    );

    const hasTagsField = layout.some((tab) =>
      tab.some(
        (col, idx) =>
          idx !== 0 && (col as ItemField[]).some((f) => f.type === "tags"),
      ),
    );

    if (!hasTagsField && layout.length > 0 && layout[0].length > 1) {
      (layout[0][1] as ItemField[]).unshift({
        id: String(++idGen),
        type: "tags",
      } as ItemField & { id?: string });
    }

    setLayoutTabs(layout as ItemFormLayoutTab[]);
  }

  async function handleExtract(paramValues: Record<string, string>) {
    if (!selectedTemplate?.extractor) return;
    setIsExtracting(true);
    try {
      const { link, method, params, mappings } = selectedTemplate.extractor;
      let processedLink = link;
      const usedInUrl = new Set<string>();

      params.forEach((p) => {
        const placeholder = `{${p.key}}`;
        if (processedLink.includes(placeholder)) {
          processedLink = processedLink.replaceAll(
            placeholder,
            paramValues[p.key] || "",
          );
          usedInUrl.add(p.key);
        }
      });

      const url = new URL(processedLink);
      let body: Record<string, string> | null = null;

      params.forEach((p) => {
        if (usedInUrl.has(p.key)) return;

        if (p.location === "query") {
          url.searchParams.append(p.key, paramValues[p.key] || "");
        } else if (p.location === "body") {
          if (!body) body = {};
          body[p.key] = paramValues[p.key] || "";
        }
      });

      const res = await fetch("/api/proxy-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.toString(),
          method,
          body: body || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        addToast(
          simpleToast(
            `Extraction Error: ${res.status}`,
            "danger",
            err.message || res.statusText,
          ),
        );
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch (e) {
        addToast(
          simpleToast(
            "Extraction Failed",
            "danger",
            "Invalid JSON response from API",
          ),
        );
        return;
      }

      // mapping
      const resolvedData: Record<string, string | File> = {};
      if (mappings) {
        for (const [target, source] of Object.entries(mappings)) {
          const rawPath = typeof source === "string" ? source : source.path;
          const prefix = typeof source === "string" ? "" : source.prefix || "";
          const suffix = typeof source === "string" ? "" : source.suffix || "";

          const paths = Array.isArray(rawPath) ? rawPath : [rawPath];
          let value: any = undefined;

          for (const path of paths) {
            value = path
              .split(".")
              .reduce(
                (obj: unknown, key) => (obj as Record<string, unknown>)?.[key],
                data,
              );
            if (value !== undefined && value !== null) break;
          }

          if (value !== undefined) {
            const resolvedPrefix = resolvePlaceholders(prefix, data);
            const resolvedSuffix = resolvePlaceholders(suffix, data);
            const formattedValue = `${resolvedPrefix}${value}${resolvedSuffix}`;

            if (
              (target === "poster" || target === "cover") &&
              formattedValue.startsWith("http")
            ) {
              const file = await fetchImageAsFile(
                formattedValue,
                `${target}-${Date.now()}.jpg`,
              );
              resolvedData[target] = file || formattedValue;
            } else {
              resolvedData[target] = formattedValue;
            }
          }
        }
      }

      applyTemplate(selectedTemplate, resolvedData);
      onExtractorParamsClose();
    } catch (e) {
      console.error("Extraction error:", e);
      addToast(
        simpleToast(
          "Extraction Failed",
          "danger",
          "Network error or CORS issue. Check console.",
        ),
      );
    } finally {
      setIsExtracting(false);
    }
  }

  async function fetchImageAsFile(url: string, filename: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], filename, { type: blob.type });
    } catch (e) {
      console.error("Failed to fetch image:", e);
      return null;
    }
  }

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
            <Button onPress={onTemplatePickerOpen} isIconOnly>
              <PiBlueprint size={20} />
            </Button>
            <TemplatePickerModal
              isOpen={isTemplatePickerOpen}
              onOpenChange={onTemplatePickerOpenChange}
              templates={templatesQuery.data}
              onSelect={(t: ItemData) => {
                setSelectedTemplate(t);
                if (t.extractor) {
                  onTemplatePickerClose();
                  onExtractorParamsOpen();
                } else {
                  applyTemplate(t);
                  onTemplatePickerClose();
                }
              }}
            />
            <ExtractorParamsModal
              isOpen={isExtractorParamsOpen}
              onOpenChange={onExtractorParamsOpenChange}
              params={selectedTemplate?.extractor?.params || []}
              onExtract={handleExtract}
              loading={isExtracting}
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

function resolvePlaceholders(str: string, data: any) {
  return str.replace(/\{([\w\.]+)\}/g, (match, path) => {
    const value = path
      .split(".")
      .reduce(
        (obj: any, key: string) => (obj as Record<string, unknown>)?.[key],
        data,
      );
    return value !== undefined ? String(value) : "";
  });
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
