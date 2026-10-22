import ConnectAppModal from "@/components/features/connect/ConnectAppModal"
import UserPageSecurityTab from "@/components/page/user/SecurityTab"
import { useUser } from "@/components/providers/AuthProvider"
import TitleBar from "@/components/ui/bars/TitleBar"
import { Button, Tab, Tabs, useDisclosure } from "@heroui/react"
import { BiMobileAlt, BiShieldAlt2 } from "react-icons/bi"
import { RiUserLine } from "react-icons/ri"

export default function UserPage() {
    const { user } = useUser()
    const connectModal = useDisclosure()

    return (<>
        <TitleBar
            className="bg-pure-theme p-5 mb-2"
            title={user.username}
            startContent={<RiUserLine className="text-3xl mr-3" />}
        >
            <div className="flex gap-x-2">
                <Button
                    variant="flat"
                    onPress={connectModal.onOpen}
                    startContent={<BiMobileAlt className="text-xl" />}
                >
                    Connect mobile app
                </Button>
                {/* {isAdmin && (
                    <Button title="Admin" variant="bordered">
                        Admin
                    </Button>
                )} */}
            </div>
        </TitleBar>
        <main className="animate-fade-in">
            <Tabs
                aria-label="User Page Tabs"
                // variant="light"
                color="primary"
                classNames={{
                    base: "data-selected:bg-default",
                    tabList: "p-0 rounded-none bg-transparent",
                    tab: "bg-accented duration-200 data-hover:text-xl  ",
                }}
                disableCursorAnimation
            >
                <Tab title={
                    <div className="flex items-center space-x-1">
                        <BiShieldAlt2 className="text-lg" />
                        <span>Security</span>
                    </div>
                }>
                    <UserPageSecurityTab />
                </Tab>
                {/* <Tab title={
                    <div className="flex items-center space-x-1">
                        <BiInfoCircle className="text-lg" />
                        <span>Activity</span>
                    </div>
                }>

                </Tab>
                {isAdmin && ( //dynamic import
                    (<Tab title={
                        <div className="flex items-center space-x-2">
                            <BsSuitcaseLg className="text-lg" />
                            <span>Admin</span>
                        </div>
                    }>
                    </Tab>)
                )}
                {isAdmin && ( //dynamic import
                    (<Tab title={
                        <div className="flex items-center space-x-2">
                            <BsSuitcaseLg className="text-lg" />
                            <span>Logs</span>
                        </div>
                    }>
                    </Tab>)
                )} */}
            </Tabs>
            {/* pages: activites/ edit */}
        </main>
        <ConnectAppModal isOpen={connectModal.isOpen} onOpenChange={connectModal.onOpenChange} />
    </>);
}