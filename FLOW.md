# Project flow — diagrams

Visual summary of the plan in `docs/`. Paste any block into a Mermaid renderer (GitHub, VS Code, mermaid.live).
If a diagram and a doc disagree, **the doc wins** — tell the planner so the diagram gets fixed.

---

## 1. The big picture — who talks to whom

```mermaid
flowchart LR
    C["Customer browser"]
    A["Admin browser (you)"]

    subgraph VPS["DigitalOcean VPS"]
        N["Next.js app<br/>pages + server actions + 3 API routes"]
        CR["Server cron<br/>every minute"]
    end

    DB[("MongoDB Atlas<br/>all data")]
    RP[("R2 private bucket<br/>zips + wallet screenshots")]
    RI[("R2 public bucket<br/>theme images")]
    P["Polar<br/>card payments"]
    E["Resend<br/>emails"]
    W["WordPress demo sites<br/>separate server"]

    C -->|pages, forms| N
    A -->|admin panel| N
    N <--> DB
    N -->|signed links only| RP
    C -->|upload screenshot / download zip<br/>with signed link| RP
    A -->|upload zip / images<br/>with signed link| RP
    A -->|upload images| RI
    C -->|view images| RI
    C -->|pays| P
    P -->|webhook: paid / refunded| N
    N -->|create products, discounts, checkouts| P
    N -->|send| E
    CR -->|/api/cron/process-notifications| N
    C -->|live demo in iframe| W
```

---

## 2. Customer journey — from visit to download

```mermaid
flowchart TD
    V["Visitor opens the store"] --> B["Browse / search / filter by category"]
    B --> T["Theme page<br/>screenshots, changelog, price"]
    T --> D["Live demo preview"]
    T --> BUY["Click Buy"]
    D --> BUY
    BUY --> L{"Logged in and<br/>email verified?"}
    L -- no --> REG["Register or log in<br/>email+password or Google<br/>verify email"]
    REG --> CO
    L -- yes --> OWN{"Already owns it?"}
    OWN -- yes --> MY["My Themes"]
    OWN -- no --> CO["Our checkout page /checkout/slug<br/>coupon field, price summary"]
    CO --> M{"Payment method"}
    M -- "Card (everyone)" --> CARD["Pay on Polar"]
    M -- "Wallet (Egypt only, if enabled)" --> WAL["Wallet page<br/>EGP amount + reference TS-XXXXXX"]
    CARD --> WH["Polar webhook → order + ownership"]
    WAL --> TR["Customer transfers money<br/>Vodafone Cash / InstaPay"]
    TR --> UP["Uploads screenshot + phone number"]
    UP --> REV{"You review in admin"}
    REV -- approve --> OW2["Order + ownership created<br/>email + notification"]
    REV -- reject --> REJ["Customer sees the reason<br/>email + notification"]
    WH --> MY
    OW2 --> MY
    MY --> DL["Click Download"]
    DL --> ZIP["Signed link (5 min) → zip from R2"]
```

---

## 3. Card payment (Polar)

```mermaid
sequenceDiagram
    actor C as Customer
    participant N as Next.js
    participant DB as MongoDB
    participant P as Polar

    C->>N: Checkout page, coupon, "Pay by card"
    N->>DB: Theme published? not owned? coupon valid?
    N->>P: createCheckout(product, discount, metadata userId/themeId)
    P-->>N: checkout URL
    N-->>C: redirect to Polar
    C->>P: pays
    P-->>C: redirect to /checkout/success
    C->>N: success page ("Confirming your payment…", refreshes every 3 s)
    P->>N: webhook order.paid (signed)
    N->>N: verify signature, skip if already processed
    N->>DB: transaction: order + ownership + salesCount + coupon count + activity log
    C->>N: refresh
    N-->>C: "Thank you! Theme is yours." + Download button
```

---

## 4. Egyptian wallet payment (manual)

```mermaid
sequenceDiagram
    actor C as Customer (Egypt)
    participant N as Next.js
    participant DB as MongoDB
    participant R as R2 private
    actor A as Admin (you)

    C->>N: Checkout → "Pay by wallet"
    N->>DB: create walletPayment (amountEgp, reference TS-XXXXXX)
    N-->>C: wallet page: amount, reference, your wallet accounts
    C->>C: sends money in the wallet app, writes the reference
    C->>N: ask upload URL (type, size)
    N-->>C: signed PUT URL (10 min)
    C->>R: uploads screenshot directly
    C->>N: submit (phone, transaction id, screenshot key)
    N->>R: HEAD: file exists, right type and size?
    N->>DB: status = submitted
    N-->>A: email "New wallet payment to review"
    A->>N: open review page (screenshot via 5-min signed link)
    A->>A: checks money really arrived (amount + reference)
    alt approve
        A->>N: Approve
        N->>DB: transaction: approved + order (EGP) + ownership + notification + log
        N-->>C: approval email
    else reject
        A->>N: Reject with reason
        N->>DB: rejected + notification + log
        N-->>C: rejection email with the reason
    end
```

---

## 5. Admin releases a new version → people get notified

```mermaid
sequenceDiagram
    actor A as Admin
    participant N as Next.js
    participant R as R2 private
    participant DB as MongoDB
    participant CR as Cron (every minute)
    participant E as Resend

    A->>N: version form: 1.4.1, changelog, zip, "notify" ✔
    N-->>A: signed PUT URL (30 min)
    A->>R: uploads zip directly (progress bar)
    A->>N: create version
    N->>R: HEAD (exists, ≤ 200 MB) + read whole file (SHA-256, is it a zip?)
    N->>DB: transaction: version + theme.latestVersion + notification job + log
    N-->>A: "Version 1.4.1 released. Notifications are being sent."
    loop until the job is done
        CR->>N: /api/cron/process-notifications (secret)
        N->>DB: next batch: theme owners, then people who favorited
        N->>DB: in-app notifications
        N->>E: emails (only users with that email switch on)
    end
```

---

## 6. Download

```mermaid
sequenceDiagram
    actor C as Customer
    participant N as /api/downloads/versionId
    participant DB as MongoDB
    participant R as R2 private

    C->>N: click Download (plain link)
    alt not logged in
        N-->>C: redirect to login
    else no active ownership
        N-->>C: redirect to My Themes with "You do not own this theme."
    else more than 30 downloads in the last hour
        N-->>C: redirect to My Themes with "too many downloads"
    else OK
        N->>DB: downloadLog + theme downloadCount + 1
        N-->>C: redirect to signed URL (5 min) "aurora-blog-1.4.1.zip"
        C->>R: downloads the zip (free on R2)
    end
```

---

## 7. Refunds

```mermaid
flowchart LR
    subgraph Card
        P1["You refund in Polar dashboard"] --> P2["Polar webhook order.refunded"]
        P2 --> P3{"Full refund?"}
        P3 -- yes --> REV["Ownership revoked<br/>salesCount − 1<br/>no more downloads"]
        P3 -- "no (partial)" --> KEEP["Access kept"]
    end
    subgraph Wallet
        W1["You send money back by hand"] --> W2["Click 'Mark as refunded'"]
        W2 --> REV
    end
```

---

## 8. Status rules

### Wallet payment

```mermaid
stateDiagram-v2
    [*] --> awaiting_payment: customer starts
    awaiting_payment --> submitted: customer uploads proof
    awaiting_payment --> cancelled: customer cancels
    submitted --> approved: admin approves
    submitted --> rejected: admin rejects with reason
    approved --> [*]
    rejected --> [*]
    cancelled --> [*]
```

### Theme

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> published: has a version + 1 image + Polar product
    published --> unpublished
    unpublished --> published: same checks
    note right of published
        First publish notifies category followers.
        Unpublished = hidden from the store,
        owners can still download.
    end note
```

---

## 9. How the code is organised

```mermaid
flowchart TD
    subgraph app["src/app — thin routes"]
        PG["Pages"]
        RH["3 route handlers<br/>webhook, downloads, cron"]
    end
    subgraph feature["src/features/&lt;feature&gt;"]
        ACT["actions.ts<br/>auth → validate → service"]
        SVC["service.ts<br/>business rules<br/>(no Next.js imports)"]
        REPO["repository.ts<br/>all DB queries"]
        MOD["model.ts<br/>Mongoose schema"]
        COMP["components/<br/>layout classes only"]
    end
    subgraph shared["src/shared"]
        UI["ui/ + layout/<br/>ALL visual styling"]
        TOK["styles/tokens.css<br/>colors, fonts"]
        STO["storage/s3.ts<br/>only R2 code"]
        ENV["config/env.ts<br/>only env reader"]
    end

    PG --> SVC
    PG --> COMP
    ACT --> SVC
    RH --> SVC
    SVC --> REPO --> MOD
    SVC -->|other features only via their service| SVC
    SVC --> STO
    COMP --> UI --> TOK
```

---

## 10. Data model

```mermaid
erDiagram
    USER ||--o{ OWNERSHIP : has
    THEME ||--o{ OWNERSHIP : "owned by"
    USER ||--o{ ORDER : places
    THEME ||--o{ ORDER : "sold in"
    COUPON |o--o{ ORDER : "used in"
    ORDER ||--o| OWNERSHIP : grants
    USER ||--o{ WALLET_PAYMENT : starts
    WALLET_PAYMENT ||--o| ORDER : "approved into"
    CATEGORY ||--o{ THEME : contains
    THEME ||--o{ THEME_VERSION : has
    USER ||--o{ FAVORITE : "favorites theme / follows category"
    USER ||--o{ NOTIFICATION : receives
    NOTIFICATION_JOB ||--o{ NOTIFICATION : creates
    USER ||--o{ FEEDBACK : sends
    USER ||--o{ DOWNLOAD_LOG : downloads
    THEME_VERSION ||--o{ DOWNLOAD_LOG : "downloaded as"
    USER ||--o{ ACTIVITY_LOG : "is subject of"
```
