
export interface ThumbnailOptions {
    /** If not provided will be 'auto' */
    w?: number;
    /** If not provided will be 'auto' */
    h?: number;
    /** If both empty, It will just transform the image to webp */
}

export const thumbnailName = (fileName: string, thumbnailsOptions: ThumbnailOptions, disablePrefix?: boolean) => {
    const isOriginalSize = !thumbnailsOptions?.w && !thumbnailsOptions?.h;
    const thumbnail = isOriginalSize
        ? `${fileName}.webp`
        : `${fileName}_size=${thumbnailsOptions?.w || 'W'}x${thumbnailsOptions?.h || 'H'}.webp`
    return disablePrefix ? thumbnail : `thumbnails/${thumbnail}`;
};

export const THUMBNAILS_OPTIONS = {
    LIST_COVER: [{ w: 300 }],
    ITEM_POSTER: [{ w: 300 }, { w: 640 }, { w: 720 }, {}],
    ITEM_COVER: [{ w: 300 }, {}], // {}, { w: 300} for blurred
    ITEM_MEDIA: [{ w: 300 }, { w: 512 }, { w: 720 }, {}],
    LOGO: [{ w: 50 }],
}

/**
 * Folder Structure
 * users/ userId / listId /
 *                        / list's cover & logos
 *                        / thumbnails / ...
 *                        / itemId / item's poster, cover, logos and media
 *                        / itemId / thumbnails / ...
 */