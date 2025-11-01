import { Spinner } from "@heroui/react";
import { useTheme } from "next-themes";
import { Poppins } from "next/font/google";
import Head from "next/head";
import { useState } from "react";
import {
  BiCollection,
  BiLogOutCircle,
  BiTrashAlt,
  BiArrowBack,
} from "react-icons/bi";
import { BsSun } from "react-icons/bs";
import { RiMoonClearLine, RiUserLine } from "react-icons/ri";
import { twJoin } from "tailwind-merge";
import { useUser } from "../providers/AuthProvider";
import BaseNavBar from "../ui/bars/nav/BaseNavBar";
import BaseNavButton, {
  BaseNavButtonProps,
} from "../ui/bars/nav/BaseNavButtons";
import RootFooter from "./RootFooter";
import { useRouter } from "next/router";

const poppins = Poppins({ weight: "400", subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const router = useRouter();
  const itemId = router.query.itemId as string | undefined;
  const listId = router.query.id as string | undefined;

  const navItems = [
    ...(itemId
      ? [
          {
            label: "List",
            link: `/lists/${listId}`,
            icon: <BiArrowBack key="nav-BiHomeAlt2" />,
          },
        ]
      : []),
    { label: "Lists", link: "/", icon: <BiCollection key="nav-BiHomeAlt2" /> },
    {
      label: "Trash",
      link: "/trash",
      icon: <BiTrashAlt key="nav-BiHomeAlt2" />,
    },
    {
      label: user!.username,
      link: "/user",
      icon: <RiUserLine key="nav-BiUserCircle" />,
    },
  ];

  return (
    <>
      <Head>
        <title>MediaList</title>
      </Head>
      <div className="text-foreground grid grid-cols-sidebar xs:grid-cols-1">
        <div className="xs:hidden w-full h-screen z-50 animate-fade-in">
          <BaseNavBar
            className="fixed top-0 p-5 pt-10 h-screen"
            buttonsVarient="sideLabel"
            orientation="vertical"
            alignment="split"
            items={navItems}
            endContent={
              <>
                <ThemeButton varient="sideLabel" />
                <LogOutButton varient="sideLabel" />
              </>
            }
          />
        </div>
        <BaseNavBar
          items={navItems}
          className="hidden xs:flex fixed bottom-0 w-full shadow-custom-md p-3 bg-accented animate-fade-in"
        />
        <div
          className={twJoin(
            poppins.className,
            "pt-5 ltr:pr-5 rtl:pl-5 xs:px-5 w-full flex flex-col items-start",
          )}
        >
          <div className="pb-28 h-full w-full">{children}</div>
          <RootFooter />
        </div>
      </div>
    </>
  );
}

interface CustomButtonsProps {
  varient: BaseNavButtonProps["varient"];
}

const ThemeButton = ({ varient }: CustomButtonsProps) => {
  const { theme, setTheme } = useTheme();
  return (
    <BaseNavButton
      varient={varient}
      label={theme === "dark" ? "Light (Experimental)" : "Dark"}
      icon={theme === "dark" ? <RiMoonClearLine /> : <BsSun />}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      disableActive
    />
  );
};

const LogOutButton = ({ varient }: CustomButtonsProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { logout } = useUser();

  async function onClick() {
    setIsLoading(true);
    await logout();
    setIsLoading(false);
  }

  return (
    <BaseNavButton
      varient={varient}
      icon={isLoading ? <Spinner color="current" /> : <BiLogOutCircle />}
      label="Logout"
      onClick={onClick}
      disabled={isLoading}
      disableActive
    />
  );
};
