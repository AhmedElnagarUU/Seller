import { Inline } from "@/shared/layout/Inline";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Text } from "@/shared/ui/Text";

type PaginationProps = {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

// "Previous", "Page X of Y", "Next". Hidden when there is only one page.
export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination">
      <Inline gap="md" justify="center">
        {page > 1 ? (
          <ButtonLink href={buildHref(page - 1)} variant="secondary" size="sm">
            Previous
          </ButtonLink>
        ) : null}
        <Text size="sm" tone="muted">
          Page {page} of {totalPages}
        </Text>
        {page < totalPages ? (
          <ButtonLink href={buildHref(page + 1)} variant="secondary" size="sm">
            Next
          </ButtonLink>
        ) : null}
      </Inline>
    </nav>
  );
}
