import { ItemFormContext, ItemFormField } from "@/components/forms/item/ItemFormProvider"
import SortableMultiContainersWrapper from "@/components/ui/layout/drag&drop/logic/SortableMultiContainersWrapper"
import SortableContainer from "@/components/ui/layout/drag&drop/SortableContainer"
import SortableItem from "@/components/ui/layout/drag&drop/SortableItem"
import { DragOverlay } from "@dnd-kit/core"
import { Divider } from "@heroui/react"
import { Dispatch, SetStateAction, useContext } from "react"
import ItemFormFieldsMapper from "./ItemFormFieldMapper"
import ItemFormLayoutAddFieldButton from "./layoutTitleBar/ItemFormLayoutAddFieldButton"

/**
 * All fields are self-contained, they store their own state and update the containers by themselves
 * I did so since useArrayField doesn't support nested arrays,
 * and I tried to implement my own 'move' function but the state did break consistently,
 * also the containers array didn't sync correctly with useFieldArray's array
*/
export default function ItemFormLayoutSection() {
    const { activeTabFields, setActiveTabFields, activeTabHeader } = useContext(ItemFormContext)

    const gridTemplate = {
        one_row: "1fr",
        left_sidebar: "1fr 2fr",
        right_sidebar: "2fr 1fr",
        two_rows: "1fr 1fr",
        three_rows: "1fr 1fr 1fr",
    }

    return (
        <SortableMultiContainersWrapper
            containers={activeTabFields}
            setContainers={setActiveTabFields}
            dragOverLay={(item) => (
                <DragOverlay className="bg-pure-theme/20 rounded-xl" />
            )}
        >
            <div
                key={activeTabHeader?.type}
                className="grid gap-x-3"
                style={{ gridTemplateColumns: gridTemplate?.[activeTabHeader?.type] || gridTemplate["left_sidebar"] }}
            >
                {activeTabFields.map((tabFields, rowIndex) => (
                    <SortableContainer
                        key={"container" + rowIndex}
                        className="space-y-3 bg-accented bg-opacity-50 rounded-xl p-2 list-none"
                        id={rowIndex + "i"}
                        items={tabFields}
                    >
                        <ItemFormLayoutAddFieldButton rowIndex={rowIndex} />
                        {tabFields.map((item, colIndex) => (
                            <SortableItem id={item.id} key={item.id}>
                                <ItemFormFieldsMapper rowIndex={rowIndex} colIndex={colIndex} type={item.type} />
                                {colIndex !== tabFields.length - 1 && <Divider className="mt-3" />}
                            </SortableItem>
                        ))}
                    </SortableContainer>
                ))}
            </div>
        </SortableMultiContainersWrapper>
    )
}

export function useItemFormLayoutField(
    row: number,
    col: number,
    setFields: Dispatch<SetStateAction<ItemFormField[][]>>
) {
    function set(value: object) {
        setFields((prev) => {
            let newArray = [...prev]
            newArray[row][col] = { ...newArray[row][col], ...value }
            return newArray
        })
    }

    function remove() {
        setFields((prev) => {
            let newArray = [...prev]
            newArray[row].splice(col, 1)
            return newArray
        })
    }

    return {
        set,
        remove
    }
}
