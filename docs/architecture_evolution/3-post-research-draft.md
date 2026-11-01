
# Architecture Evolution — Post-Research Draft

**Project:** FieldDesk CRM — Business Rules Engine  
**Assignment:** Tejas AI Engineering  
**Status:** Design decisions informed by repository analysis and implementation  
**Version:** 0.3

## 1. Evidence from the Existing System

The repository already has distinct domain models, repositories and services. The command execution layer coordinates mutations, and the application uses a shared SQLite transaction boundary.

This structure provides a practical foundation for enforcing business rules without introducing a separate general-purpose rules platform.

The correction workflows also demonstrate why domain ownership matters: payment attribution is fundamentally an Accounts operation, while delivery correction belongs to Fulfillment and must coordinate with Accounts and Rewards.

## 2. Architecture Decision: Generic Engine or Middle Ground?

Three approaches were considered.

### Option A — Fully Generic Rules Engine

A generic engine could represent rules as configurable conditions and actions, evaluate them dynamically and potentially allow rules to be changed without modifying application code.

However, it would introduce additional concerns:

- A rule definition language and validation mechanism.
- Dynamic execution and debugging complexity.
- More difficult transaction and failure semantics.
- Risk of moving domain invariants outside the domain that owns them.
- Additional testing and maintenance overhead.

This approach is not justified by the current set of workflows.

### Option B — Middle-Ground Architecture

This approach centralizes command handling and coordination while retaining business rules in domain services and models.

Advantages:

- Clear ownership of business invariants.
- Existing transaction and repository mechanisms remain usable.
- Easier testing of individual domain behaviors.
- Cross-domain workflows can still be coordinated.
- No additional rule language or runtime is required.

### Option C — Distributed Conditional Logic

Rules could remain embedded in controllers and scattered service methods.

This would avoid introducing a new abstraction, but it risks duplicated conditions, inconsistent authorization and difficult-to-audit corrections.

## 3. Decision Tree

```text
Does the rule represent a domain invariant?
        |
       Yes
        |
        v
Keep it in the owning domain model/service.
        |
        v
Does the workflow affect multiple domains?
        |
       Yes
        |
        v
Coordinate through the command execution
and shared transaction boundary.

If the rule is a repeated, simple, domain-independent
condition, consider a reusable rule definition.

If the rule needs dynamic configuration, independent
rule authors, versioning or frequent runtime changes,
evaluate a dedicated generic rules engine.
```

## 4. FDSK-169 — Payment Attribution Correction

The original receipt should not be destructively reassigned.

The implemented approach preserves the original receipt and records a correction linking it to a destination receipt. Existing cash allocations are reversed through compensating allocation entries, and the destination receipt is allocated against the correct customer's charges.

Both customer accounts are updated and audited within the coordinated operation.

A receipt already reserved to fund a credit note is explicitly rejected by the current implementation. This avoids creating an unsupported reversal in the credit-funding ledger.

## 5. FDSK-170 — Delivery Confirmation Correction

The correction must distinguish the quantity actually delivered from the quantity dispatched.

For the example of ten dispatched units and six actually delivered, the recorded delivered quantity must become six, with four remaining available for a later delivery confirmation.

The correction must preserve the original business history and coordinate dependent account and reward updates.

## 6. Evaluation Criteria

The architectural options were considered against:

- Correctness of business invariants.
- Transactional consistency.
- Auditability and historical preservation.
- Ease of testing.
- Domain ownership and separation of concerns.
- Implementation complexity.
- Long-term maintainability.

The middle-ground approach offers the best balance for the current application.

## 7. Conclusion

The repository analysis and correction workflows support the original middle-ground hypothesis.

A fully generic rules engine is not necessary for the current scope. The application benefits more from explicit domain rules, centralized command coordination, shared transactions and auditable compensating corrections.
