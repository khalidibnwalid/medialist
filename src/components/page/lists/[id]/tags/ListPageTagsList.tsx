import { sortTagsByGroup } from "@/utils/functions/sortTagsByGroup"
import { TagData } from "@/utils/types/global"
import { AnimatePresence, motion } from "framer-motion"
import { useContext, useState } from "react"
import { ListPageContext } from "../ListPageProvider"
import ListPageGroupTagCard from "./ListPageGroupTagCard"
import ListPageNewTag from "./ListPageNewTag"
import ListPageTagsSearch from "./ListPageTagsSearch"

export default function ListPageTagsList() {
    const { showTags, tags } = useContext(ListPageContext)

    const [visibleTags, setVisibleTags] = useState<TagData[]>(tags)
    const groupedAllTags = sortTagsByGroup(tags)
    const groupedTags = sortTagsByGroup(visibleTags)

    // make it sticky?
    return (
        <AnimatePresence>
            {showTags &&
                <motion.div
                    className="z-50 absolute top-0 right-0 rounded-xl min-w-72 max-w-96 max-h-[80vh] overflow-auto md:static md:w-full md:max-w-full md:mb-5"
                    style={{ scrollbarWidth: 'thin' }}
                    transition={{ duration: 0.2 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 100 }}
                    exit={{ opacity: 0 }}
                >
                    <div className="p-3 grid grid-cols-1 gap-y-2 opacity-80 [.light_&]:opacity-100 hover:opacity-100 md:opacity-100 bg-accented shadow-md duration-300">
                        <ListPageTagsSearch
                            setVisibleTags={setVisibleTags}
                            allTags={tags}
                        />
                        <ListPageNewTag tagsGroups={groupedTags} />
                        {groupedTags?.map(group =>
                            <ListPageGroupTagCard
                                key={group.groupName || "ungrouped"}
                                tagsGroups={groupedAllTags}
                                tagGroup={group}
                            />
                        )}
                    </div>
                </motion.div>
            }
        </AnimatePresence >
    )
}