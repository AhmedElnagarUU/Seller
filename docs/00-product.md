# 00 — Product

## 1. One-sentence summary

A website where **one seller** (the owner) sells **premium WordPress themes**.
A customer pays **once** for a theme, downloads it as a `.zip` file, and can download every future version for free, forever.
Customers in Egypt can also pay with an **Egyptian mobile wallet** (manual transfer, approved by the owner).

## 2. Who uses it

| Role | Who | What they do |
|---|---|---|
| **Visitor** | Anyone, not logged in | Browses and searches themes, views live demos, reads changelogs |
| **Customer** | Logged-in user | Buys themes, downloads them, favorites themes, follows categories, gets notifications, sends feedback |
| **Admin** | The owner only | Manages themes, versions, coupons, customers, payments; sees sales and activity; sends notifications |

There are no other sellers and no other staff roles.

---

## 3. Customer features

### 3.1 Browse and search
1. **Home page:** featured themes, **best sellers**, newest themes, list of categories.
2. **Theme list (`/themes`):**
   - Search box: finds themes whose name or tagline contains the text (not case-sensitive).
   - Category filter.
   - Sort: Newest, Best selling, Price low → high, Price high → low.
   - 20 themes per page.
3. **Theme page:** screenshots, description, features, requirements (minimum WordPress and PHP version),
   current version, last update date, price, a **Changelog** tab, a **♥ Favorite** button, and a **Live Demo** button.
4. **Live demo (`/themes/[slug]/preview`):** a thin top bar (theme name, price, **Buy** button,
   desktop/tablet/mobile switch) with the real demo site underneath.
5. **Category page:** the theme list filtered to one category, with a **Follow category** button.

### 3.2 Account
- Register with **email + password** (name, email, password, **country**) or with **Google**.
- The country is pre-selected from the visitor's location when possible. Google users who have no country
  are asked for it the first time they check out.
- Verify email, reset forgotten password.
- A **disabled** account cannot log in (see admin 4.3).

### 3.3 Buy — one checkout page for everyone
1. Customer clicks **Buy** on a theme page.
2. Not logged in → login/register, then back. Email not verified → asked to verify first.
   Already owns the theme → there is no Buy button, only **Download**.
3. Our **checkout page (`/checkout/[slug]`)** shows: theme, price, a **coupon field**, and the payment method.
   - Applying a coupon shows the new price (our server checks the coupon).
   - Payment methods:
     - **Card / international (Polar)** — always available.
     - **Egyptian wallet (manual)** — shown **only** when the customer's country is Egypt and the owner has wallet payments turned on.
4. **Card (Polar):** customer clicks **Continue to payment** → redirected to Polar → pays → returns to our
   **success page**. Polar tells our server by webhook; the server records the order and gives access.
   The success page waits for that, then shows **Download**.
5. **Egyptian wallet:** see 3.4.

There is **no shopping cart**. One checkout = one theme.

### 3.4 Pay with an Egyptian wallet (manual)
1. On the checkout page the customer chooses **Egyptian wallet**. The page shows:
   - the amount **in Egyptian pounds** (EGP), calculated from the USD price (after coupon) and the owner's exchange rate;
   - the owner's wallet accounts (e.g. Vodafone Cash number, InstaPay address) and instructions;
   - a **payment reference code** (e.g. `TS-7K3P9Q`) to write in the transfer note.
2. The customer sends the money from their wallet app, then fills a form on our site:
   the phone number they paid from, the transaction ID (optional), and a **screenshot** of the transfer.
3. The request appears in the admin panel as **Waiting for review**. The customer sees it in their dashboard with the same status.
4. The owner checks their wallet and clicks **Approve** or **Reject (with a reason)**.
   - Approve → the customer gets the theme, an in-app notification and an email.
   - Reject → the customer gets a notification and an email with the reason. They can submit a new request.

### 3.5 Download
1. **My Themes** lists each owned theme with its latest version and a **Download** button.
   Older versions are also listed and can be downloaded.
2. Clicking Download gives a short-lived private link to the `.zip` (expires after 5 minutes).

### 3.6 Favorites and follows
- **Favorite a theme** (♥ on theme page or card). Favorites are listed in the dashboard.
- **Follow a category** (button on the category page). Follows are listed in the dashboard.
- These control notifications (3.7).

### 3.7 Notifications
- A **bell** in the header shows unread notifications. The **Notifications** page lists them (newest first) and can mark all as read.
- The customer gets a notification when:

| Event | In-app | Email (customer can turn off) |
|---|---|---|
| A theme they **own** gets a new version | always | yes (on by default) |
| A theme they **favorited** gets a new version | always | yes (on by default) |
| A new theme is published in a category they **follow** | always | yes (on by default) |
| The owner sends an **announcement** | always | yes (on by default) |
| Their wallet payment is approved or rejected | always | **always** (cannot be turned off — it is about their payment) |
| The owner replies to their feedback | always | **always** |

- **Settings → Notifications** has one on/off switch per row marked "yes" above. Every such email also has an unsubscribe link.

### 3.8 Customer dashboard (`/account`)
- **Overview:** owned themes count, unread notifications, latest notifications, **best-selling themes** in the store.
  If the customer's country is Egypt: their wallet payment requests and how to pay with a wallet.
- **My Themes**, **My Orders** (card orders and wallet payments with their status), **Favorites & Follows**,
  **Notifications**, **Feedback**, **Settings** (name, country, password, notification switches).

### 3.9 Feedback
- From the dashboard, the customer can send feedback to the owner: a subject and a message (e.g. a bug, a feature request, a question).
- They see their sent feedback and its status (Sent, Read, Resolved), and the owner's reply if there is one.

### 3.10 Refunds
- **Card (Polar):** the owner refunds in the Polar dashboard. Polar's webhook tells our server.
  A **full** refund removes access. A partial refund keeps access.
- **Wallet:** the owner sends the money back manually, then clicks **Mark as refunded** on the order. This removes access.

---

## 4. Admin features (`/admin`)

### 4.1 Dashboard
- **Sales:** number of orders and revenue for today, last 7 days, last 30 days, all time —
  shown **separately for USD (card) and EGP (wallet)**. Never mixed into one number.
- **Top themes:** by sales and by downloads (last 30 days and all time).
- **Waiting for you:** number of wallet payments to review, number of new feedback messages.
- **Latest activity:** the newest 20 entries of the activity log (4.8).

### 4.2 Themes, versions, categories
- **Themes:** create, edit, publish, unpublish. Fields: name, slug, tagline, description, price (USD), category,
  screenshots, demo URL, requirements, features list, featured.
- **Versions:** upload a new `.zip`, set version number and changelog, choose whether to notify people.
- **Categories:** create, edit, delete (only when empty).

### 4.3 Customers
- List with search (name or email) and filter (active / disabled).
- Customer page: details, country, owned themes, orders, wallet payments, feedback, recent activity.
- **Disable / enable account.** Disabling asks for a reason, logs the customer out everywhere, and blocks login.
  Enabling lets them log in again.
- **Give a theme** (manual grant with a note) and **remove a theme** (revoke access, with a reason).

### 4.4 Orders
- List of all orders (card and wallet) with filters: payment method, status, date range.
- Order page: amounts, coupon, customer, theme, provider IDs.
- Wallet orders have a **Mark as refunded** button.

### 4.5 Wallet payments
- List with tabs: **Waiting for review**, Approved, Rejected.
- Request page: customer, theme, amount in EGP, reference code, sender phone, transaction ID, screenshot,
  **Approve** and **Reject** (reason required).

### 4.6 Coupons
- Create, edit, disable. Percentage or fixed USD discount, on all themes or selected themes,
  optional expiry date and usage limit. Coupons work for both card and wallet payments.

### 4.7 Notifications (send)
- Write an announcement: title, message, optional link.
- Choose who gets it: **all customers**, **owners of a theme**, or **one customer**.
- Tick **Also send by email** (emails go only to customers who have announcements emails turned on).
- See a list of sent announcements with how many people received them.

### 4.8 Activity log
- A list of important events, newest first, with filters by type and by customer.
- Logged events: customer registered, order paid, order refunded, wallet payment submitted / approved / rejected,
  feedback sent, theme published / unpublished, version released, coupon created, account disabled / enabled,
  theme granted / revoked, announcement sent.
- Downloads are not in the activity log (there are too many); they are counted separately.

### 4.9 Feedback inbox
- List with tabs: New, Read, Resolved. Opening a message marks it Read.
- Reply (sent to the customer as a notification + email) and mark as Resolved.

### 4.10 Settings
- **Wallet payments:** on/off, USD → EGP exchange rate, and the list of wallet accounts
  (name, account number/address, instructions).

---

## 5. Other pages

- About, Contact (shows the owner's support email address — no contact form; feedback is for logged-in customers).
- Legal: Terms of Service, Privacy Policy, Refund Policy, License. The payment provider requires these pages.

---

## 6. NOT in the MVP

Do not build these.

- All-access / subscription plans
- Free themes
- Shopping cart / several themes in one checkout
- Automatic theme updates inside WordPress, license keys, license activation
- Multiple license tiers
- Product reviews and ratings
- Support tickets (feedback 3.9 is the only customer → owner channel)
- Affiliates, blog
- Multiple languages, RTL
- Automatic wallet payments (wallet payments are always approved by hand)
- Prices in currencies other than USD (EGP is only calculated for wallet payments)
- Other sellers / marketplace features
- Customer account deletion from the UI (handled by email request)
- Push notifications (browser/mobile)

---

## 7. The MVP is done when

1. The owner can add a theme with screenshots, a demo URL and a downloadable version from the admin panel.
2. A visitor can search and filter themes, see the demo, register, pay with a card through Polar, and download the zip.
3. A customer in Egypt can pay by wallet, the owner approves it, and the customer can download the zip.
4. A coupon lowers the price for both card and wallet payments.
5. Uploading a new version notifies owners and people who favorited the theme (in-app + email). Publishing a theme notifies category followers.
6. The owner can send an announcement and the right customers receive it.
7. The owner can disable an account, and that customer can no longer log in.
8. The admin dashboard shows correct sales, top themes and activity.
9. A full refund (Polar) or "Mark as refunded" (wallet) removes download access.
10. All automatic checks (lint, types, style check, tests, build, E2E) pass in GitHub Actions.
11. The site runs on the owner's DigitalOcean VPS over HTTPS.
