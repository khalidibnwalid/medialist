import { mutateUserCache, usersQueryOptions } from "@/utils/lib/tanquery/usersQuery";
import { UserData } from "@/utils/types/global";
import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import AuthLayout from "../features/auth/AuthLayout";
import httpClient from "@/utils/lib/httpClient";
import { queryClient } from "./RootProviders";
import { useRouter } from "next/router";

const AuthContext = createContext({
    user: {} as UserData,
} as {
    user: UserData,
    logout: () => Promise<void>
})

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { data: userData, isSuccess, isLoading } = useQuery(usersQueryOptions())
    const router = useRouter()

    const isAuthed = isSuccess && Boolean(userData) && Object.keys(userData).length > 0

    async function logout() {
        await httpClient().delete('sessions')
        queryClient.clear()
        mutateUserCache({})
        router.push('/')
    }

    if (isLoading) return LoadingAuth()

    return isAuthed ? (
        <AuthContext.Provider value={{
            user: userData,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    ) : <AuthLayout />
}

export function useUser() {
    return useContext(AuthContext)
}

function LoadingAuth() {
    return (
        <div>
            <div className="absolute w-full h-full flex flex-col items-center justify-center gap-y-4 bg-black [.light_&]:bg-white text-foreground z-50 bg-opacity-55 backdrop-blur-lg animate-fade-in">
                <Spinner
                    aria-label="Checking if you are logged in"
                    size="lg"
                    label="Checking if you are logged in..."
                />
            </div>
            <AuthLayout />
        </div>
    )
}