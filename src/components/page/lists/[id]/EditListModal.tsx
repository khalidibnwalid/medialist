import StatusSubmitButton from "@/components/ui/buttons/StatusSubmitButton";
import ImageInput from "@/components/ui/form/ImageUploader";
import httpClient from "@/utils/lib/httpClient";
import { mutateListCache } from "@/utils/lib/tanquery/listsQuery";
import { errorToast, simpleToast } from "@/utils/toast";
import { ListData } from "@/utils/types/list";
import { addToast, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Radio, RadioGroup } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { Controller, FieldPath, useForm } from "react-hook-form";
import { BiImageAdd, BiRevision } from "react-icons/bi";
import { ListPageContext } from "./ListPageProvider";

interface ListFormData extends Pick<ListData, "title"> {
    cover: File | null | string,
    titlePlacement: ListData['configs']['titlePlacement']

}

export default function EditListModal({
    isOpen,
    onOpenChange
}: {
    isOpen: boolean,
    onOpenChange: () => void
}) {
    const { list } = useContext(ListPageContext)
    const listSrc = `/api/file/${list.userId}/${list.id}`

    const listForm = useForm<ListFormData>({
        defaultValues: {
            cover: list.coverPath ? `${listSrc}/${list.coverPath}` : null,
            title: list.title,
        }
    })
    const { handleSubmit, register, control, reset, resetField, formState: { dirtyFields } } = listForm

    const mutation = useMutation({
        mutationFn: (formData: FormData) => httpClient().patch(`lists/${list.id}`, formData),
        onError: () => addToast(errorToast('Try Again', () => handleSubmit(onSubmit)())),
        onSuccess: (data: ListData) => {
            mutateListCache(data, "edit")
            addToast(simpleToast(`${data.title} Updated`))
            reset({
                cover: data.coverPath ? `${listSrc}/${data.coverPath}` : null,
                title: data.title,
                titlePlacement: data.configs.titlePlacement
            })
            mutation.reset()
            onOpenChange()
        },
    })

    function onSubmit(data: ListFormData) {
        if (!Object.keys(dirtyFields).length) return

        const formData = new FormData()
        if (dirtyFields.title)
            formData.append('title', data.title)
        if (dirtyFields.cover)
            formData.append('cover', data.cover as File)
        if (dirtyFields.titlePlacement)
            formData.append('configs', JSON.stringify({ ...list?.configs, titlePlacement: data.titlePlacement }))
        mutation.mutate(formData)
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" size="xl">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">Edit: {list.title}</ModalHeader>
                        <ModalBody className="flex flex-row gap-x-4">
                            <Controller
                                control={control}
                                name="cover"
                                render={({ field, fieldState }) => (
                                    <ImageInput
                                        className="w-52 aspect-square border-default flex-none"
                                        innerContent={fieldState.isDirty
                                            ? <ResetButton resetField={resetField} />
                                            : <BiImageAdd className="text-4xl" />
                                        }
                                        {...field}
                                    />
                                )}
                            />
                            <div className=" flex flex-col flex-grow w-full gap-y-2">
                                <Input
                                    size="lg"
                                    className="w-full"
                                    title="List Title"
                                    label=""
                                    placeholder="List Name..."
                                    {...register("title", { required: true })}
                                />
                                <Controller
                                    control={control}
                                    name="titlePlacement"
                                    render={({ field }) => (
                                        <RadioGroup
                                            label="Title Style (Card View)"
                                            orientation="horizontal"
                                            {...field}
                                        >
                                            <Radio value="title-below">Title Below</Radio>
                                            <Radio value="title-overlay">Title Overlay</Radio>
                                            <Radio value="hidden">Title Hidden</Radio>
                                        </RadioGroup>
                                    )}
                                />
                                <div className="flex-grow"></div>
                                <div className="flex flex-row gap-x-2 w-full items-center justify-end">
                                    <Button color="danger" variant="light" onPress={onClose}>
                                        Close
                                    </Button>
                                    <StatusSubmitButton
                                        color="primary"
                                        mutation={mutation}
                                        onPress={handleSubmit(onSubmit)}
                                    />
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter>

                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    )
}

const ResetButton = ({
    resetField
}: {
    resetField: (field: FieldPath<ListFormData>) => void
}) => {
    return (
        <Button onPress={() => resetField("cover")} size="lg" isIconOnly>
            <BiRevision size={30} />
        </Button>
    )
}