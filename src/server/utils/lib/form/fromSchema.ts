import { THUMBNAILS_OPTIONS } from "@/utils/lib/fileHandling/thumbnailOptions";
import { ProcessFormDataBuilder } from "./parseFormData";

const $LIST_FORM_SCHEMA = (dir: string) => ({
  title: 'String',
  configs: 'JSON',
  trash: "Boolean",
  coverPath: {
    dir,
    thumbnailOptions: THUMBNAILS_OPTIONS.LIST_COVER,
    aliases: ['cover']
  }
}) as ProcessFormDataBuilder

const $ITEM_FORM_SCHEMA = (dir: string) => ({
  title: 'String',
  description: 'String',
  header: 'JSON',
  tags: 'JSON',
  layout: "JSON",
  media: "JSON",
  extractor: "JSON",
  trash: "Boolean",
  fav: "Boolean",
  posterPath: {
    dir,
    thumbnailOptions: THUMBNAILS_OPTIONS.ITEM_POSTER,
    aliases: ['poster']
  },
  coverPath: {
    dir,
    thumbnailOptions: THUMBNAILS_OPTIONS.ITEM_COVER,
    aliases: ['cover']
  },
  logoPaths: {
    dir,
    thumbnailOptions: THUMBNAILS_OPTIONS.LOGO,
    attachTo: 'layout'
  },
  mediaImages: {
    dir,
    thumbnailOptions: THUMBNAILS_OPTIONS.ITEM_MEDIA,
    attachTo: 'media'
  }
}) as ProcessFormDataBuilder

const $ITEM_MEDIA_FORM_SCHEMA = (dir: string) => ({
  title: 'String',
  keywords: 'JSON',
  path: {
    dir,
    thumbnailOptions: THUMBNAILS_OPTIONS.ITEM_MEDIA,
  }
}) as ProcessFormDataBuilder

export {
  $ITEM_FORM_SCHEMA,
  $LIST_FORM_SCHEMA,
  $ITEM_MEDIA_FORM_SCHEMA
};

