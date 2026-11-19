import { Grid } from "@/shared/layout/Grid";
import { Button } from "@/shared/ui/Button";
import { SelectField } from "@/shared/ui/SelectField";
import { TextField } from "@/shared/ui/TextField";
import {
  ORDER_METHOD_LABELS,
  ORDER_METHODS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderMethod,
  type OrderStatus,
} from "@/features/orders/order.constants";

type OrderFiltersProps = {
  method: OrderMethod | undefined;
  status: OrderStatus | undefined;
  from: string | undefined;
  to: string | undefined;
};

const METHOD_OPTIONS = ORDER_METHODS.map((method) => ({ value: method, label: ORDER_METHOD_LABELS[method] }));
const STATUS_OPTIONS = ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] }));

// A plain GET form: it works without JavaScript and the filters stay in the URL.
export function OrderFilters({ method, status, from, to }: OrderFiltersProps) {
  return (
    <form action="/admin/orders" method="get">
      <Grid columns={4}>
        <SelectField
          label="Method"
          name="method"
          options={METHOD_OPTIONS}
          defaultValue={method ?? ""}
          placeholder="All"
        />
        <SelectField
          label="Status"
          name="status"
          options={STATUS_OPTIONS}
          defaultValue={status ?? ""}
          placeholder="All"
        />
        <TextField label="From" name="from" type="date" defaultValue={from ?? ""} />
        <TextField label="To" name="to" type="date" defaultValue={to ?? ""} />
        <div className="flex items-end">
          <Button type="submit">Apply</Button>
        </div>
      </Grid>
    </form>
  );
}
