import ItemFormHeaderSection from "@/components/forms/item/ItemFormHeaderSection";
import ItemFormHeaderTitleBar from "@/components/forms/item/ItemFormHeaderTitleBar";
import ItemFormLayoutSection from "@/components/forms/item/ItemFormLayoutSection";
import ItemFormProvider, {
  ItemFormCounterGen,
  ItemFormData,
  ItemFormField,
  ItemFormLayoutTab,
} from "@/components/forms/item/ItemFormProvider";
import ItemFormLayoutTitleBar from "@/components/forms/item/layoutTitleBar/ItemFormLayoutTitleBar";
import ErrorPage from "@/components/layouts/ErrorPage";
import ListsLoading from "@/components/layouts/loading/ListsLoading";
import StatusSubmitButton from "@/components/ui/buttons/StatusSubmitButton";
import { validateShortID } from "@/utils/lib/generateID";
import httpClient from "@/utils/lib/httpClient";
import {
  mutateTemplateCache,
  templateQueryOptions,
} from "@/utils/lib/tanquery/templatesQuery";
import { errorToast, simpleToast } from "@/utils/toast";
import { ItemData } from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import { addToast, Button } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BiCheckDouble, BiRevision, BiTrash } from "react-icons/bi";
import { FaSave } from "react-icons/fa";

const DUMMY_LIST: ListData = {
  id: "template-list",
  userId: "user",
  title: "Template",
  configs: { titlePlacement: "title-below" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function EditTemplatePage() {
  const router = useRouter();
  const templateId = router.query.id as string;
  const stableTags = useMemo(() => [], []); // Moved to top

  const itemForm = useForm<ItemFormData>({
    shouldUnregister: false,
    defaultValues: {
      header: {
        type: "poster_beside",
      },
    },
  });
  const { handleSubmit } = itemForm;

  const {
    data: template,
    isSuccess,
    isPending,
  } = useQuery(templateQueryOptions(templateId));

  const mutation = useMutation({
    mutationFn: (data: any) =>
      httpClient().put(`templates/${templateId}`, data),
    onError: () =>
      addToast(errorToast("Try Again", () => handleSubmit(onSubmit)())),
    onSuccess: (updatedTemplate: ItemData) => {
      mutateTemplateCache(updatedTemplate, "edit");
      addToast(simpleToast(`Template ${updatedTemplate.title} Updated`));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => httpClient().delete(`templates/${templateId}`),
    onSuccess: () => {
      mutateTemplateCache(template as ItemData, "delete");
      addToast(simpleToast(`Template Deleted`));
      router.push(`/templates`);
    },
  });

  const [layoutTabs, setLayoutTabs] = useState<ItemFormLayoutTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  function onSubmit(data: ItemFormData) {
    const logoFieldsTypes = ["badge", "link"];

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

  if (isPending) return <ListsLoading />;
  if (!isSuccess) return <ErrorPage message="Failed To Fetch The Template" />;

  return (
    <ItemFormProvider
      tags={stableTags}
      list={DUMMY_LIST}
      itemForm={itemForm}
      layoutTabs={layoutTabs}
      setLayoutTabs={setLayoutTabs}
      activeTabIndex={activeTabIndex}
      item={template}
      isTemplate
    >
      <Head>
        <title>MediaList - Edit Template</title>
      </Head>
      <ItemFormHeaderTitleBar>
        <Button
          color="danger"
          isIconOnly
          onPress={() => deleteMutation.mutate()}
        >
          <BiTrash className="text-xl" />
        </Button>
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

export default function EditTemplatePageHOC() {
  const router = useRouter();
  const templateId = router.query.id as string;
  return validateShortID(templateId) ? (
    <EditTemplatePage key={templateId} />
  ) : (
    <ErrorPage
      message="Bad Template ID, Page Doesn't Exist"
      MainMessage="404!"
      hideTryAgain
    />
  );
}
