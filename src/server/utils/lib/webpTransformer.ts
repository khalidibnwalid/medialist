import sharp from "sharp";

sharp.cache({
  memory: 50,
  items: 100,
  files: 20,
});

export const $webpTransformer = (w?: number, h?: number) =>
  sharp()
    .resize(w, h)
    .webp()
    .on("error", (error) => {
      throw new Error(`Failed to convert image: ${error}`);
    });
