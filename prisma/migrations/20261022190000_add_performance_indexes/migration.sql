-- CreateIndex
CREATE INDEX "products_seller_id_available_deleted_at_idx" ON "products"("seller_id", "available", "deleted_at");

-- CreateIndex
CREATE INDEX "orders_seller_id_created_at_idx" ON "orders"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_seller_id_state_idx" ON "orders"("seller_id", "state");

-- CreateIndex
CREATE INDEX "messages_seller_id_created_at_idx" ON "messages"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_order_id_idx" ON "messages"("order_id");

-- CreateIndex
CREATE INDEX "messages_recipient_phone_idx" ON "messages"("recipient_phone");
