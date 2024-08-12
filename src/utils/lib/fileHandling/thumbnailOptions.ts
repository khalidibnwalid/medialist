
export interface ThumbnailOptions {
    /** If not provided will be 'auto' */
    w?: number;
    /** If not provided will be 'auto' */
    h?: number;
    /** If both empty, It will just transform the image to webp */
}

export const thumbnailName = (fileName: string, thumbnailsOptions: ThumbnailOptions) => {
    const isOriginalSize = !thumbnailsOptions?.w && !thumbnailsOptions?.h;
    return isOriginalSize
        ? `${fileName}.webp`
        : `thumbnails/${fileName}_size=${thumbnailsOptions?.w || 'W'}x${thumbnailsOptions?.h || 'H'}.webp`
};

export const coverThumbnailsOptions: Record<string, ThumbnailOptions[]> = {
    listCover: [{ w: 300 }],
    itemPoster: [{ w: 300 }, { w: 700 }, {}],
    itemCover: [{ w: 300 }, { w: 700 }, {}],
    itemImage: [{ w: 300 }, { w: 700 }, {}],
    logoCover: [{ w: 50 }],
}
