import { TextLink } from "@/shared/ui/TextLink";

type StoreHeaderProps = {
  accountSlot: React.ReactNode;
};

export function StoreHeader({ accountSlot }: StoreHeaderProps) {
  return (
    <header className="border-border bg-background border-b">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <nav aria-label="Main" className="flex items-center gap-6">
          <span className="font-heading text-lg font-bold">
            <TextLink href="/">Theme Store</TextLink>
          </span>
          <TextLink href="/themes" tone="muted">
            Themes
          </TextLink>
        </nav>
        <div>{accountSlot}</div>
      </div>
    </header>
  );
}
