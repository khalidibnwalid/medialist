import {
  ItemFormContext,
  ItemFormField,
} from "@/components/forms/item/ItemFormProvider";
import { ItemBadge, ExtractorMapping } from "@/utils/types/item";
import {
  Accordion,
  AccordionItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { useContext, useMemo, useState } from "react";
import { BiPlay, BiTargetLock } from "react-icons/bi";

interface MappingTarget {
  key: string;
  label: string;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  apiUrl: string;
  method: "GET" | "POST";
  params: { key: string; location: "query" | "body" }[];
}

export default function MappingModal({
  isOpen,
  onOpenChange,
  apiUrl,
  method,
  params,
}: Props) {
  const { itemForm, layoutTabs } = useContext(ItemFormContext);
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [targetField, setTargetField] = useState<string | null>(null);
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");

  async function fetchTest() {
    if (!apiUrl) return;
    setLoading(true);
    try {
      let processedUrl = apiUrl;
      const usedInUrl = new Set<string>();

      params.forEach((p) => {
        const placeholder = `{${p.key}}`;
        if (processedUrl.includes(placeholder)) {
          processedUrl = processedUrl.replaceAll(
            placeholder,
            testParams[p.key] || "",
          );
          usedInUrl.add(p.key);
        }
      });

      const url = new URL(processedUrl);
      let body: any = null;

      params.forEach((p) => {
        if (usedInUrl.has(p.key)) return;
        const val = testParams[p.key] || "";
        if (p.location === "query" && p.key) {
          url.searchParams.append(p.key, val);
        } else if (p.location === "body" && p.key) {
          if (!body) body = {};
          body[p.key] = val;
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
      const json = await res.json();
      setResponse(json);
    } catch (e) {
      console.error(e);
      setResponse({ error: "Failed to fetch. Check CORS or URL." });
    } finally {
      setLoading(false);
    }
  }

  const availableTargets = useMemo(() => {
    const targets: MappingTarget[] = [
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
      { key: "poster", label: "Poster URL" },
      { key: "cover", label: "Cover URL" },
    ];

    // Add header badges
    const badges = itemForm.getValues("header.badges") as (ItemBadge & {
      id?: string;
    })[];
    badges?.forEach((badge) => {
      if (badge.id) {
        targets.push({
          key: `badge:${badge.id}`,
          label: `[Header] Badge: ${badge.label || "Unnamed"}`,
        });
      }
    });

    // Add layout components
    layoutTabs?.forEach((tab, tabIndex) => {
      tab.forEach((column, colIndex) => {
        if (colIndex !== 0) {
          (column as ItemFormField[]).forEach((field) => {
            const labelPrefix = `[Layout T${tabIndex + 1} C${colIndex}]`;

            if (field.type === "text") {
              targets.push({
                key: `field:${field.id}:text`,
                label: `${labelPrefix} Text: ${field.text || field.id}`,
              });
            } else if (field.type === "labelText") {
              targets.push({
                key: `field:${field.id}:body`,
                label: `${labelPrefix} LabelText: ${field.label} (Value)`,
              });
            } else if (field.type === "link") {
              targets.push({
                key: `field:${field.id}:url`,
                label: `${labelPrefix} Link: ${field.label} (URL)`,
              });
            } else if (field.type === "rating") {
              targets.push({
                key: `field:${field.id}:rating`,
                label: `${labelPrefix} Rating`,
              });
            } else if (field.type === "card") {
              const cardLabel = field.title || field.id;
              targets.push({
                key: `field:${field.id}:title`,
                label: `${labelPrefix} Card: ${cardLabel} (Title)`,
              });
              targets.push({
                key: `field:${field.id}:subText`,
                label: `${labelPrefix} Card: ${cardLabel} (Subtext)`,
              });
            }
          });
        }
      });
    });

    return targets;
  }, [itemForm, layoutTabs]);

  const supportsTransformations = useMemo(() => {
    if (!targetField) return false;
    return (
      targetField === "poster" ||
      targetField === "cover" ||
      targetField.endsWith(":url")
    );
  }, [targetField]);

  function applyMapping() {
    if (selectedPath && targetField) {
      const currentMappings = itemForm.getValues("extractor.mappings") || {};

      let mappingValue: string | ExtractorMapping = selectedPath;
      if (prefix || suffix) {
        mappingValue = {
          path: selectedPath,
          prefix: prefix || undefined,
          suffix: suffix || undefined,
        };
      }

      itemForm.setValue("extractor.mappings", {
        ...currentMappings,
        [targetField]: mappingValue,
      });

      setSelectedPath(null);
      setTargetField(null);
      setPrefix("");
      setSuffix("");
    }
  }

  const isProperUrl = (val: unknown) =>
    typeof val === "string" &&
    (val.startsWith("http://") || val.startsWith("https://"));

  const selectedValue = useMemo(() => {
    if (!response || !selectedPath) return null;
    return selectedPath
      .split(".")
      .reduce((obj: any, key) => obj?.[key], response);
  }, [response, selectedPath]);

  const showUrlWarning = useMemo(() => {
    if (!supportsTransformations || !selectedPath || !response) return false;
    return !isProperUrl(selectedValue) && !prefix;
  }, [supportsTransformations, selectedPath, response, selectedValue, prefix]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
    >
      <ModalContent className="max-h-[90vh]">
        {(onClose) => (
          <>
            <ModalHeader>Mapping Helper</ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-2 gap-6 h-full min-h-[500px] pb-4">
                <div className="col-span-1 border border-foreground/10 rounded-xl p-4 overflow-auto bg-background/20 flex flex-col">
                  <span className="text-xs font-bold uppercase opacity-50 block mb-3">
                    Response JSON
                  </span>
                  <div className="flex-1">
                    {response ? (
                      <JsonExplorer
                        data={response}
                        onSelect={setSelectedPath}
                        selectedPath={selectedPath}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-30 italic text-center text-sm px-6">
                        Configure parameters and click fetch <br /> to see API
                        response
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-1 space-y-4 overflow-y-auto pr-1">
                  <Accordion
                    selectionMode="multiple"
                    defaultExpandedKeys={["params", "mapping"]}
                    variant="splitted"
                    className="px-0"
                    itemClasses={{
                      base: "bg-foreground/5 dark:bg-foreground/5 shadow-none border border-foreground/5",
                      title: "text-xs font-bold uppercase opacity-60",
                      content: "pt-0 pb-4",
                    }}
                  >
                    <AccordionItem
                      key="params"
                      aria-label="Parameters"
                      title={
                        <div className="flex items-center justify-between w-full pr-4">
                          <span>Parameters</span>
                          <Button
                            onPress={fetchTest}
                            isLoading={loading}
                            color="primary"
                            variant="solid"
                            size="sm"
                            startContent={<BiPlay className="text-lg" />}
                            className="font-bold h-8 px-4 ml-auto"
                          >
                            Fetch
                          </Button>
                        </div>
                      }
                    >
                      <div className="flex flex-col gap-4 pt-4">
                        {params.length > 0 ? (
                          params.map((p) => (
                            <Input
                              key={p.key}
                              label={p.key}
                              labelPlacement="outside-left"
                              size="sm"
                              variant="bordered"
                              placeholder={`Value for ${p.key}`}
                              value={testParams[p.key] || ""}
                              onValueChange={(val: string) =>
                                setTestParams((prev) => ({
                                  ...prev,
                                  [p.key]: val,
                                }))
                              }
                              classNames={{
                                label:
                                  "text-foreground/80 font-bold w-20 shrink-0",
                                inputWrapper:
                                  "bg-foreground/5 border-foreground/10 h-10",
                                mainWrapper: "flex-1",
                              }}
                            />
                          ))
                        ) : (
                          <span className="text-xs opacity-40 italic">
                            No parameters defined for this API.
                          </span>
                        )}
                        <p className="text-[10px] opacity-40 italic mt-2 line-clamp-1 break-all px-1">
                          {apiUrl || "No URL defined"}
                        </p>
                      </div>
                    </AccordionItem>
                    <AccordionItem
                      key="mapping"
                      aria-label="Create Mapping"
                      title="Create Mapping"
                    >
                      <div className="space-y-4 pt-4">
                        <div>
                          <span className="text-xs opacity-60 font-semibold mb-2 block">
                            Source (from JSON):
                          </span>
                          <div className="font-mono text-xs p-3 bg-background/40 rounded border border-foreground/5 truncate min-h-[42px] flex items-center text-primary/90">
                            {selectedPath || (
                              <span className="opacity-30 italic">
                                Select a field in the JSON explorer
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs opacity-60 font-semibold mb-2 block">
                            Target Field:
                          </span>
                          <Select
                            placeholder="Pick a target field"
                            size="md"
                            variant="bordered"
                            selectedKeys={targetField ? [targetField] : []}
                            onSelectionChange={(keys) => {
                              const newTarget = Array.from(keys)[0] as string;
                              setTargetField(newTarget);

                              // Reset transformations if not supported by new target
                              const isUrlTarget =
                                newTarget === "poster" ||
                                newTarget === "cover" ||
                                newTarget.endsWith(":url");
                              if (!isUrlTarget) {
                                setPrefix("");
                                setSuffix("");
                              }
                            }}
                            className="w-full"
                          >
                            {availableTargets.map((t) => (
                              <SelectItem key={t.key}>{t.label}</SelectItem>
                            ))}
                          </Select>
                        </div>

                        {supportsTransformations && (
                          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                            <Input
                              label="Prefix"
                              placeholder="e.g. https://image.example.com/t/p/w500"
                              size="sm"
                              variant="bordered"
                              value={prefix}
                              onValueChange={setPrefix}
                            />
                            <Input
                              label="Suffix"
                              placeholder="e.g. .jpg"
                              size="sm"
                              variant="bordered"
                              value={suffix}
                              onValueChange={setSuffix}
                            />
                          </div>
                        )}

                        {showUrlWarning && (
                          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-[11px] text-warning-600 animate-in zoom-in-95">
                            <p className="font-bold mb-1">
                              ⚠️ Incomplete URL Detected
                            </p>
                            <p className="opacity-80">
                              The selected value{" "}
                              <span className="font-mono bg-warning/20 px-1 rounded">
                                {String(selectedValue)}
                              </span>{" "}
                              doesn&apos;t look like a full URL. You should
                              probably add a prefix.
                            </p>
                          </div>
                        )}

                        <Button
                          className="w-full font-bold h-11"
                          color="primary"
                          size="lg"
                          variant="flat"
                          isDisabled={!selectedPath || !targetField}
                          onPress={applyMapping}
                          startContent={<BiTargetLock className="text-xl" />}
                        >
                          Add Mapping
                        </Button>
                      </div>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

interface JsonExplorerProps {
  data: unknown;
  path?: string;
  onSelect: (path: string) => void;
  selectedPath: string | null;
}

function JsonExplorer({
  data,
  path = "",
  onSelect,
  selectedPath,
}: JsonExplorerProps) {
  if (typeof data !== "object" || data === null) {
    return (
      <div
        className={`cursor-pointer hover:bg-primary/20 p-1 rounded text-xs truncate ${selectedPath === path ? "bg-primary/40" : ""}`}
        onClick={() => onSelect(path)}
      >
        <span className="opacity-50">{JSON.stringify(data)}</span>
      </div>
    );
  }

  return (
    <div className="pl-2 border-l border-foreground/5 ml-1">
      {Object.entries(data as Record<string, unknown>).map(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        const isObject = typeof value === "object" && value !== null;

        return (
          <div key={key} className="mb-1">
            <div
              className={`flex items-center gap-1 cursor-pointer hover:bg-foreground/10 rounded p-0.5 group ${selectedPath === currentPath ? "bg-primary/20" : ""}`}
              onClick={() => (!isObject ? onSelect(currentPath) : null)}
            >
              <span className="text-xs font-semibold text-primary/80">
                {key}:
              </span>
              {!isObject ? (
                <span className="text-xs truncate opacity-70 italic">
                  {JSON.stringify(value)}
                </span>
              ) : (
                <span className="text-[10px] opacity-30">
                  {Array.isArray(value) ? `[${value.length}]` : "{...}"}
                </span>
              )}
            </div>
            {isObject && (
              <JsonExplorer
                data={value}
                path={currentPath}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
