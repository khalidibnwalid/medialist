import {
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  useDisclosure,
} from "@heroui/react";
import { useMemo, useState } from "react";
import { BiSearch } from "react-icons/bi";
import { PiBlueprint } from "react-icons/pi";
import { ItemData } from "@/utils/types/item";

export default function TemplatePickerModal({
  isOpen,
  onOpenChange,
  templates,
  onSelect,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ItemData[];
  onSelect: (template: ItemData) => void;
}) {
  const [searchValue, setSearchValue] = useState("");

  const filtered = useMemo(() => {
    return (templates || []).filter((t) =>
      t.title.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [templates, searchValue]);

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
              placeholder="Search templates..."
              startContent={<BiSearch className="opacity-80" size={20} />}
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <div className="w-full grid grid-cols-sm-card gap-2">
              {filtered.map((t) => (
                <Card
                  key={t.id}
                  isPressable
                  className="aspect-square border-5 border-accented hover:scale-105 hover:border-primary cursor-pointer animate-fade-in bg-accented overflow-hidden group"
                  onPress={() => {
                    onSelect(t);
                    onClose();
                  }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center relative p-2">
                    <PiBlueprint className="text-6xl font-light opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="absolute inset-x-0 bottom-0 p-2 flex flex-col items-center">
                      <span className="text-xs font-bold truncate w-full text-center text-foreground">
                        {t.title}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}
