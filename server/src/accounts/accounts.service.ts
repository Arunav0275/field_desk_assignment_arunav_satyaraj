import { ChargeBalance } from './accounts.model.js';
import { CreditBalance } from '../credits/credits.model.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CustomerSummary,
  LedgerView,
  CustomerAccountRow,
} from '@crm/shared/crm';
import { CustomersRepository } from '../customers/customers.repository.js';
import { AccountsRepository } from '../accounts/accounts.repository.js';
import { RewardsService } from '../rewards/rewards.service.js';
import { CreditsRepository } from '../credits/credits.repository.js';
import { RewardsRepository } from '../rewards/rewards.repository.js';
import { ReturnsRepository } from '../returns/returns.repository.js';
import { FulfillmentRepository } from '../fulfillment/fulfillment.repository.js';
import { DatabaseService } from '../database/database.service.js';
import type { ActionContext as Context, Payload } from '../common/domain.js';
import { authorize, useCustomer, fail, safe } from '../common/domain.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly rewardsService: RewardsService,
    private readonly creditsRepository: CreditsRepository,
    private readonly rewardsRepository: RewardsRepository,
    private readonly returnsRepository: ReturnsRepository,
    private readonly fulfillmentRepository: FulfillmentRepository,
    private readonly database: DatabaseService,
  ) {}
  receive(c: Context, p: Payload<'RECEIVE_CUSTOMER_PAYMENT'>) {
    authorize(c, 'ACCOUNTS', 'ADMIN');
    useCustomer(c, this.customersRepository.findById(p.customerId));
    const receiptId = randomUUID();
    c.references.receiptId = receiptId;
    this.accountsRepository.insertReceipt(c, {
      id: receiptId,
      customer_id: c.customerId,
      amount_paise: p.amountPaise,
      reference: p.reference,
      action_id: c.id,
      created_at: c.now,
    });

    this.allocateCash(c);

    this.rewardsService.refresh(c);
  }
  allocate(c: Context, p: Payload<'ALLOCATE_PAYMENT'>) {
    authorize(c, 'ACCOUNTS', 'ADMIN');
    useCustomer(c, this.customersRepository.findById(p.customerId));

    this.allocateCash(c);

    this.rewardsService.refresh(c);
  }

  correctPaymentAttribution(
    c: Context,
    p: Payload<'CORRECT_PAYMENT_ATTRIBUTION'>,
  ) {
    authorize(c, 'ACCOUNTS', 'ADMIN');

    const sourceCustomer = this.customersRepository.findById(p.customerId);
    const targetCustomer = this.customersRepository.findById(
      p.correctCustomerId,
    );

    if (!sourceCustomer || !targetCustomer)
      fail('CUSTOMER_NOT_FOUND', 'Both customers must exist');

    if (sourceCustomer.id === targetCustomer.id)
      fail('INVALID_CORRECTION', 'Source and destination customers must differ');

    if (c.customerId !== sourceCustomer.id)
      fail('CUSTOMER_MISMATCH', 'The source customer does not match the action');

    const receipt = this.accountsRepository.findReceipt(p.receiptId);

    if (!receipt || receipt.customer_id !== sourceCustomer.id)
      fail('RECEIPT_NOT_FOUND', 'Select a receipt belonging to the source customer');

    const alreadyTransferred =
      this.accountsRepository.correctedOutForReceipt(receipt.id);

    const remaining =
      receipt.amount_paise - alreadyTransferred;

    if (p.amountPaise > remaining)
      fail('AMOUNT_EXCEEDED', 'The correction exceeds the remaining receipt amount');

    if (this.creditsRepository.reservedFromReceipt(receipt.id) > 0)
      fail(
        'CREDIT_FUNDED_RECEIPT',
        'This receipt funds a credit note and cannot currently be transferred',
      );

    const allocations =
      this.accountsRepository.allocationsForReceipt(receipt.id);

    const netByCharge = new Map<string, number>();

    for (const allocation of allocations) {
      netByCharge.set(
        allocation.charge_id,
        (netByCharge.get(allocation.charge_id) ?? 0) +
          allocation.amount_paise,
      );
    }

    let amountToReverse = p.amountPaise;

    for (const [chargeId, netAmount] of netByCharge) {
      if (amountToReverse <= 0) break;
      if (netAmount <= 0) continue;

      const charge = this.accountsRepository.findCharge(chargeId);

      if (!charge || charge.customer_id !== sourceCustomer.id)
        fail(
          'ALLOCATION_MISMATCH',
          'A receipt allocation belongs to another customer',
        );

      const reversalAmount = Math.min(netAmount, amountToReverse);

      this.accountsRepository.insertAllocation(c, {
        id: randomUUID(),
        customer_id: sourceCustomer.id,
        receipt_id: receipt.id,
        charge_id: chargeId,
        amount_paise: -reversalAmount,
        action_id: c.id,
        created_at: c.now,
      });

      amountToReverse -= reversalAmount;
    }

    if (amountToReverse > 0) {
      const unappliedCash =
        receipt.amount_paise -
        alreadyTransferred -
        this.accountsRepository.allocatedFromReceipt(receipt.id);

      if (amountToReverse > unappliedCash)
        fail(
          'ALLOCATION_MISMATCH',
          'The receipt does not have enough allocated or unapplied cash to reverse',
        );
    }

    const destinationReceiptId = randomUUID();

    this.accountsRepository.insertReceipt(c, {
      id: destinationReceiptId,
      customer_id: targetCustomer.id,
      amount_paise: p.amountPaise,
      reference: `Attribution correction from receipt ${receipt.id}`,
      action_id: c.id,
      created_at: c.now,
    });

    const correctionId = randomUUID();

    this.accountsRepository.insertAttributionCorrection(c, {
      id: correctionId,
      receipt_id: receipt.id,
      destination_receipt_id: destinationReceiptId,
      source_customer_id: sourceCustomer.id,
      correct_customer_id: targetCustomer.id,
      amount_paise: p.amountPaise,
      reason: p.reason,
      action_id: c.id,
      created_at: c.now,
    });

    c.references.receiptId = receipt.id;
    c.references.correctionId = correctionId;

    this.allocateCashForCustomer(c, sourceCustomer.id);

    this.rewardsService.refresh(c);

    const originalCustomerId = c.customerId;

    try {
      c.customerId = targetCustomer.id;
      this.allocateCashForCustomer(c, targetCustomer.id);
      this.rewardsService.refresh(c);
    } finally {
      c.customerId = originalCustomerId;
    }
  }

  allocateCash(c: Context) {
    this.allocateCashForCustomer(c, c.customerId);
  }

  private allocateCashForCustomer(c: Context, customerId: string) {
    for (const receipt of this.accountsRepository.receiptsForCustomer(
      customerId,
    )) {
      let available =
        receipt.amount_paise -
        this.accountsRepository.correctedOutForReceipt(receipt.id) -
        this.accountsRepository.allocatedFromReceipt(receipt.id) -
        this.creditsRepository.reservedFromReceipt(receipt.id);

      if (available < 0)
        fail('RECEIPT_MISMATCH', 'Receipt allocations exceed captured funds');

      for (const charge of this.accountsRepository.chargesInDueOrder(
        customerId,
      )) {
        if (!available) break;

        const face =
          charge.amount_paise +
          this.accountsRepository.adjustmentsForCharge(charge.id);
        const cash = this.accountsRepository.cashForCharge(charge.id);
        const credit = this.creditsRepository.appliedToCharge(charge.id);
        const redeemed = this.rewardsRepository.redeemedForCharge(charge.id);

        const take = Math.min(
          available,
          Math.max(0, face - cash - credit - redeemed),
        );

        if (take)
          this.accountsRepository.insertAllocation(c, {
            id: randomUUID(),
            customer_id: customerId,
            receipt_id: receipt.id,
            charge_id: charge.id,
            amount_paise: take,
            action_id: c.id,
            created_at: c.now,
          });

        available -= take;
      }
    }
  }
  summary(customerId: string): CustomerSummary {
    const customer = this.customersRepository.findById(customerId);
    if (!customer) throw new NotFoundException('Customer not found');
    const charges = this.accountsRepository
      .chargesForCustomer(customerId)
      .map((charge) => {
        const remainingPaise =
          charge.amount_paise +
          this.accountsRepository.adjustmentsForCharge(charge.id);
        const cashPaidPaise = this.accountsRepository.cashForCharge(charge.id);
        const credit = this.creditsRepository.appliedToCharge(charge.id);
        const redeemed = this.rewardsRepository.redeemedForCharge(charge.id);
        return {
          ...charge,
          remainingPaise,
          cashPaidPaise,
          outstandingPaise: new ChargeBalance(
            remainingPaise,
            cashPaidPaise,
            credit,
            redeemed,
          ).outstandingPaise,
        };
      });
    const credits = this.creditsRepository
      .creditsForCustomer(customerId)
      .map((note) => {
        const appliedPaise = this.creditsRepository.appliedFromCredit(note.id);
        const refundedPaise = this.creditsRepository.refundedFromCredit(
          note.id,
        );
        return {
          ...note,
          appliedPaise,
          refundedPaise,
          availablePaise: new CreditBalance(
            note.amount_paise,
            appliedPaise,
            refundedPaise,
          ).availablePaise,
        };
      });
    const receipts = this.accountsRepository.receiptsByInsertion(customerId);
    const unappliedCashPaise = safe(
      receipts.reduce(
        (sum, receipt) =>
          sum +
          receipt.amount_paise -
          this.accountsRepository.correctedOutForReceipt(receipt.id) -
          this.accountsRepository.allocatedFromReceipt(receipt.id) -
          this.creditsRepository.reservedFromReceipt(receipt.id),
        0,
      ),
    );
    const receivedPaise = safe(
      this.accountsRepository.receivedForCustomer(customerId) -
      this.accountsRepository.correctedOutForCustomer(customerId),
    );
    const refundsPaise = this.creditsRepository.refundedForCustomer(customerId);
    const redemption = this.rewardsRepository.redeemedForCustomer(customerId);
    const netBalancePaise = safe(
      this.accountsRepository.postedForCustomer(customerId) -
        receivedPaise +
        refundsPaise -
        redemption,
    );
    return {
      customer,
      charges,
      credits,
      netBalancePaise,
      unappliedCashPaise,
      receivedPaise,
      refundsPaise,
      outstandingPaise: safe(
        charges.reduce((sum, row) => sum + row.outstandingPaise, 0),
      ),
      creditsOpenPaise: safe(
        credits.reduce((sum, row) => sum + row.availablePaise, 0),
      ),
      points: this.rewardsService.balances(customerId),
    };
  }
  ledger(customerId: string): LedgerView {
    this.summary(customerId);
    return {
      finance: this.accountsRepository.entriesForCustomer(customerId),
      receipts: this.accountsRepository.receiptsByInsertion(customerId),
      allocations: this.accountsRepository.allocationsForCustomer(customerId),
      creditApplications:
        this.creditsRepository.applicationsForCustomer(customerId),
      credits: this.creditsRepository.creditsForCustomer(customerId),
      refunds: this.creditsRepository.refundsForCustomer(customerId),
      redemptions: this.rewardsRepository.redemptionsForCustomer(customerId),
      rewards: this.rewardsRepository.entriesForCustomer(customerId),
      returns: this.returnsRepository.forCustomer(customerId),
      corrections:
        this.fulfillmentRepository.correctionsForCustomer(customerId),
    };
  }
  accounts(): CustomerAccountRow[] {
    return this.database.db.transaction(() =>
      this.customersRepository.list().map((customer) => {
        const summary = this.summary(customer.id);
        return {
          customer,
          netBalancePaise: summary.netBalancePaise,
          outstandingPaise: summary.outstandingPaise,
          unappliedCashPaise: summary.unappliedCashPaise,
          creditsOpenPaise: summary.creditsOpenPaise,
        };
      }),
    );
  }
}
