import { Alert } from "@/shared/ui/Alert";

type FormErrorProps = {
  message: string | null | undefined;
};

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return <Alert tone="danger">{message}</Alert>;
}
