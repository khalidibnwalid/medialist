import {
  ItemFormContext,
  ItemFormField,
} from "@/components/forms/item/ItemFormProvider";
import { ItemBadge, ExtractorConfig } from "@/utils/types/item";
import {
  Button,
  Input,
  Select,
  SelectItem,
  Accordion,
  AccordionItem,
  Tooltip,
} from "@heroui/react";
import { useContext, useState, useEffect } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { BiPlus, BiTrash, BiTargetLock, BiInfoCircle } from "react-icons/bi";
import MappingModal from "./MappingModal";
import UrlHighlightInput from "./UrlHighlightInput";

export default function TemplateExtractorSection() {
  const { itemForm, layoutTabs } = useContext(ItemFormContext);
  const { control, register, watch } = itemForm;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "extractor.params" as "extractor.params",
  });

  const [showMappingModal, setShowMappingModal] = useState(false);
  const extractor = watch("extractor") as ExtractorConfig | undefined;
  const link = useWatch({
    control,
    name: "extractor.link",
  });

  // Dynamic Parameter Sync with Debounce
  useEffect(() => {
    if (!link) return;

    const timeout = setTimeout(() => {
      // Extract placeholders: {any_key}
      const placeholders = Array.from(
        link.matchAll(/\{([a-zA-Z0-9_-]+)\}/g),
      ).map((m) => m[1]);
      if (placeholders.length === 0) return;

      const currentParams = itemForm.getValues("extractor.params") || [];
      placeholders.forEach((key) => {
        const exists = currentParams.some((p) => p.key === key);
        if (!exists) {
          append({ key, location: "query" });
        }
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [link, append, itemForm]);

  return (
    <>
      <Accordion
        selectionMode="multiple"
        defaultExpandedKeys={extractor?.link ? ["extractor"] : []}
        variant="splitted"
        className="px-0 my-4"
        itemClasses={{
          base: "bg-foreground/5 dark:bg-foreground/5 shadow-none border border-foreground/5 rounded-xl overflow-hidden",
          title: "text-sm font-bold uppercase opacity-60",
          trigger: "py-4",
          content: "pt-0 pb-6 px-4",
        }}
      >
        <AccordionItem
          key="extractor"
          aria-label="API Extractor"
          title={
            <div className="flex items-center justify-between w-full pr-4">
              <span>API Extractor</span>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMappingModal(true);
                }}
                startContent={<BiTargetLock />}
                className="font-bold ml-auto"
              >
                Mapping Helper
              </Button>
            </div>
          }
        >
          <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3">
                <UrlHighlightInput
                  {...register("extractor.link" as any)}
                  label={
                    <div className="flex items-center gap-1.5">
                      <span>API Endpoint URL</span>
                      <Tooltip
                        content={
                          <div className="px-1 py-2 max-w-[280px]">
                            <p className="text-xs font-bold mb-1.5 flex items-center gap-1">
                              <BiInfoCircle className="text-primary" />
                              Inline Parameters
                            </p>
                            <p className="text-[11px] opacity-80 leading-relaxed">
                              You can insert dynamic parameters directly into
                              your URL using curly braces.
                            </p>
                            <div className="mt-2.5 p-2 bg-foreground/10 rounded-lg border border-foreground/10 text-[10px] font-mono whitespace-nowrap overflow-hidden">
                              <span className="opacity-40">example.com/</span>
                              <span className="bg-primary/30 py-0.5 px-1 rounded-sm shadow-[0_0_0_1px_rgba(var(--heroui-primary-rgb),0.3)]">
                                {"{id}"}
                              </span>
                              <span className="opacity-40">/info</span>
                            </div>
                          </div>
                        }
                        showArrow
                        placement="top-start"
                      >
                        <button
                          type="button"
                          className="opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <BiInfoCircle size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  }
                  labelPlacement="outside"
                  placeholder="https://api.example.com/data"
                  variant="bordered"
                  value={link}
                  classNames={{
                    label: "text-foreground/80 font-bold mb-1",
                    inputWrapper: "bg-background/20 border-foreground/10 h-10",
                  }}
                />
              </div>
              <Select
                {...register("extractor.method" as any)}
                label="Method"
                labelPlacement="outside"
                variant="bordered"
                defaultSelectedKeys={["GET"]}
                classNames={{
                  label: "text-foreground/80 font-bold mb-1",
                  trigger: "bg-background/20 border-foreground/10 h-10",
                }}
              >
                <SelectItem key="GET">GET</SelectItem>
                <SelectItem key="POST">POST</SelectItem>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase opacity-50">
                  Parameters
                </span>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => append({ key: "", location: "query" })}
                  startContent={<BiPlus />}
                  className="font-bold h-8"
                >
                  Add Parameter
                </Button>
              </div>

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Input
                        {...register(`extractor.params.${index}.key` as any)}
                        placeholder="Key"
                        size="sm"
                        variant="bordered"
                        classNames={{
                          inputWrapper:
                            "bg-background/20 border-foreground/10 h-9",
                        }}
                      />
                    </div>
                    <div className="w-32">
                      <Select
                        {...register(
                          `extractor.params.${index}.location` as any,
                        )}
                        size="sm"
                        variant="bordered"
                        defaultSelectedKeys={["query"]}
                        classNames={{
                          trigger:
                            "bg-background/20 border-foreground/10 h-9 min-h-0",
                        }}
                      >
                        <SelectItem key="query">Query</SelectItem>
                        <SelectItem key="body">Body</SelectItem>
                      </Select>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      color="danger"
                      variant="flat"
                      onPress={() => remove(index)}
                      className="h-9 w-9 min-w-0"
                    >
                      <BiTrash />
                    </Button>
                  </div>
                ))}
                {fields.length === 0 && (
                  <div className="text-center py-4 border border-dashed border-foreground/10 rounded-xl opacity-30 italic text-xs">
                    No parameters defined
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-background/40 rounded-xl border border-foreground/5">
              <span className="text-xs font-bold uppercase opacity-50 block mb-3">
                Current Mappings
              </span>
              {extractor?.mappings &&
              Object.keys(extractor.mappings).length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(extractor.mappings).map(
                    ([target, source]) => {
                      let displayTarget = target;
                      if (target.startsWith("field:")) {
                        const parts = target.split(":");
                        const id = parts[1];
                        const prop = parts[2];

                        layoutTabs?.forEach((tab, tabIdx) => {
                          (tab as ItemFormField[][]).forEach((col, colIdx) => {
                            if (colIdx !== 0 && Array.isArray(col)) {
                              col.forEach((field, fieldIdx) => {
                                if (field.id === id) {
                                  displayTarget = `layout.${tabIdx}.${colIdx}.${fieldIdx}${prop ? `.${prop}` : ""}`;
                                }
                              });
                            }
                          });
                        });
                      } else if (target.startsWith("badge:")) {
                        const id = target.replace("badge:", "");
                        const badges = itemForm.getValues(
                          "header.badges",
                        ) as (ItemBadge & { id?: string })[];
                        const badgeIdx = badges?.findIndex((b) => b.id === id);
                        if (badgeIdx !== -1 && badgeIdx !== undefined) {
                          displayTarget = `header.badges.${badgeIdx}`;
                        }
                      }

                      return (
                        <div
                          key={target}
                          className="text-xs flex items-center justify-between bg-foreground/5 p-2 rounded border border-foreground/5"
                        >
                          <span className="font-mono text-primary font-bold">
                            {displayTarget}
                          </span>
                          <span className="opacity-40">←</span>
                          <span className="font-mono opacity-80 truncate flex-1 text-right">
                            {(() => {
                              const p =
                                typeof source === "string"
                                  ? source
                                  : source.path;
                              return Array.isArray(p) ? p.join(", ") : p;
                            })()}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <span className="text-xs opacity-50 italic">
                  No mappings defined yet. Use the Mapping Helper.
                </span>
              )}
            </div>
          </div>
        </AccordionItem>
      </Accordion>

      <MappingModal
        isOpen={showMappingModal}
        onOpenChange={setShowMappingModal}
        apiUrl={extractor?.link || ""}
        method={extractor?.method || "GET"}
        params={extractor?.params || []}
      />
    </>
  );
}
