# Architecture Evolution — First Draft

**Project:** FieldDesk CRM — Business Rules Engine  
**Assignment:** Tejas AI Engineering  
**Status:** Initial proposal  
**Version:** 0.1

## 1. Problem Understanding

FieldDesk CRM manages sales orders, fulfillment, customer accounts, payments, credits and rewards.

These domains are interconnected. An operation in one domain can affect the state and financial records of other domains.

For example, confirming a delivery can:
- Increase the customer's receivable balance.
- Trigger allocation of available customer cash.
- Change the customer's reward eligibility.
- Affect the order's fulfillment status.

As the number of actors, actions, entities and possible states increases, business logic can become distributed across multiple services and conditional branches.

This makes business rules difficult to review, test and modify.

The objective is to organize business rules so that they are explicit, reusable where appropriate, and maintainable without introducing unnecessary framework complexity.

## 2. Initial Architectural Hypothesis

My initial proposal is a middle-ground architecture combining:

1. Centralized command execution.
2. Domain-specific business services.
3. Explicit state transition validation.
4. Reusable business rule definitions.
5. Transactional coordination of cross-domain operations.
6. Auditable correction mechanisms.

I do not initially propose implementing a completely generic rules engine.

The complexity and maintenance cost of such a framework must first be justified by the actual business workflows.

## 3. Proposed High-Level Architecture

The proposed execution flow is:

```text
Incoming Business Command
          |
          v
   Command Validation
          |
          v
    Authorization
          |
          v
  State and Rule Evaluation
          |
          v
   Domain Service Execution
          |
          v
 Cross-Domain Coordination
          |
          v
 Financial and Reward Updates
          |
          v
     Audit Validation
          |
          v
       Transaction Commit
```

Each domain remains responsible for its own business rules and invariants.

The command execution layer coordinates operations without owning all business logic.

## 4. Domain Responsibilities

| Domain | Responsibility |
|---|---|
| Orders | Order revisions, approval and cancellation |
| Fulfillment | Loading, dispatch and delivery |
| Accounts | Receipts, allocations and financial charges |
| Credits | Credit notes, applications and refunds |
| Rewards | Reward entitlement, earning and recovery |
| Customers | Customer records and account boundaries |
| Actions | Command execution and cross-domain coordination |
| Audit | Historical activity and consistency checks |

## 5. Initial Approach to the Required Features

### FDSK-169 — Move Payment to the Correct Customer

The system should support correcting the customer attribution of a payment.

The operation must preserve financial history and maintain customer account boundaries.

Initial considerations:
- Identify the original receipt.
- Identify existing cash allocations.
- Correct the original customer's account.
- Attribute the payment to the correct customer.
- Reconcile allocations and dependent financial records.
- Preserve the complete audit trail.

The exact ledger representation requires further investigation.

### FDSK-170 — Correct an Overstated Delivery Confirmation

The system should support correcting an incorrectly recorded delivery quantity.

For example, if ten units were recorded as delivered but only six reached the customer, the system should recognize six delivered units and leave four units available for subsequent delivery confirmation.

Initial considerations:
- Identify the original delivery confirmation.
- Validate the corrected quantity against dispatched quantity.
- Preserve the original delivery history.
- Reconcile the associated receivable charges.
- Recalculate affected customer payment allocations and rewards.
- Preserve the ability to confirm the remaining quantity later.

The exact correction and financial adjustment mechanism requires further investigation.

## 6. Business Rule Representation

I propose separating business rules from HTTP controllers and avoiding repeated conditional logic.

Potential categories include:

- Authorization rules.
- State transition rules.
- Quantity invariants.
- Financial invariants.
- Cross-domain workflow rules.
- Correction and reversal rules.

Reusable rule definitions may be introduced for conditions that appear across multiple workflows.

Complex domain operations should remain in their respective domain services.

## 7. Transaction Management

Operations that affect multiple business domains should execute within a consistent transaction boundary.

A failed operation must not leave partially updated customer accounts, shipment records or reward balances.

Historical business and financial records should be preserved through linked corrections or compensating entries rather than destructive updates.

## 8. Initial Design Questions

The following questions require further investigation:

1. Which existing rules are duplicated across services?
2. Which rules can be represented declaratively?
3. Which rules require specialized domain logic?
4. How are cross-domain dependencies currently coordinated?
5. How are financial allocations reversed or restored?
6. How can corrections preserve historical records?
7. When does a generic rule evaluator become worthwhile?
8. How should ambiguous correction requests be handled?

## 9. Next Steps

The next stage will involve inspecting the existing implementation in detail.

I will examine:
- The canonical business rules.
- ActionsService and its transaction boundary.
- Domain services and repositories.
- Database entities and relationships.
- Existing workflow tests.
- Existing authorization and audit mechanisms.

The architecture will then be refined using evidence from the actual codebase.

---

**Status:** This is an initial architectural hypothesis, not the final design. Decisions will be revised as repository analysis and implementation research progress.