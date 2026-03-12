import { SortableItemType } from "@/components/ui/layout/drag&drop/logic/SortableMultiContainersWrapper";
import counterGenerator from "@/utils/functions/counterGenerator";
import { TagData } from "@/utils/types/global";
import {
  ItemData,
  ItemField,
  ItemLayoutHeader,
  ExtractorConfig,
  ItemBadge,
  ExtractorMapping,
} from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import { MediaData } from "@/utils/types/media";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { UseFormReturn } from "react-hook-form";

interface Props extends Omit<
  ItemFormContext,
  | "setActiveTabFields"
  | "setActiveTabHeader"
  | "activeTabFields"
  | "activeTabHeader"
  | "isPreviewMode"
  | "setIsPreviewMode"
  | "media"
> {
  children: React.ReactNode;
  layoutTabs: ItemFormLayoutTab[];
  setLayoutTabs: Dispatch<SetStateAction<ItemFormLayoutTab[]>>;
  activeTabIndex: number;
  media?: MediaData[];
  isTemplate?: boolean;
}

interface ItemFormContext {
  tags: TagData[];
  list: ListData;
  item?: ItemData;
  media: MediaData[];
  itemForm: UseFormReturn<ItemFormData>;
  layoutTabs: ItemFormLayoutTab[];
  setLayoutTabs: Dispatch<SetStateAction<ItemFormLayoutTab[]>>;
  activeTabFields: ItemFormField[][];
  setActiveTabFields: Dispatch<SetStateAction<ItemFormField[][]>>;
  activeTabHeader: ItemLayoutHeader;
  setActiveTabHeader: Dispatch<SetStateAction<ItemLayoutHeader>>;
  isPreviewMode: boolean;
  setIsPreviewMode: Dispatch<SetStateAction<boolean>>;
  isTemplate?: boolean;
}

export type ItemFormMedia = Pick<MediaData, "keywords" | "title"> &
  (
    | { path: string; id: string; ref?: undefined } // an existing media
    | { path: File; id?: undefined; ref: string } // a new media
  );
// ref is kinda a temporary id for the new media
export type ItemFormField = SortableItemType & ItemField;
export type ItemFormLayoutTab = [ItemLayoutHeader, ...ItemFormField[][]];
export type ItemFormLogoField = ItemFormField & {
  id: number;
  logoPath: File | null;
};

export interface ItemFormData extends Omit<
  ItemData,
  "id" | "createdAt" | "updatedAt" | "coverPath" | "posterPath" | "userId"
> {
  cover: File | null | string;
  poster: File | null | string;
  media?: ItemFormMedia[];
  extractor?: ExtractorConfig;
}

export const ItemFormContext = createContext({} as ItemFormContext);

export default function ItemFormProvider({
  tags,
  list,
  item,
  media = [],
  itemForm,
  layoutTabs,
  setLayoutTabs,
  activeTabIndex,
  children,
  isTemplate,
}: Props) {
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // a facade for the activeLayoutTab
  const [activeTabHeader, ...activeTabFields] =
    layoutTabs?.[activeTabIndex] || [];

  type setActiveTabHeaderCallBack = (
    prev: ItemLayoutHeader,
  ) => ItemLayoutHeader;
  function setActiveTabHeader(
    value: ItemLayoutHeader | setActiveTabHeaderCallBack,
  ) {
    if (!layoutTabs?.[activeTabIndex]?.[0]) return;

    setLayoutTabs((prev) => {
      const newTabs = [...prev];
      const prevHeader = prev[activeTabIndex]?.[0];
      const fields = prev[activeTabIndex]?.slice(1) as ItemFormField[][];
      const newHeader = typeof value === "function" ? value(prevHeader) : value;

      newTabs[activeTabIndex] = [newHeader, ...fields];
      return newTabs;
    });
  }

  type setActiveTabCallBack = (prev: ItemFormField[][]) => ItemFormField[][];
  function setActiveTabFields(value: ItemFormField[][] | setActiveTabCallBack) {
    setLayoutTabs((prev) => {
      let newTabs = [...prev];
      const prevValues = prev[activeTabIndex]?.slice(1) as ItemFormField[][];
      const prevHeader = prev[activeTabIndex]?.[0] as ItemLayoutHeader;
      newTabs[activeTabIndex] = Array.isArray(value)
        ? [prevHeader, ...value]
        : [prevHeader, ...value(prevValues)];
      return newTabs;
    });
  }

  const initializedLayoutIdRef = useRef<string | null>(null);

  // Stabilizing and initializing form default values
  useEffect(() => {
    const currentId = item?.id || "new";
    if (initializedLayoutIdRef.current === currentId) return;
    initializedLayoutIdRef.current = currentId;

    const defaultTemplate = [
      [
        { type: "left_sidebar", label: "Main" },
        isTemplate ? [] : [{ id: "1", type: "tags" }],
        [],
      ],
    ];

    // 1. Stabilize Layout IDs
    let idGen = 100;
    const layout =
      item?.layout &&
      item?.layout.map((tab) =>
        tab.map((column, i) =>
          i !== 0
            ? (column as (ItemField & { id?: string })[]).map((field) => ({
                ...field,
                id: field.id || String(++idGen),
              }))
            : column,
        ),
      );
    const finalLayout = layout || defaultTemplate;

    // 2. Stabilize Badge IDs
    const stabilizedBadges = item?.header?.badges?.map((badge) => ({
      ...badge,
      id: (badge as ItemBadge & { id?: string }).id || String(++idGen),
    }));
    const finalHeader = item?.header
      ? { ...item.header, badges: stabilizedBadges }
      : undefined;

    // make Mappings ID-based
    let extractor = item?.extractor;
    if (isTemplate && extractor?.mappings) {
      const newMappings: Record<string, string | ExtractorMapping> = {};
      Object.entries(extractor.mappings).forEach(([target, source]) => {
        if (target.startsWith("layout.")) {
          const parts = target.split(".");
          const tabIdx = parseInt(parts[1]);
          const colIdx = parseInt(parts[2]);
          const fieldIdx = parseInt(parts[3]);
          const prop = parts[4]; // e.g., layout.0.1.2.title -> title

          const fields = finalLayout?.[tabIdx]?.slice(1) as ItemFormField[][];
          const field = fields?.[colIdx - 1]?.[fieldIdx];

          if (field?.id) {
            newMappings[`field:${field.id}${prop ? `:${prop}` : ""}`] = source;
          } else {
            newMappings[target] = source;
          }
        } else if (target.startsWith("header.badges.")) {
          const badgeIdx = parseInt(target.replace("header.badges.", ""));
          const badge = stabilizedBadges?.[badgeIdx];
          if (badge?.id) {
            newMappings[`badge:${badge.id}`] = source;
          } else {
            newMappings[target] = source;
          }
        } else {
          newMappings[target] = source;
        }
      });
      extractor = { ...extractor, mappings: newMappings };
    }

    // update parent state
    setLayoutTabs(finalLayout as ItemFormLayoutTab[]);

    // reset form
    const itemSrc = item
      ? `/api/file/${item.userId}/${item.listId}/${item.id}`
      : "";
    const cover = item?.coverPath ? `${itemSrc}/${item.coverPath}` : null;
    const poster = item?.posterPath ? `${itemSrc}/${item.posterPath}` : null;
    const garbageCollectedTags =
      !isTemplate && item?.tags
        ? item.tags.filter((tagId) => tags.some((t) => t.id === tagId))
        : [];

    itemForm.reset({
      ...item,
      title: item?.title || "",
      description: item?.description || "",
      header: finalHeader || { type: "poster_inside", badges: [] },
      extractor,
      cover,
      poster,
      tags: garbageCollectedTags,
      media: [],
    });
  }, [
    item?.id,
    item?.layout,
    item?.header,
    isTemplate,
    tags,
    itemForm,
    setLayoutTabs,
    item,
  ]);

  return (
    <ItemFormContext.Provider
      value={{
        tags,
        list,
        item,
        itemForm,
        layoutTabs,
        setLayoutTabs,
        activeTabFields,
        setActiveTabFields,
        activeTabHeader,
        setActiveTabHeader,
        isPreviewMode,
        setIsPreviewMode,
        media,
        isTemplate,
      }}
    >
      {children}
    </ItemFormContext.Provider>
  );
}

export const ItemFormCounterGen = counterGenerator(); // universal instance, 'cause we need to keep the numbers unique across the app
