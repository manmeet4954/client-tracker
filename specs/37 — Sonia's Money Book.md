# 37 — Sonia's Money Book

**Written:** 2026-09-07
**Status:** written, building same session
**Ordered by:** Manmeet, for her mother's account (Sonia's Crochet, `bysoniacrochet`)

---

## 1. Her words

> "Can you build a balance sheet kind of thing, or some interface where she can
> record the revenue and the expenses? She can also understand how much money
> she is making monthly and how much she is spending... she is just writing it,
> adding the amount, and selecting if it's an income or an expense. It's getting
> recorded, and then there is a very simple balance sheet telling her how much
> is there. The revenue part also includes the things that are yet to be
> received. We have to keep the interface very simple, yet it should work
> nicely."

The reader who matters is her mother. Large controls, plain words, honest to
write into.

---

## 2. What already exists, and what is new

- **Orders:** already recorded (customer, items, amount, payment status). This
  spec does NOT touch orders and does NOT auto-link to them. Her instruction was
  a simple, separate, manual ledger. Linking orders to the book is a later step
  if she asks.
- **Revenue as a number:** never existed anywhere, not even on the owner side.
  It was only ever the order list, read by eye.
- **Expenses:** never existed at all. Fully new.

## 3. The regression this also fixes

Found while building: the spec 36 §8 privacy strip (`withoutHerSlices`, added
2026-08-17) blanks `orders` from every login whose binding kind is `client`.
Sonia's binding IS `client` (`legacyBindings.ts`). So since 08-17 her own Orders
tab has been served empty. That is the "not visible on her end" she reported.

The strip is right for a CONTENT client (Merushri viewing Career Bubble must not
receive Manmeet's private order tracking on that profile). It is wrong for
Sonia, whose whole workspace IS orders. Fix: a login that `staysOnLegacy` keeps
its shop slices (`orders`, and the new `ledger`). The truly private slices
(`brand.strategy`, `coldCalls`, `leadAnswers`, `observations`, `momentum`) stay
stripped for everyone but the owner.

## 4. The data

One new legacy slice on `ClientData`, mirroring how `orders` is wired.

```ts
export interface LedgerEntry {
  id: string;
  note: string;                    // "Sold 2 scarves", "Yarn from market"
  amount: number;
  kind: 'income' | 'expense';
  received: boolean;               // income only; expense ignores it
  month: string;                   // 'YYYY-MM', the month it belongs to
  createdAt: string;
}
```

`ClientData.ledger: LedgerEntry[]`.

**Address (law 4):** it rides the orders write-scope,
`work-log/logs/pipelines/orders`, rather than minting a new switch and
declaration. Both are Sonia's-shop legacy slices under logs, saved by the same
login; sharing the scope means a ledger write batches with orders with no data
loss (applyScopes takes both slices from the merged state). No new switch is
introduced, because nothing about the money book's visibility is decided by the
plug system — Sonia is on the legacy workspace, whose tabs are chosen by role.

## 5. The interface

A new **Money** tab in Sonia's legacy workspace, beside Orders and Catalogue.

**Record — one box, saves on the choice, no submit.**
- What it was (text)
- Amount (numeric, large)
- Income or Expense (two big buttons)
- If Income: Got it / Still to come (default: Got it)

**The balance sheet — one screen, the selected month.**
- Big: **Money in hand** = received income − expenses.
- Received this month.
- Still to come (pending income).
- Spent this month.
- Reads as one sentence: "I have ₹X in hand, ₹Y is still coming, I spent ₹Z."
- Month arrow to look back.
- Entry list below, newest first; tap to edit the amount or delete (confirmed).

## 6. Who sees it

Sonia, on her legacy workspace. The owner sees it too, on Sonia's profile, the
same way the owner sees Orders. No other client has a `ledger` (only Sonia's
profile), and the strip keeps it that way.

## 7. Acceptance

1. Sonia records an income and an expense; both appear and persist across a
   reload.
2. The month total reads correctly: in hand = received − spent; still-to-come is
   the pending income; changing an income from "still to come" to "got it" moves
   it into in-hand.
3. Sonia's Orders tab shows her orders again (the regression is gone).
4. A different client login (not Sonia) receives no `ledger` and no `orders`.
5. Delete removes an entry and the totals update.
6. `npm test` green, typecheck clean, build green, checked in a browser.
