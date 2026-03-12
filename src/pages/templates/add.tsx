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
import StatusSubmitButton from "@/components/ui/buttons/StatusSubmitButton";
import httpClient from "@/utils/lib/httpClient";
import { mutateTemplateCache } from "@/utils/lib/tanquery/templatesQuery";
import { errorToast, simpleToast } from "@/utils/toast";
import { ListData } from "@/utils/types/list";
import { ItemData, ItemBadge, ExtractorMapping } from "@/utils/types/item";
import { addToast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BiCheckDouble, BiRevision } from "react-icons/bi";
import { FaSave } from "react-icons/fa";
import TemplateExtractorSection from "@/components/forms/template/TemplateExtractorSection";
import TemplateHeaderSection from "@/components/forms/template/TemplateHeaderSection";

export default function AddTemplatePage() {
  const router = useRouter();

  const itemForm = useForm<ItemFormData>({
    shouldUnregister: false,
    defaultValues: {
      title: "",
      description: "",
      header: {
        type: "poster_beside",
      },
    },
  });
  const { handleSubmit } = itemForm;

  const mutation = useMutation({
    mutationFn: (data: Partial<ItemData>) =>
      httpClient().post(`templates`, data),
    onError: () =>
      addToast(errorToast("Try Again", () => handleSubmit(onSubmit)())),
    onSuccess: (template: ItemData) => {
      mutateTemplateCache(template, "add");
      addToast(simpleToast(`Template ${template.title} Created`));
      router.push(`/templates`);
    },
  });

  const [layoutTabs, setLayoutTabs] = useState<ItemFormLayoutTab[]>([
    [
      { type: "left_sidebar", label: "Main" },
      [], // No tags in template by default
      [],
    ],
  ]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  function onSubmit(data: ItemFormData) {
    const logoFieldsTypes = ["badge", "link"];

    const genKey = () => String(ItemFormCounterGen.next().value);
    let layout = layoutTabs.map((tab) =>
      tab.map((row, rowIndex) =>
        rowIndex === 0
          ? row //header
          : (row as ItemFormField[]).map((field) => {
              if (logoFieldsTypes.includes(field.type)) {
                return { ...field, logoPath: undefined, id: undefined };
              } else {
                return { ...field, id: undefined };
              }
            }),
      ),
    );

    const extractor = data.extractor ? { ...data.extractor } : undefined;
    if (extractor?.mappings) {
      const resolvedMappings: Record<string, string | ExtractorMapping> = {};
      Object.entries(extractor.mappings).forEach(([target, source]) => {
        if (target.startsWith("field:")) {
          const parts = target.split(":");
          const id = parts[1];
          const prop = parts[2];
          let resolved = target;

          layoutTabs.forEach((tab, tabIdx) => {
            (tab as ItemFormField[][]).forEach((col, colIdx) => {
              if (colIdx !== 0 && Array.isArray(col)) {
                col.forEach((field, fieldIdx) => {
                  if (field.id === id) {
                    resolved = `layout.${tabIdx}.${colIdx}.${fieldIdx}${prop ? `.${prop}` : ""}`;
                  }
                });
              }
            });
          });
          resolvedMappings[resolved] = source;
        } else if (target.startsWith("badge:")) {
          const id = target.replace("badge:", "");
          const badges = data.header.badges as (ItemBadge & { id?: string })[];
          const badgeIdx = badges?.findIndex((b) => b.id === id);

          if (badgeIdx !== -1 && badgeIdx !== undefined) {
            resolvedMappings[`header.badges.${badgeIdx}`] = source;
          } else {
            resolvedMappings[target] = source;
          }
        } else {
          resolvedMappings[target] = source;
        }
      });
      extractor.mappings = resolvedMappings;
    }

    const payload = {
      title: data.title,
      description: data.description,
      layout: layout,
      header: data.header,
      extractor,
    };

    mutation.mutate(payload as any);
  }

  const dummyList: ListData = {
    id: "template-list",
    userId: "user",
    title: "Template",
    configs: { titlePlacement: "title-below" },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const stableTags = useMemo(() => [], []);

  return (
    <ItemFormProvider
      tags={stableTags}
      list={dummyList}
      itemForm={itemForm}
      layoutTabs={layoutTabs}
      setLayoutTabs={setLayoutTabs}
      activeTabIndex={activeTabIndex}
      isTemplate
    >
      <Head>
        <title>MediaList - Add Template</title>
      </Head>
      <ItemFormHeaderTitleBar>
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
      <TemplateExtractorSection />
      <TemplateHeaderSection />

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
