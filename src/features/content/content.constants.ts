export const INFO_PAGES = [
  { slug: "about", title: "About" },
  { slug: "terms", title: "Terms of Service" },
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "refund-policy", title: "Refund Policy" },
  { slug: "license", title: "License" },
] as const;

export type InfoPageSlug = (typeof INFO_PAGES)[number]["slug"];
