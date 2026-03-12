import { TagData, UserData } from "./global"
import { ListData } from "./list"
import { MediaData } from "./media"

export interface ItemData {
    id: string
    userId: UserData['id']
    listId: ListData['id']
    title: string
    posterPath?: string
    coverPath?: string
    description?: string
    fav: boolean
    trash: boolean
    tags: TagData['id'][]
    layout: ItemLayoutTab[]
    header: ItemHeader
    extractor?: ExtractorConfig
    createdAt: Date
    updatedAt: Date
    // badges?: itemBadgesType[]
}

// # Item Header:
export interface ItemHeader {
    type: "poster_inside" | "poster_beside"
    badges: ItemBadge[]
}

// ## Header Fields:
export interface ItemBadge extends LogoField { type: "badge" }

// # Item Layout:
export type ItemLayoutTab = [ItemLayoutHeader, ...ItemLayout]

// ## Layout Fields:
export type ItemLayoutHeader = {
    type: "one_row" | "left_sidebar" | "right_sidebar" | "two_rows" | "three_rows"
    label: string
}

/** ### [row] [column]  */
export type ItemLayout = ItemField[][]

export type ItemField = ItemLabelTextField | ItemLinkField | ItemTextField | ItemCardField | ItemTagsField | ItemRatingField | GalleryField | ItemImageField
export type ItemFieldType = Extract<ItemField, { type: string }>['type'];

export interface ItemTagsField { type: "tags" }

export interface LogoField { label: string, logoPath?: string }
export interface GalleryField { type: "gallery", filter?: GalleryFieldFilter }
export interface GalleryFieldFilter { keywords?: string[] }
export interface ItemImageField { type: 'image', imageId: MediaData['id'] }
export interface ItemCardField {
    type: "card",
    imageId: string,
    title?: string,
    subText?: string,
    variant: "banner" | "profile"
}

export interface ItemTextField { type: "text", variant: "long" | "short", text: string, }
export interface ItemLabelTextField { type: "labelText", label: string, body: string, countable?: boolean }
export interface ItemLinkField extends LogoField { type: "link", url: string }
export interface ItemRatingField { type: "rating", rating: number, from: number }

export interface ExtractorMapping {
    path: string
    prefix?: string
    suffix?: string
}

export interface ExtractorConfig {
    link: string
    type: "REST"
    method: "GET" | "POST"
    params: ExtractorParam[]
    mappings: Record<string, string | ExtractorMapping> // targetFieldPath -> responseJSONPath or MappingConfig
}

export interface ExtractorParam {
    key: string
    location: "query" | "body"
    value?: string // used during extraction flow, not stored in template config
}

/** Item Patch & POST response */
export interface ItemSaveResponse {
    item: ItemData
    newTags: TagData[]
    newMedia: MediaData[]
}
