import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { useState } from "react";
import { ExtractorParam } from "@/utils/types/item";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  params: ExtractorParam[];
  onExtract: (paramValues: Record<string, string>) => void;
  loading?: boolean;
}

export default function ExtractorParamsModal({
  isOpen,
  onOpenChange,
  params,
  onExtract,
  loading,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    onExtract(values);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Template Parameters</ModalHeader>
            <ModalBody className="space-y-4">
              <p className="text-sm opacity-70">
                This template fetches data from an API. Please provide the
                following parameters:
              </p>
              {params.map((p) => (
                <Input
                  key={p.key}
                  label={p.key}
                  placeholder={`Enter ${p.key}...`}
                  variant="bordered"
                  value={values[p.key] || ""}
                  onValueChange={(val) =>
                    setValues((prev) => ({ ...prev, [p.key]: val }))
                  }
                />
              ))}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={loading}
              >
                Extract & Apply
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
