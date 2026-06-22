import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

type CurrencyInputProps = Omit<ComponentProps<"input">, "className"> & {
  containerClassName?: string
  inputClassName?: string
}

export function CurrencyInput({
  containerClassName,
  inputClassName,
  style,
  value,
  placeholder = "0",
  ...props
}: CurrencyInputProps) {
  const characterCount = Math.min(Math.max(String(value ?? "").length, 1), 18)

  return (
    <span className={cn("flex min-w-24 items-center justify-center", containerClassName)}>
      <input
        {...props}
        value={value}
        placeholder={placeholder}
        style={{ ...style, width: `${characterCount}ch` }}
        className={cn(
          "min-w-[1ch] bg-transparent p-0 text-right tabular-nums text-foreground outline-none",
          inputClassName,
        )}
      />
      <span className="pointer-events-none shrink-0 text-muted-foreground">₺</span>
    </span>
  )
}
