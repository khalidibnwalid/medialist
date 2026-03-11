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
import { ItemData } from "@/utils/types/item";
import { addToast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BiCheckDouble, BiRevision } from "react-icons/bi";
import { FaSave } from "react-icons/fa";

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
    mutationFn: (data: any) => httpClient().post(`templates`, data),
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

    const payload = {
      title: data.title,
      description: data.description,
      layout: layout,
      header: data.header,
    };

    mutation.mutate(payload);
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
