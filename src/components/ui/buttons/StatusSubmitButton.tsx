import { Button, ButtonProps } from "@heroui/react";
import { UseMutationResult } from "@tanstack/react-query";
import { JSX } from "react";
import { BiCheckDouble, BiRevision } from "react-icons/bi";
import { FaSave } from "react-icons/fa";

export interface StatusSubmitButtonProps extends Omit<ButtonProps, "onPress"> {
  mutation: UseMutationResult<any, any, any, any>;
  errorOnPress?: () => void;
  saveOnPress?: () => void;
  onPress: () => void;
  defaultContent?: JSX.Element | string;
  savedContent?: JSX.Element | string;
  errorContent?: JSX.Element | string;
}

/** Submit Button With Indicators for Error and Success */
export default function StatusSubmitButton({
  mutation,
  onPress,
  errorOnPress,
  saveOnPress,
  defaultContent = (
    <>
      <FaSave className="text-xl" /> Save
    </>
  ),
  savedContent = (
    <>
      <BiCheckDouble className="text-xl" /> Saved
    </>
  ),
  errorContent = (
    <>
      <BiRevision className="text-xl" />
      Try Again
    </>
  ),
  isDisabled,
  ...buttonProps
}: StatusSubmitButtonProps) {
  if (mutation.isError)
    return (
      <Button
        {...buttonProps}
        color="danger"
        onPress={errorOnPress || onPress}
        isDisabled={isDisabled}
      >
        {errorContent}
      </Button>
    );

  if (mutation.isSuccess)
    return (
      <Button
        {...buttonProps}
        color="success"
        onPress={saveOnPress || onPress}
        isDisabled={isDisabled}
      >
        {savedContent}
      </Button>
    );

  if (mutation.isPending)
    return <Button isDisabled={true} isLoading {...buttonProps}></Button>;

  return (
    <Button {...buttonProps} onPress={onPress} isDisabled={isDisabled}>
      {defaultContent}
    </Button>
  );
}
