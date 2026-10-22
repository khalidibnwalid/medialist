import httpClient from "@/utils/lib/httpClient";
import { Button, Modal, ModalBody, ModalContent, ModalHeader, Spinner, Tooltip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { BiCheck, BiCopy, BiErrorCircle, BiMobileAlt, BiRevision } from "react-icons/bi";

interface ConnectInfo {
    url: string
    candidates: string[]
}

export default function ConnectAppModal({
    isOpen,
    onOpenChange
}: {
    isOpen: boolean,
    onOpenChange: (isOpen: boolean) => void
}) {
    const { data, isPending, isError, refetch } = useQuery<ConnectInfo>({
        queryKey: ['connect'],
        queryFn: () => httpClient().get('connect'),
        enabled: isOpen,
        staleTime: 60_000,
    })

    const [selected, setSelected] = useState<string | null>(null)
    const url = selected && data?.candidates.includes(selected) ? selected : data?.url

    const [svg, setSvg] = useState<string | null>(null)
    useEffect(() => {
        if (!url) return setSvg(null)
        let cancelled = false
        QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
            .then(s => !cancelled && setSvg(s))
            .catch(() => !cancelled && setSvg(null))
        return () => { cancelled = true }
    }, [url])

    const [copied, setCopied] = useState(false)
    async function copy() {
        if (!url) return
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch { /* clipboard unavailable (insecure context) */ }
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" size="md">
            <ModalContent>
                <ModalHeader className="flex items-center gap-x-2">
                    <BiMobileAlt className="text-2xl" /> Connect mobile app
                </ModalHeader>
                <ModalBody className="pb-6 gap-y-4">
                    {isPending ? (
                        <div className="h-64 flex items-center justify-center"><Spinner /></div>
                    ) : isError || !url ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-y-3 text-danger">
                            <BiErrorCircle className="text-4xl" />
                            <span>Couldn&apos;t get the server address</span>
                            <Button size="sm" variant="flat" onPress={() => refetch()} startContent={<BiRevision />}>
                                Retry
                            </Button>
                        </div>
                    ) : (<>
                        <div className="flex justify-center">
                            {/* QR always on white so phone cameras can read it in dark mode */}
                            <div
                                className="bg-white p-3 rounded-2xl [.light_&]:ring-1 [.light_&]:ring-default-200 size-60 [&>svg]:w-full [&>svg]:h-full"
                                aria-label={`QR code for ${url}`}
                                role="img"
                                dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
                            />
                        </div>

                        <div className="flex items-center gap-x-2 bg-default-100 rounded-xl ltr:pl-3 rtl:pr-3 p-1">
                            <code className="flex-grow truncate text-sm" title={url}>{url}</code>
                            <Tooltip content={copied ? 'Copied' : 'Copy'}>
                                <Button size="sm" variant="light" isIconOnly onPress={copy} aria-label="Copy address">
                                    {copied ? <BiCheck className="text-xl text-success" /> : <BiCopy className="text-lg" />}
                                </Button>
                            </Tooltip>
                        </div>

                        {data.candidates.length > 1 && (
                            <div className="flex flex-col gap-y-2">
                                <span className="text-sm text-foreground-500">Other addresses of this server:</span>
                                <div className="flex flex-wrap gap-2">
                                    {data.candidates.map(candidate => (
                                        <Button
                                            key={candidate}
                                            size="sm"
                                            variant={candidate === url ? 'solid' : 'flat'}
                                            color={candidate === url ? 'primary' : 'default'}
                                            onPress={() => setSelected(candidate)}
                                        >
                                            {candidate.replace(/^https?:\/\//, '').replace(/\/api$/, '')}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-sm text-foreground-500">
                            Open MediaList on your phone → <b>Scan QR</b> on the login screen.
                            Phone and server must be on the same network.
                        </p>
                    </>)}
                </ModalBody>
            </ModalContent>
        </Modal>
    )
}
