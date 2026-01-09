import { createWriteStream } from "fs";
import path from "path";
import internal from "stream";
import { pipeline } from "stream/promises";
import {
  thumbnailName,
  ThumbnailOptions,
} from "../../../utils/lib/fileHandling/thumbnailOptions";
import { $generateID } from "../lib/generateID";
import { $webpTransformer } from "../lib/webpTransformer";

interface Options {
  fileName?: string;
  pathDir?: string;
  prefix?: string;
  thumbnails?: ThumbnailOptions[];
  mimeType?: string;
}

/** Uploading A Streamed File */
export default function $handleFileUpload(
  fileStream: internal.Readable & { truncated?: boolean },
  pathDir: string,
  options?: Options
) {
  try {
    const fileExtension = options?.fileName
      ? path.extname(options?.fileName)
      : "";

    const consumersCount = 3 + (options?.thumbnails?.length || 0);
    fileStream.setMaxListeners(Math.max(20, consumersCount * 4));

    const generatedName = Date.now() + "_" + $generateID(15);
    const fileName =
      (options?.prefix ? options.prefix + "_" : "") +
      generatedName +
      fileExtension;

    const filePath = path.join(pathDir, fileName);

    const promises = [];
    // File Writing
    const writeOriginalFile = createWriteStream(filePath);
    promises.push(pipeline(fileStream, writeOriginalFile));

    const ignoreThumbnail = Boolean(options?.mimeType?.includes("image/gif"));
    if (options?.thumbnails)
      options.thumbnails.forEach((option) => {
        const thumbnailPath = path.join(
          pathDir,
          thumbnailName(fileName, option)
        );
        const thumbnailStream = createWriteStream(thumbnailPath);
        if (ignoreThumbnail) {
          //just use it as the thumbnail, we don't need to transform it
          promises.push(pipeline(fileStream, thumbnailStream));
        } else {
          promises.push(
            pipeline(
              fileStream,
              $webpTransformer(option.w, option.h),
              thumbnailStream
            )
          );
        }
      });

    return [fileName, promises] as [string, Promise<void>[]];
  } catch (error) {
    console.log("[Image Uploading] Error: ", error);
    throw new Error("Error uploading an image");
  }
}
