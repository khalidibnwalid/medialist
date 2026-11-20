import { Input } from "@heroui/react";
import { useContext, useEffect, useRef, useState } from "react";
import { BiSearch } from "react-icons/bi";
import { ListPageContext } from "./ListPageProvider";

const SEARCH_DEBOUNCE_MS = 300

export default function ListPageSearchBar() {
    const { q, setQ } = useContext(ListPageContext)
    const [value, setValue] = useState(q)
    const lastSent = useRef(q)

    // the URL changed from outside (back/forward navigation)
    useEffect(() => {
        if (q !== lastSent.current) {
            lastSent.current = q
            setValue(q)
        }
    }, [q])

    // debounce the search, each change refetches from the server
    useEffect(() => {
        const trimmed = value.trim()
        if (trimmed === lastSent.current) return
        const timeout = setTimeout(() => {
            lastSent.current = trimmed
            setQ(trimmed)
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timeout)
    }, [value])

    return (
        <Input
            value={value}
            onValueChange={setValue}
            isClearable
            onClear={() => setValue('')}
            radius="lg"
            placeholder="Type to search..."
            startContent={<BiSearch className="opacity-80" size={20} />}
            className="text-foreground shadow-none"
        />
    )
}
