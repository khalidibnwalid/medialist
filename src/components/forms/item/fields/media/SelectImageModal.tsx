import ImageInput from "@/components/ui/form/ImageUploader";
import { thumbnailName } from "@/utils/lib/fileHandling/thumbnailOptions";
import { ItemData } from "@/utils/types/item";
import {
  Card,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalContent,
} from "@heroui/react";
import { useContext, useMemo, useState } from "react";
import { BiSearch } from "react-icons/bi";
import {
  ItemFormContext,
  ItemFormCounterGen,
  ItemFormMedia,
} from "../../ItemFormProvider";

export default function SelectImageModal({
  isOpen,
  onOpenChange,
  set,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  set: (data: { imageId?: string }) => void;
}) {
  const { list, media, item, itemForm, isTemplate } =
    useContext(ItemFormContext);

  const newMedia = itemForm.watch("media") as ItemFormMedia[];
  const [searchValue, setSearchValue] = useState("");
  const filteredMedia = useMemo(() => {
    const images = [...(newMedia || []), ...media] as ItemFormMedia[];

    if (!searchValue) return images;
    const value = searchValue.trim().toLowerCase();

    return images.filter(
      (image) =>
        image?.title?.toLowerCase().includes(value) ||
        image?.keywords?.some(
          (key) => typeof key === "string" && key?.toLowerCase() === value,
        ),
    );
  }, [searchValue, media, newMedia]);

  const itemSrc =
    item && `/api/file/${list.userId}/${list.id}/${(item as ItemData).id}`;

  return (
    <Modal
      isOpen={isOpen}
      placement="center"
      onOpenChange={onOpenChange}
      size="4xl"
    >
      <ModalContent className="max-h-[80vh] overflow-y-auto">
        {(onClose) => (
          <ModalBody className="w-full p-3">
            <Input
              className="text-foreground shadow-none"
              placeholder="Search by title or keyword..."
              startContent={<BiSearch className="opacity-80" size={20} />}
              value={searchValue}
              onValueChange={setSearchValue}
              isDisabled={isTemplate}
            />
            <div className="w-full grid grid-cols-sm-card gap-2">
              {!isTemplate && <AddImage onClose={onClose} set={set} />}
              {filteredMedia.map((image, index) => (
                <Image
                  className="object-cover w-full aspect-square border-5 border-accented hover:scale-105 hover:border-primary cursor-pointer animate-fade-in"
                  key={index + "image-pick"}
                  alt={(image.id && image?.path) || "image"}
                  src={
                    image.id !== undefined
                      ? `${itemSrc}/${thumbnailName(image.path, { w: 300 })}`
                      : URL.createObjectURL(image.path)
                  }
                  onClick={() => {
                    set({ imageId: image?.id || image.ref });
                    onClose();
                  }}
                />
              ))}
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}

function AddImage({
  onClose,
  set,
}: {
  onClose: () => void;
  set: (data: { imageId?: string }) => void;
}) {
  const { itemForm } = useContext(ItemFormContext);

  function onChange(image: File | null) {
    if (!image) return;
    const newImage = {
      path: image,
      ref: String(ItemFormCounterGen.next().value),
      title: "",
      keywords: [],
    };

    const getMedia = itemForm.getValues("media") as ItemFormMedia[];
    itemForm.setValue("media", [newImage, ...(getMedia || [])]);
    set({ imageId: newImage.ref });
    onClose();
  }

  return (
    <Card className="object-cover w-full aspect-square border-5 border-accented hover:scale-105 hover:border-primary cursor-pointer animate-fade-in">
      <ImageInput className="w-full aspect-square" onChange={onChange} />
    </Card>
  );
}
