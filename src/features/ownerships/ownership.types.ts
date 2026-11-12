import type { ThemeSummaryDTO } from "@/features/themes/theme.types";
import type { VersionDTO } from "@/features/versions/version.types";

// A theme the customer owns, with its versions (newest first). Used by "My themes".
export type OwnedThemeDTO = {
  theme: ThemeSummaryDTO;
  versions: VersionDTO[];
};

// What grantFromOrder did.
export type GrantFromOrderResult = "created" | "reactivated" | "unchanged";
