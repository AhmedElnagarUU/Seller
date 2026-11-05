export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 40;
export const CATEGORY_DESCRIPTION_MAX = 300;
export const CATEGORY_SORT_ORDER_MIN = -1000;
export const CATEGORY_SORT_ORDER_MAX = 1000;

// "slug" format of docs/03-data-model.md: lowercase words joined by single dashes, 2 to 80 characters.
export const CATEGORY_SLUG_PATTERN = /^(?=.{2,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
