import { ItemData } from "@/utils/types/item";
import { Card, CardBody, CardFooter } from "@heroui/react";
import { useRouter } from "next/router";
import { PiBlueprint } from "react-icons/pi";

export default function TemplateCard({ template }: { template: ItemData }) {
  const router = useRouter();

  return (
    <Card
      className="group bg-transparent duration-200 hover:scale-110 cubic-bezier animate-fade-in"
      shadow="none"
      isPressable
      onPress={() => router.push(`/templates/${template.id}`)}
    >
      <CardBody className="overflow-visible p-0">
        <Card
          className="aspect-square text-foreground shadow-lg items-center justify-center bg-accented"
          radius="lg"
        >
          <PiBlueprint className="text-7xl font-light opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <span className="text-4xl font-bold uppercase opacity-40">
              {template.title[0]}
            </span>
          </div>
        </Card>
      </CardBody>

      <CardFooter className="text-small capitalize h-full w-full py-3 flex flex-col items-center justify-center shadow-none duration-200 group-hover:font-bold">
        <span className="truncate w-full text-center">{template.title}</span>
        {template.description && (
          <span className="text-tiny text-default-400 font-normal truncate w-full text-center">
            {template.description}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
