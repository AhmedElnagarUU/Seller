import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/shared/ui/buttonClasses";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit";
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  name?: string;
  value?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  fullWidth = false,
  disabled,
  onClick,
  children,
  name,
  value,
}: ButtonProps) {
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={disabled}
      onClick={onClick}
      className={buttonClasses({ variant, size, fullWidth })}
    >
      {children}
    </button>
  );
}
