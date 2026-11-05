import { Grid } from "@/shared/layout/Grid";
import { Button } from "@/shared/ui/Button";
import { SelectField } from "@/shared/ui/SelectField";
import { TextField } from "@/shared/ui/TextField";
import type { CategoryWithCountDTO } from "@/features/categories/category.types";
import { THEME_SORT_LABELS, THEME_SORTS, type ThemeSort } from "@/features/themes/theme.constants";

type ThemeFiltersProps = {
  q: string;
  categorySlug: string;
  sort: ThemeSort;
  categories: CategoryWithCountDTO[];
};

const SORT_OPTIONS = THEME_SORTS.map((sort) => ({ value: sort, label: THEME_SORT_LABELS[sort] }));

// A plain GET form: it works without JavaScript and the filters stay in the URL.
export function ThemeFilters({ q, categorySlug, sort, categories }: ThemeFiltersProps) {
  const categoryOptions = categories.map((category) => ({ value: category.slug, label: category.name }));

  return (
    <form action="/themes" method="get">
      <Grid columns={4}>
        <TextField label="Search" name="q" defaultValue={q} />
        <SelectField
          label="Category"
          name="category"
          options={categoryOptions}
          defaultValue={categorySlug}
          placeholder="All categories"
        />
        <SelectField label="Sort" name="sort" options={SORT_OPTIONS} defaultValue={sort} />
        <div className="flex items-end">
          <Button type="submit">Apply</Button>
        </div>
      </Grid>
    </form>
  );
}
