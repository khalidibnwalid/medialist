import TrashPopoverButton from "@/components/ui/buttons/TrashPopoverButton";
import {
  Button,
  ButtonProps,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Tab,
  Tabs,
  useDisclosure,
} from "@heroui/react";
import { Dispatch, SetStateAction, useContext, useState } from "react";
import { BiPencil, BiTrashAlt } from "react-icons/bi";
import { ItemFormContext, ItemFormLayoutTab } from "../ItemFormProvider";

export default function ItemFormLayoutTabs({
  layoutTabs,
  setLayoutTabs,
  activeTabIndex,
  setActiveTabIndex,
}: {
  layoutTabs: ItemFormLayoutTab[];
  setLayoutTabs: Dispatch<SetStateAction<ItemFormLayoutTab[]>>;
  activeTabIndex: number;
  setActiveTabIndex: Dispatch<SetStateAction<number>>;
}) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isTemplate } = useContext(ItemFormContext);
  const [editIndex, setEditIndex] = useState(0);

  function deleteTab(index: number) {
    if (layoutTabs.length === 1) return;

    const [header, ...fields] = layoutTabs[index];
    //the tags field should remain, so we move it to the first tab,
    if (!isTemplate && fields.flat().some((field) => field.type === "tags"))
      setLayoutTabs((prev) => {
        let newArray = [...prev];
        newArray[index === 0 ? 1 : 0][1].push({
          id: Date.now().toString(),
          type: "tags",
        });
        return newArray;
      });

    setLayoutTabs((prev) => {
      let newArray = [...prev];
      newArray.splice(index, 1);
      return newArray;
    });
    setActiveTabIndex((prev) => prev - 1 || 0);
  }

  const buttonProps: ButtonProps = {
    size: "sm",
    radius: "md",
    isIconOnly: true,
  };

  return (
    <>
      <Tabs
        variant="light"
        color="primary"
        aria-label="LayoutTabs"
        classNames={{
          tabList: "overflow-visible flex",
        }}
        selectedKey={String(activeTabIndex)}
        onSelectionChange={(index) =>
          setActiveTabIndex(parseInt(String(index)))
        }
      >
        {layoutTabs.map((tab, index) => (
          <Tab
            key={index}
            title={
              <div className="flex group duration-150 items-center cursor-pointer">
                <div className="animate-fade-in cursor-pointer w-full">
                  {tab[0]?.label || `Tab ( ${index + 1} )`}
                </div>
                <div className="-top-14 pt-3 pb-2 min-w-10 w-full absolute flex items-center justify-center gap-x-1 duration-150 scale-0 group-hover:scale-100 origin-bottom">
                  <Button
                    {...buttonProps}
                    onPress={() => {
                      onOpen();
                      setEditIndex(index);
                    }}
                  >
                    <BiPencil size={15} />
                  </Button>
                  <TrashPopoverButton onPress={() => deleteTab(index)}>
                    {({ isTrashOpen }) => (
                      <Button
                        {...buttonProps}
                        color={isTrashOpen ? "danger" : "default"}
                        isDisabled={layoutTabs.length === 1}
                      >
                        <BiTrashAlt size={15} />
                      </Button>
                    )}
                  </TrashPopoverButton>
                </div>
              </div>
            }
          />
        ))}
      </Tabs>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Rename Tab
              </ModalHeader>
              <ModalBody className="flex ">
                <Input
                  className="flex-grow"
                  placeholder="Rename Tab"
                  value={layoutTabs[editIndex][0]?.label as string}
                  onValueChange={(value) => {
                    setLayoutTabs((prev) => {
                      let newArray = [...prev];
                      newArray[editIndex][0].label = value.trim();
                      return newArray;
                    });
                  }}
                />
                <Button className="flex-none" color="primary" onPress={onClose}>
                  Rename
                </Button>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
