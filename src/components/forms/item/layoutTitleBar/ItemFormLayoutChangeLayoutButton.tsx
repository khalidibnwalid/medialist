import { ItemLayoutHeader } from "@/utils/types/item";
import type { Selection, SharedSelection } from "@heroui/react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { useContext, useEffect, useState } from "react";
import {
  BsLayoutSidebar,
  BsLayoutSidebarReverse,
  BsLayoutSplit,
  BsLayoutThreeColumns,
  BsSquare,
} from "react-icons/bs";
import { ItemFormContext } from "../ItemFormProvider";

export default function ItemFormLayoutChangeLayoutButton() {
  const { setActiveTabFields, activeTabHeader, setActiveTabHeader } =
    useContext(ItemFormContext);

  const defaultValue = activeTabHeader?.type || "left_sidebar";
  const [selectedLayoutKey, setSelectedLayoutKey] = useState<Selection>(
    new Set([defaultValue]),
  );
  const selectedLayout = Array.from(
    selectedLayoutKey,
  ).toString() as ItemLayoutHeader["type"];

  const iconMappings = new Map<string, React.ReactNode>([
    ["one_row", <BsSquare key="one_row_LayoutIcon" size={20} />],
    [
      "left_sidebar",
      <BsLayoutSidebar key="left_sidebar_LayoutIcon" size={20} />,
    ],
    [
      "right_sidebar",
      <BsLayoutSidebarReverse key="right_sidebar_LayoutIcon" size={20} />,
    ],
    ["two_rows", <BsLayoutSplit key="two_rows_LayoutIcon" size={20} />],
    [
      "three_rows",
      <BsLayoutThreeColumns key="three_rows_LayoutIcon" size={20} />,
    ],
  ]);

  const rowNumbers = {
    one_row: 1,
    left_sidebar: 2,
    right_sidebar: 2,
    two_rows: 2,
    three_rows: 3,
  };

  useEffect(() => {
    setSelectedLayoutKey(new Set([activeTabHeader?.type || "left_sidebar"]));
  }, [activeTabHeader]);

  function updateLayout(value: SharedSelection) {
    const newValue = value.currentKey as ItemLayoutHeader["type"];
    setActiveTabHeader((prev) => ({ ...prev, type: newValue }));

    const oldRowNumber = rowNumbers[activeTabHeader?.type];
    const newRowNumber = rowNumbers[newValue];

    // should create/remove rows
    // if going for less rows, we just need to merge the last rows
    if (activeTabHeader)
      if (oldRowNumber > newRowNumber) {
        setActiveTabFields((prev) => {
          const diff = oldRowNumber - newRowNumber + 1;
          const newRows = prev.slice(-diff);
          const mergedRows = newRows.flat();
          return [...prev.slice(0, -diff), mergedRows];
        });
      } else {
        // if going for more rows, we need to create new rows
        const diff = newRowNumber - oldRowNumber;
        const newRows = Array.from({ length: diff }, () => []);
        setActiveTabFields((prev) => [...prev, ...newRows]);
      }

    setSelectedLayoutKey(new Set([activeTabHeader?.type || "left_sidebar"]));
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly>{iconMappings.get(selectedLayout)}</Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Change Layout"
        disallowEmptySelection
        selectionMode="single"
        selectedKeys={selectedLayoutKey}
        onSelectionChange={updateLayout}
        itemClasses={{
          base: [
            "flex",
            "items-center",
            "justify-center",
            "text-center",
            "text-xs",
            "rounded-md",
            "py-1",
            "px-0",
            "m-0 ",
            "text-default-500",
            "transition-opacity",
            "data-[selected=true]:bg-default-50",
            "data-[selectable=true]:focus:bg-default-50",
          ],
        }}
      >
        <DropdownSection className="columns-5 md:columns-3 ">
          <DropdownItem key="one_row" textValue="oneRow">
            <BsSquare size={20} className="w-full mb-2" />
            One Column
          </DropdownItem>
          <DropdownItem key="left_sidebar" textValue="leftSidebar">
            <BsLayoutSidebar size={20} className="w-full mb-2" />
            Left Sidebar
          </DropdownItem>
          <DropdownItem key="right_sidebar" textValue="rightSidebar">
            <BsLayoutSidebarReverse size={20} className="w-full mb-2" />
            Right Sidebar
          </DropdownItem>
          <DropdownItem key="two_rows" textValue="twoRows">
            <BsLayoutSplit size={20} className="w-full mb-2" />
            Two Columns
          </DropdownItem>
          <DropdownItem key="three_rows" textValue="threeRows">
            <BsLayoutThreeColumns size={20} className="w-full mb-2" />
            Three Columns
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}

