# 00 — Product

## 1. One-sentence summary

A website where **one seller** (the owner) sells **premium WordPress themes**.
A customer pays **once** for a theme, downloads it as a `.zip` file, and can download every future version for free, forever.

## 2. Who uses it

| Role | Who | What they do |
|---|---|---|
| **Visitor** | Anyone, not logged in | Browses themes, views live demos, reads changelogs |
| **Customer** | Logged-in user | Buys themes, downloads them, gets update emails |
| **Admin** | The owner only | Adds themes and versions, sees orders and customers, manages coupons |

There are no other sellers and no other staff roles.

## 3. How a customer uses the store (main flows)

### 3.1 Browse and evaluate
1. Visitor opens the home page and sees featured themes and the newest themes.
2. Visitor opens the theme list. They can filter by category and sort by newest or price.
3. Visitor opens a theme page. It shows screenshots, description, features, requirements
   (minimum WordPress and PHP version), current version, last update date, price, and a **Changelog** tab.
4. Visitor clicks **Live Demo**. This opens the store's preview page: a thin top bar
   (theme name, price, **Buy** button, desktop/tablet/mobile switch) with the real demo site underneath.

### 3.2 Buy
1. Customer clicks **Buy** on a theme page.
2. If not logged in → sent to login/register, then sent back to the same theme page.
3. If the email is not verified → asked to verify it first.
4. If the customer already owns the theme → there is no Buy button, only **Download**.
5. Our server creates a Polar checkout for that one theme and redirects the customer to it.
   The customer can type a coupon code there.
6. Customer pays on Polar's page. Polar redirects back to our **checkout success** page.
7. Polar sends a webhook to our server. Our server records the order and gives the customer access to the theme.
8. The success page waits until access is recorded, then shows a **Download** button.
9. The customer gets an order confirmation email from us (with a link to their downloads) and a receipt from Polar.

There is **no shopping cart**. One checkout = one theme.

### 3.3 Download
1. Customer opens **My Themes** in their account.
2. Each owned theme shows its latest version and a **Download** button.
   Older versions are also listed and can be downloaded.
3. Clicking Download gives a short-lived private link to the `.zip`. Links cannot be shared long-term.

### 3.4 Updates
1. Admin uploads a new version of a theme, with its version number and changelog text.
2. Admin ticks **Email buyers about this update** (ticked by default).
3. Every customer who owns that theme and has not turned off update emails gets an email:
   "<Theme> <version> is available — here is what changed", with a link to download it.
4. Customers update the theme in WordPress by hand (upload the new zip). There is no automatic update in the MVP.

### 3.5 Refund
1. The owner issues a refund in the Polar dashboard.
2. Polar sends a webhook. Our server removes the customer's access to that theme.

### 3.6 Account
- Register / log in with **email + password** or **Google**.
- Verify email, reset forgotten password.
- My Themes (downloads), My Orders (order history), Settings (name, password, update-email on/off).

## 4. What the admin can do

- **Dashboard:** total sales (today, last 30 days, all time), latest orders.
- **Themes:** create, edit, publish, unpublish. Fields include name, slug, descriptions, price,
  category, screenshots, demo URL, requirements, features list.
- **Versions:** upload a new `.zip`, set version number and changelog, choose whether to email buyers.
- **Categories:** create, edit, delete.
- **Orders:** list and view. (Refunds are done in the Polar dashboard; our store updates by webhook.)
- **Customers:** list and view, see what they own, **grant a theme manually** (for gifts or support cases).
- **Coupons:** create, edit, disable. A coupon gives a percentage or fixed discount, on all themes
  or only some, with an optional expiry date and maximum number of uses.

## 5. Other pages

- About, Contact (shows the owner's support email address — no contact form in MVP).
- Legal: Terms of Service, Privacy Policy, Refund Policy, License (what the buyer is allowed to do).
  The payment provider requires these pages to exist.

## 6. NOT in the MVP

These are deliberately left out. Do not build them.

- All-access / subscription plans
- Free themes
- Shopping cart / buying several themes in one checkout
- Automatic theme updates inside WordPress, license keys, license activation
- Multiple license tiers (single site / unlimited / developer)
- Product reviews and ratings
- Support tickets
- Affiliates
- Blog
- Wishlist
- Multiple languages, RTL, multiple currencies
- Other sellers / marketplace features
- Customer account deletion from the UI (handled by email request in MVP)

## 7. The MVP is done when

1. The owner can add a theme with screenshots, a demo URL and a downloadable version from the admin panel.
2. A visitor can find the theme, see the demo, register, pay with a real card through Polar, and download the zip.
3. A coupon entered at checkout lowers the price.
4. Uploading a new version sends an update email to every buyer, and they can download the new zip.
5. A refund in Polar removes download access.
6. The site runs on the owner's DigitalOcean VPS over HTTPS.
