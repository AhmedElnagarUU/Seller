import { Grid } from "@/shared/layout/Grid";
import { Button } from "@/shared/ui/Button";
import { SelectField } from "@/shared/ui/SelectField";
import { TextField } from "@/shared/ui/TextField";
import { ACTIVITY_ACTION_LABELS, ACTIVITY_ACTIONS, type ActivityAction } from "@/features/activity/activity.constants";

type ActivityFiltersProps = {
  action: ActivityAction | undefined;
  customer: string;
};

const ACTION_OPTIONS = ACTIVITY_ACTIONS.map((action) => ({ value: action, label: ACTIVITY_ACTION_LABELS[action] }));

// A plain GET form: it works without JavaScript and the filters stay in the URL.
export function ActivityFilters({ action, customer }: ActivityFiltersProps) {
  return (
    <form action="/admin/activity" method="get">
      <Grid columns={3}>
        <SelectField
          label="Action"
          name="action"
          options={ACTION_OPTIONS}
          defaultValue={action ?? ""}
          placeholder="All actions"
        />
        <TextField label="Customer email" name="customer" type="email" defaultValue={customer} />
        <div className="flex items-end">
          <Button type="submit">Apply</Button>
        </div>
      </Grid>
    </form>
  );
}
