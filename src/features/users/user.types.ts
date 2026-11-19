export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  country: string | null;
};

// The few user fields that payments and emails need.
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  country: string | null;
};
