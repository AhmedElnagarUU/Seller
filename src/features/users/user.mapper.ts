import type { UserRecord } from "@/features/users/user.model";
import type { CustomerDetailDTO, CustomerListItemDTO } from "@/features/users/user.types";

export function toCustomerListItemDTO(user: UserRecord, ownedCount: number): CustomerListItemDTO {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    country: user.country ?? null,
    ownedCount,
    createdAt: user.createdAt,
    isDisabled: user.disabled,
  };
}

export function toCustomerDetailDTO(user: UserRecord): CustomerDetailDTO {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    country: user.country ?? null,
    createdAt: user.createdAt,
    isDisabled: user.disabled,
    disabledReason: user.disabledReason ?? null,
    disabledAt: user.disabledAt ?? null,
  };
}
