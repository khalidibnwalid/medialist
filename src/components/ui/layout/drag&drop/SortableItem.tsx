import { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HTMLAttributes, JSX } from "react";

type DivAttributes = Omit<HTMLAttributes<HTMLLIElement>, 'id'>

interface props extends DivAttributes {
    id: string | UniqueIdentifier,
    children?: React.ReactNode,
    childrenEvents?: (isDragging: boolean, isOver: boolean) => JSX.Element
    styleOnEvent?: (isDragging: boolean, isOver: boolean) => React.CSSProperties
}

export default function SortableItem({
    id,
    children,
    styleOnEvent,
    childrenEvents,
    ...props
}: props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...styleOnEvent?.(isDragging, isOver),
        zIndex: isDragging ? "999" : "auto",
        opacity: isDragging ? 0.5 : 1
    }

    return (
        <li {...props} ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {childrenEvents?.(isDragging, isOver)}
            {children}
        </li>
    )
}