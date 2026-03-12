import React, { useRef, useEffect } from "react";
import { Input, InputProps } from "@heroui/react";

interface UrlHighlightInputProps extends Omit<InputProps, "onValueChange"> {
  onValueChange?: (value: string) => void;
}

const UrlHighlightInput = React.forwardRef<
  HTMLInputElement,
  UrlHighlightInputProps
>(({ value = "", onValueChange, onChange, ...props }, ref) => {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync scroll
  useEffect(() => {
    const handleScroll = () => {
      if (mirrorRef.current && inputRef.current) {
        mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener("scroll", handleScroll);
      // Also sync on initial mount/value change
      handleScroll();
      return () => input.removeEventListener("scroll", handleScroll);
    }
  }, [value]);

  const highlightText = (text: string) => {
    const parts = String(text).split(/(\{[a-zA-Z0-9_-]+\})/g);
    return parts.map((part, i) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return (
          <span
            key={i}
            className="bg-primary/30 rounded-sm text-transparent"
            style={{
              padding: "1px 0",
              boxShadow: "0 0 0 1px rgba(var(--heroui-primary-rgb), 0.3)",
            }}
          >
            {part}
          </span>
        );
      }
      return (
        <span key={i} className="text-transparent">
          {part}
        </span>
      );
    });
  };

  const fontStyle = {
    fontFamily:
      'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
    fontSize: "14px",
    letterSpacing: "0px",
    fontVariantLigatures: "none" as const,
  };

  return (
    <div className="relative w-full group overflow-hidden">
      {/* Mirror div for highlights */}
      <div
        ref={mirrorRef}
        className="absolute left-0 right-0 pointer-events-none whitespace-pre overflow-hidden flex items-center z-20"
        style={{
          ...fontStyle,
          height: "40px",
          bottom: "0px",
          paddingLeft: "12px",
          paddingRight: "12px",
          lineHeight: "20px",
        }}
      >
        {highlightText(String(value))}
      </div>

      <Input
        {...props}
        ref={(node) => {
          (inputRef as any).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as any).current = node;
        }}
        value={value}
        onValueChange={onValueChange}
        onChange={onChange}
        classNames={{
          ...props.classNames,
          input: "relative z-10 !bg-transparent",
          inputWrapper: "!bg-background/20 !border-foreground/10",
        }}
        style={fontStyle}
      />
    </div>
  );
});

UrlHighlightInput.displayName = "UrlHighlightInput";

export default UrlHighlightInput;
