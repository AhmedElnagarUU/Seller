export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  country: string | null;
};
