import { Card, CardBody, CardFooter } from "@heroui/react";
import { useRouter } from "next/router";
import { BiPlus } from "react-icons/bi";

export default function NewTemplateButton() {
  const router = useRouter();

  return (
    <Card
      className="group bg-transparent duration-200 hover:scale-110 animate-fade-in"
      shadow="none"
      onPress={() => router.push("/templates/add")}
      isPressable
    >
      <CardBody className="overflow-visible p-0">
        <Card
          className="aspect-square text-foreground shadow-lg items-center justify-center bg-accented"
          radius="lg"
        >
          <BiPlus className="text-6xl font-light" />
        </Card>
      </CardBody>

      <CardFooter className="text-small capitalize h-full w-full py-3 flex items-start justify-center shadow-none duration-200 group-hover:font-bold">
        New Template
      </CardFooter>
    </Card>
  );
}
