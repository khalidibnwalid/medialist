import { Input, Textarea } from "@heroui/react";
import { useContext } from "react";
import { Controller } from "react-hook-form";
import { ItemFormContext } from "@/components/forms/item/ItemFormProvider";

export default function TemplateHeaderSection() {
  const { itemForm } = useContext(ItemFormContext);
  const { control } = itemForm;

  return (
    <section className="space-y-4">
      <div className="p-4 space-y-4 bg-accented bg-opacity-20 rounded-xl border border-foreground/5">
        <span className="text-xs font-bold uppercase opacity-50 block">
          Template Info
        </span>
        <div className="grid grid-cols-1 gap-4">
          <Controller
            control={control}
            name="title"
            rules={{ required: true }}
            render={({ field }) => (
              <Input
                {...field}
                label="Template Title"
                labelPlacement="outside"
                variant="bordered"
                placeholder="e.g., Books Template"
                isRequired
                value={field.value || ""}
                classNames={{
                  label: "text-foreground/80 font-bold mb-1",
                  inputWrapper: "bg-background/20 border-foreground/10 h-12",
                }}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Textarea
                {...field}
                label="Template Description"
                labelPlacement="outside"
                variant="bordered"
                placeholder="What is this template for?"
                value={field.value || ""}
                classNames={{
                  label: "text-foreground/80 font-bold mb-1",
                  inputWrapper: "bg-background/20 border-foreground/10",
                }}
              />
            )}
          />
        </div>
      </div>
    </section>
  );
}
