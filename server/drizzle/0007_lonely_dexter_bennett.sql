CREATE TABLE `payment_attribution_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`source_customer_id` text NOT NULL,
	`correct_customer_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`reason` text NOT NULL,
	`action_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`correct_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_attribution_corrections_amount_check" CHECK(typeof("payment_attribution_corrections"."amount_paise") = 'integer' and "payment_attribution_corrections"."amount_paise" > 0),
	CONSTRAINT "payment_attribution_corrections_distinct_customers_check" CHECK("payment_attribution_corrections"."source_customer_id" <> "payment_attribution_corrections"."correct_customer_id")
);
--> statement-breakpoint
CREATE INDEX `payment_attribution_corrections_receipt_id_idx` ON `payment_attribution_corrections` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `payment_attribution_corrections_source_customer_idx` ON `payment_attribution_corrections` (`source_customer_id`);--> statement-breakpoint
CREATE INDEX `payment_attribution_corrections_correct_customer_idx` ON `payment_attribution_corrections` (`correct_customer_id`);