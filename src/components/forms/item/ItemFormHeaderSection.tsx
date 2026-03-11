import ImageInput from "@/components/ui/form/ImageUploader";
import { Button, Input, Textarea } from "@heroui/react";
import { useContext } from "react";
import { Controller, FieldPath } from "react-hook-form";
import { BiRevision } from "react-icons/bi";
import { ItemFormContext, ItemFormData } from "./ItemFormProvider";

export default function ItemFormHeaderSection() {
  const { itemForm, isTemplate } = useContext(ItemFormContext);
  const { control } = itemForm;
  return (
    <section className=" grid grid-cols-3 gap-x-3">
      <section className="p-2 space-y-3 bg-accented bg-opacity-50 rounded-xl">
        {!isTemplate && (
          <Controller
            control={control}
            name="poster"
            render={({ field, fieldState }) => (
              <ImageInput
                className="h-44"
                innerContent={
                  fieldState.isDirty ? (
                    <ResetButton field="poster" />
                  ) : (
                    "Drop Image or Click to Add Poster"
                  )
                }
                {...field}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="title"
          rules={{ required: true }}
          render={({ field }) => (
            <Input
              {...field}
              variant="bordered"
              placeholder="Title"
              isRequired
              value={field.value || ""}
            />
          )}
        />
      </section>
      <section className="p-2 space-y-3 bg-accented bg-opacity-50 rounded-xl col-span-2">
        {!isTemplate && (
          <Controller
            control={control}
            name="cover"
            render={({ field, fieldState }) => (
              <ImageInput
                className="h-44"
                innerContent={
                  fieldState.isDirty ? (
                    <ResetButton field="cover" />
                  ) : (
                    "Drop Image or Click to Add Cover"
                  )
                }
                {...field}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea
              {...field}
              variant="bordered"
              placeholder="Description"
              value={field.value || ""}
            />
          )}
        />
      </section>
    </section>
  );
}

const ResetButton = ({ field }: { field: FieldPath<ItemFormData> }) => {
  const { itemForm } = useContext(ItemFormContext);
  const { control, register, resetField } = itemForm;
  return (
    <Button onPress={() => resetField(field)} size="lg" isIconOnly>
      <BiRevision size={30} />
    </Button>
  );
};
