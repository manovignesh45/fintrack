ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(255);
ALTER TABLE transaction_templates ADD COLUMN payment_method VARCHAR(255);

UPDATE transactions t
SET payment_method = pm.name
FROM payment_methods pm
WHERE t.payment_method_id = pm.id;

UPDATE transaction_templates tt
SET payment_method = pm.name
FROM payment_methods pm
WHERE tt.payment_method_id = pm.id;

ALTER TABLE transactions DROP COLUMN payment_method_id;
ALTER TABLE transaction_templates DROP COLUMN payment_method_id;

DROP TABLE payment_methods;
