import ImageViewerModal from "@/components/ui/modals/ImageViewerModal"
import { thumbnailName } from "@/utils/lib/fileHandling/thumbnailOptions"
import { ItemCardField } from "@/utils/types/item"
import { MediaData } from "@/utils/types/media"
import { Card, CardBody, CardFooter, Image } from "@heroui/react"
import { useContext, useMemo, useState } from "react"
import { itemPageContext } from "../../ItemPageProvider"

type Props = {
    field: ItemCardField,
    isEditing?: false,
} | {
    field: ItemCardField & { src: string },
    isEditing: true,
}

export default function ItemPageCardField({
    field,
    isEditing,
}: Props) {
    const { media: allMedia, imagePaths } = useContext(itemPageContext)
    const media = isEditing ? [] : allMedia

    const [isOpen, setIsOpen] = useState(false)
    const onOpen = () => setIsOpen(true)

    const image = useMemo(() => isEditing ? undefined : media.find(image => image.id === field.imageId), [media])

    const src = isEditing ? field.src : `${imagePaths.itemSrc}/${(image as MediaData)?.path}`
    const thumbnailSrc = isEditing ? field.src : `${imagePaths.itemSrc}/${thumbnailName((image as MediaData)?.path, {})}`
    const thumbnailSrc512 = isEditing ? field.src : `${imagePaths.itemSrc}/${thumbnailName((image as MediaData)?.path, { w: 512 })}`

    return (
        <>
            {field.variant === "banner"
                ? <BannerCard
                    thumbnail={thumbnailSrc}
                    title={field.title}
                    subText={field.subText}
                    onOpen={onOpen}
                />
                :
                <ProfileCard
                    thumbnail={thumbnailSrc512}
                    title={field.title}
                    subText={field.subText}
                    onOpen={onOpen}
                />
            }

            <ImageViewerModal
                imageSrc={src as string}
                isOpen={isOpen}
                setIsOpen={setIsOpen}
            />
        </>
    )
}

interface CardProps {
    thumbnail?: string,
    title?: string,
    subText?: string,
    onOpen: () => void,
}

function BannerCard({
    thumbnail,
    title,
    subText,
    onOpen,
}: CardProps) {
    const [imageIsLoaded, setImageIsLoaded] = useState(true)

    return (
        <Card className="w-full h-fit bg-default-100 px-2 pt-2">
            {imageIsLoaded &&
                <Image
                    className="w-full shadow-xl object-cover cursor-pointer hover:scale-101"
                    alt={title || thumbnail}
                    src={thumbnail}
                    onClick={onOpen}
                    onError={() => setImageIsLoaded(false)}
                />}
            <CardFooter className="flex flex-col">
                <h1 className="text-xl">{title}</h1>
                <p> {subText}</p>
            </CardFooter>
        </Card>
    )
}

function ProfileCard({
    thumbnail,
    title,
    subText,
    onOpen,
}: CardProps) {
    const [imageIsLoaded, setImageIsLoaded] = useState(true)

    return (
        <Card className="h-40">
            <CardBody className="absolute z-10 top-0 left-0 w-full h-full flex flex-row justify-between items-center gap-x-4 bg-pure-theme bg-opacity-40 backdrop-blur-md p-3">
                {imageIsLoaded &&
                    <Image
                        removeWrapper
                        className=" h-full aspect-square object-cover hover:scale-102.5 cursor-pointer"
                        alt={title || thumbnail}
                        src={thumbnail}
                        onClick={onOpen}
                        onError={() => setImageIsLoaded(false)}
                    />}
                <div className="flex-grow grid items-start gap-y-1">
                    <h1 className="text-pure-opposite/80 font-bold text-large">{title}</h1>
                    <p className="text-tiny text-pure-opposite/60 uppercase font-bold">{subText}</p>
                </div>
            </CardBody>
            <Image
                removeWrapper
                className="z-0 w-full h-full object-cover"
                alt={title || thumbnail}
                src={thumbnail}
            />
        </Card>
    )
}