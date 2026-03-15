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
import { ItemData, ItemBadge, ExtractorMapping } from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BiCheckDouble, BiRevision, BiTrash } from "react-icons/bi";
import { FaSave } from "react-icons/fa";
import TemplateExtractorSection from "@/components/forms/template/TemplateExtractorSection";
import TemplateHeaderSection from "@/components/forms/template/TemplateHeaderSection";

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
    mutationFn: (data: Partial<ItemData>) =>
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

  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onOpenChange: onDeleteModalOpenChange,
  } = useDisclosure();

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
        <Button color="danger" isIconOnly onPress={onDeleteModalOpen}>
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
      <TemplateExtractorSection />
      <TemplateHeaderSection />

      <ItemFormLayoutTitleBar
        layoutTabs={layoutTabs}
        setLayoutTabs={setLayoutTabs}
        activeTabIndex={activeTabIndex}
        setActiveTabIndex={setActiveTabIndex}
      />
      <ItemFormLayoutSection />

      <Modal
        isOpen={isDeleteModalOpen}
        onOpenChange={onDeleteModalOpenChange}
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Confirm Deletion
              </ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete the template{" "}
                  <strong>{template?.title}</strong>?
                </p>
                <p className="text-danger text-sm">
                  This action cannot be undone and will permanently remove this
                  template.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isLoading={deleteMutation.isPending}
                  onPress={() => {
                    deleteMutation.mutate();
                  }}
                >
                  Delete Template
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
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
