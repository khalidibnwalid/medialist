import { Button, ButtonProps } from "@heroui/react"
import Head from 'next/head'
import { useRouter } from 'next/router'
import { BiArrowBack, BiRevision } from 'react-icons/bi'

export default function ErrorPage({
    message,
    MainMessage,
    hideTryAgain
}: {
    message?: string,
    MainMessage?: string,
    hideTryAgain?: boolean
}) {
    const router = useRouter()

    const buttonProps: ButtonProps = {
        className: ' shadow-lg',
        size: 'lg',
    }

    return (
        <>
            <Head>
                <title>MediaList - {MainMessage || message || 'Error'}</title>
            </Head>

            <div className=' w-full h-[90vh] flex items-center justify-center flex-col gap-y-10 pr-[70px] animate-fade-in'>

                <p className=' text-7xl text-center'>{MainMessage || "Something went wrong!"}</p>
                {message && <p className=' text-xl font-semibold text-neutral-400 [.light_&]:text-neutral-600'>{message}</p>}
                <div className='flex gap-x-4'>
                    <Button
                        variant='bordered'
                        color={hideTryAgain ? 'primary' : 'default'}
                        onClick={() => router.back()}
                        {...buttonProps}
                    >
                        <BiArrowBack className=" text-xl" />
                        Go Back
                    </Button>

                    {!hideTryAgain && <Button
                        variant='ghost'
                        color='primary'
                        onClick={() => router.reload()}
                        {...buttonProps}
                    >
                        <BiRevision className=" text-xl" />
                        Try again
                    </Button>}
                </div>
            </div>
        </>
    )
}