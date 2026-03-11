import { SortableItemType } from "@/components/ui/layout/drag&drop/logic/SortableMultiContainersWrapper";
import counterGenerator from "@/utils/functions/counterGenerator";
import { TagData } from "@/utils/types/global";
import { ItemData, ItemField, ItemLayoutHeader } from "@/utils/types/item";
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
      let newTabs = [...prev];
      const prevHeader = prev[activeTabIndex]?.[0] as ItemLayoutHeader;
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

  // initializing form default values
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

    // adding ids to the fields
    let idGen = 1;
    const layout =
      item?.layout &&
      item?.layout.map((tab) =>
        tab.map(
          (column, i) =>
            i !== 0
              ? (column as ItemField[]).map((field) => ({
                  ...field,
                  id: String(++idGen),
                }))
              : column, // header
        ),
      );

    setLayoutTabs(layout || (defaultTemplate as any));
  }, [item?.id, item?.layout, isTemplate, setLayoutTabs]);

  // Reset form when item actually arrives or changes
  useEffect(() => {
    if (!item) return;

    const {
      coverPath,
      posterPath,
      layout: itemLayout,
      tags: itemTags,
      ...itemData
    } = item;
    const itemSrc = `/api/file/${item.userId}/${item.listId}/${item.id}`;

    const cover = coverPath ? `${itemSrc}/${coverPath}` : null;
    const poster = posterPath ? `${itemSrc}/${posterPath}` : null;

    const garbageCollectedTags = !isTemplate
      ? itemTags.filter((tagId) => tags.some((t) => t.id === tagId))
      : [];

    itemForm.reset({
      ...itemData,
      title: item.title,
      description: item.description || "",
      header: item.header,
      cover,
      poster,
      tags: garbageCollectedTags,
      media: [],
    });
  }, [item, isTemplate, itemForm, tags]);

  return (
    <ItemFormContext.Provider
      value={{
        tags,
        list,
        item,
        itemForm,
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
