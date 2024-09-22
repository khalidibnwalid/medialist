import { ItemFieldType } from "@/utils/types/item"
import ItemFormLabelTextField from "./fields/ItemFormLabelTextField"
import ItemFormLinkField from "./fields/ItemFormLinkField"
import ItemFormTextField from "./fields/ItemFormTextField"

// Maps a Field to its Component equivalent
export default function ItemFormFieldsMapper({
    type,
    rowIndex,
    colIndex,
    // children,
}: {
    type: ItemFieldType
    rowIndex: number
    colIndex: number
    // children?: React.ReactNode
}) {
    const position = { rowIndex, colIndex }

    switch (type) {
        case "labelText":
            return <ItemFormLabelTextField {...position} />
        case "link":
            return <ItemFormLinkField {...position} />
        case "text":
            return <ItemFormTextField  {...position}/>
        default:
            return <></>
    }

}