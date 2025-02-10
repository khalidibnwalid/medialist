import ImageViewerModal from "@/components/ui/modals/ImageViewerModal";
import { Image } from "@heroui/react";
import { ForwardedRef, forwardRef, useContext, useState } from "react";
import { twJoin } from "tailwind-merge";
import { itemPageContext } from "../ItemPageProvider";

interface Props {
    className?: string
}
const ItemPagePoster = forwardRef<HTMLImageElement, Props>(function ItemPagePoster(props: Props, ref) {
    const { item, imagePaths } = useContext(itemPageContext)
    const { posterSrc, originalPoster } = imagePaths

    const [isOpen, setIsOpen] = useState(false)
    const [imageIsLoaded, setImageIsLoaded] = useState(true);

    return imageIsLoaded && <>
        <Image
            ref={ref}
            className={twJoin("w-full shadow-xl object-cover duration-100 hover:scale-102.5 cursor-pointer", props.className)}
            alt={item.title}
            src={posterSrc}
            onClick={() => setIsOpen(true)}
            onError={() => setImageIsLoaded(false)}
        />
        {item.posterPath &&
            <ImageViewerModal
                imageSrc={originalPoster as string}
                isOpen={isOpen}
                setIsOpen={setIsOpen}
            />}
    </>
})

export default ItemPagePoster