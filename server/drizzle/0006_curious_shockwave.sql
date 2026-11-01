CREATE TABLE `delivery_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`shipment_line_id` text NOT NULL,
	`order_id` text NOT NULL,
	`original_delivered_qty` integer NOT NULL,
	`corrected_delivered_qty` integer NOT NULL,
	`reason` text NOT NULL,
	`action_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shipment_line_id`) REFERENCES `shipment_lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "delivery_corrections_original_qty_check" CHECK(typeof("delivery_corrections"."original_delivered_qty") = 'integer' and "delivery_corrections"."original_delivered_qty" >= 0),
	CONSTRAINT "delivery_corrections_corrected_qty_check" CHECK(typeof("delivery_corrections"."corrected_delivered_qty") = 'integer' and "delivery_corrections"."corrected_delivered_qty" >= 0),
	CONSTRAINT "delivery_corrections_reduction_check" CHECK("delivery_corrections"."corrected_delivered_qty" < "delivery_corrections"."original_delivered_qty")
);
--> statement-breakpoint
CREATE INDEX `delivery_corrections_shipment_line_id_idx` ON `delivery_corrections` (`shipment_line_id`);--> statement-breakpoint
CREATE INDEX `delivery_corrections_order_id_idx` ON `delivery_corrections` (`order_id`);