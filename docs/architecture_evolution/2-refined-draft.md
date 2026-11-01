
# Architecture Evolution — Refined Draft

**Project:** FieldDesk CRM — Business Rules Engine  
**Assignment:** Tejas AI Engineering  
**Status:** Refined after repository inspection  
**Version:** 0.2

## 1. Findings from Repository Inspection

The initial proposal identified the need for centralized command execution and domain-specific business services.

Repository inspection supports this direction. The application already separates business responsibilities across domains such as Orders, Fulfillment, Accounts, Credits, Rewards, Customers and Audit.

The architecture should preserve these boundaries rather than move all business logic into a single evaluator.

## 2. Refined Architectural Direction

The refined design uses:

1. A shared command contract for business mutations.
2. Centralized command execution and authorization.
3. Domain services that own their respective business rules.
4. Repositories that own persistence operations.
5. A common transaction boundary for coordinated mutations.
6. Audit and consistency checks before committing changes.

The command execution layer coordinates workflows, but domain services remain responsible for business decisions within their boundaries.

## 3. Rule Classification

| Rule category | Preferred owner |
|---|---|
| Authorization | Action execution and authorization layer |
| State transitions | Relevant domain model/service |
| Quantity constraints | Fulfillment and order domains |
| Financial invariants | Accounts and Credits |
| Reward calculations | Rewards |
| Cross-domain workflows | Command execution and coordinating services |
| Historical corrections | Relevant domain services with audit evidence |

This classification avoids duplicating rules across controllers and unrelated services.

## 4. Transaction Boundary

Operations that modify multiple domains should participate in one transaction.

For example, a delivery correction can affect fulfillment quantities, receivable charges, cash allocation and rewards. These changes must not be partially committed.

Likewise, a payment attribution correction must update both customer accounts consistently while retaining the original receipt as historical evidence.

## 5. Remaining Design Questions

- Which rules are genuinely reusable across domains?
- Which decisions require domain-specific logic?
- How should financial corrections preserve the original ledger history?
- How should failures roll back coordinated changes?
- Would a generic evaluator provide enough benefit to justify its complexity?

## 6. Refined Conclusion

The middle-ground architecture remains the preferred direction. The next stage should validate it against the two required correction workflows and the existing transaction and audit mechanisms.
