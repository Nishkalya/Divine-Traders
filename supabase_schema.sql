-- Divine Traders ERP - Redesigned Normalized PostgreSQL Schema
-- Copy and run this script in your Supabase SQL Editor to provision all tables, triggers, views, and RLS policies.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing views if they exist to avoid conflict
DROP VIEW IF EXISTS warehouse_stock_valuation CASCADE;
DROP VIEW IF EXISTS monthly_purchase_summary CASCADE;
DROP VIEW IF EXISTS monthly_sales_summary CASCADE;
DROP VIEW IF EXISTS low_stock_alerts CASCADE;

-- Drop existing tables if they exist to ensure clean initialization
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS taxes CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS vendor_payments CASCADE;
DROP TABLE IF EXISTS customer_payments CASCADE;
DROP TABLE IF EXISTS sales_invoice_items CASCADE;
DROP TABLE IF EXISTS sales_invoices CASCADE;
DROP TABLE IF EXISTS purchase_return_items CASCADE;
DROP TABLE IF EXISTS purchase_returns CASCADE;
DROP TABLE IF EXISTS goods_receipt_items CASCADE;
DROP TABLE IF EXISTS goods_receipts CASCADE;
DROP TABLE IF EXISTS purchase_bill_items CASCADE;
DROP TABLE IF EXISTS purchase_bills CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

-- Also drop dynamic settings/configs tables if any
DROP TABLE IF EXISTS company_profiles CASCADE;
DROP TABLE IF EXISTS erp_settings CASCADE;
DROP TABLE IF EXISTS unit_conversions CASCADE;
DROP TABLE IF EXISTS custom_units CASCADE;
DROP TABLE IF EXISTS sales_assignees CASCADE;
DROP TABLE IF EXISTS production_runs CASCADE;
DROP TABLE IF EXISTS stock_transfers CASCADE;
DROP TABLE IF EXISTS funding_partners CASCADE;
DROP TABLE IF EXISTS funding_transactions CASCADE;
DROP TABLE IF EXISTS backup_settings CASCADE;

-- 1. Helper trigger function to update updated_at timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';


-- 2. CORE MASTER TABLES
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    opening_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    opening_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit TEXT NOT NULL,
    purchase_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    stock_quantity NUMERIC DEFAULT 0,
    min_stock_level NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    status TEXT DEFAULT 'Active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 3. STOCK & INVENTORY
CREATE TABLE stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT unique_product_warehouse UNIQUE (product_id, warehouse_id)
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'In', 'Out', 'Adjustment'
    quantity NUMERIC NOT NULL,
    reference_type TEXT NOT NULL, -- 'GRN', 'Sale Invoice', 'Adjustment', 'Opening', 'Stock Transfer', 'Purchase Return', 'Production'
    reference_id UUID,
    notes TEXT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 4. PURCHASING MODULE
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_amount NUMERIC DEFAULT 0 NOT NULL,
    status TEXT NOT NULL, -- 'Draft', 'Approved', 'Partially Received', 'Received', 'Closed'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE purchase_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    goods_receipt_id UUID, -- reference identifier for GRN
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC DEFAULT 0 NOT NULL,
    cgst NUMERIC DEFAULT 0 NOT NULL,
    sgst NUMERIC DEFAULT 0 NOT NULL,
    igst NUMERIC DEFAULT 0 NOT NULL,
    total_amount NUMERIC DEFAULT 0 NOT NULL,
    status TEXT NOT NULL, -- 'Unpaid', 'Partially Paid', 'Paid'
    paid_amount NUMERIC DEFAULT 0 NOT NULL,
    invoice_type TEXT DEFAULT 'GST' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE purchase_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number TEXT NOT NULL UNIQUE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    received_by TEXT NOT NULL,
    notes TEXT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity_received NUMERIC NOT NULL,
    unit TEXT,
    rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE purchase_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT NOT NULL UNIQUE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    purchase_bill_id UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    subtotal NUMERIC DEFAULT 0 NOT NULL,
    cgst NUMERIC DEFAULT 0 NOT NULL,
    sgst NUMERIC DEFAULT 0 NOT NULL,
    igst NUMERIC DEFAULT 0 NOT NULL,
    total_amount NUMERIC DEFAULT 0 NOT NULL,
    notes TEXT,
    status TEXT NOT NULL, -- 'Draft', 'Returned'
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE purchase_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 5. SALES MODULE
CREATE TABLE sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    subtotal NUMERIC DEFAULT 0 NOT NULL,
    cgst NUMERIC DEFAULT 0 NOT NULL,
    sgst NUMERIC DEFAULT 0 NOT NULL,
    igst NUMERIC DEFAULT 0 NOT NULL,
    total_amount NUMERIC DEFAULT 0 NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'Unpaid', -- 'Draft', 'Posted', 'Paid', 'Partial', 'Unpaid'
    paid_amount NUMERIC DEFAULT 0 NOT NULL,
    assignee TEXT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 6. PAYMENTS & EXPENSES
CREATE TABLE customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT NOT NULL,
    date DATE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque', 'UPI'
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE vendor_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT NOT NULL,
    date DATE NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque', 'UPI'
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 7. FINANCIAL LEDGER & TAXES
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- 'Balance Sheet' or 'Income Statement'
    balance NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    party_id UUID, -- references customers/vendors deterministically if applicable
    party_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Debit' or 'Credit'
    amount NUMERIC NOT NULL,
    account_type TEXT NOT NULL, -- 'Cash', 'Bank', 'Stock', 'Purchase', 'Sales', 'Tax', 'Accounts Receivable', 'Accounts Payable'
    reference_type TEXT NOT NULL, -- 'Invoice', 'Bill', 'Payment', 'GRN', 'Adjustment', 'Purchase Return'
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    description TEXT,
    total_debit NUMERIC DEFAULT 0 NOT NULL,
    total_credit NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    rate NUMERIC DEFAULT 0 NOT NULL,
    type TEXT, -- 'GST', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 8. SYSTEM CONFIG & ACCESS CONTROL
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Active' NOT NULL, -- 'Active', 'Inactive'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT, -- identifier for user mapping
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    file_size TEXT,
    associated_type TEXT, -- 'CompanyProfile', 'PurchaseOrder', 'SaleInvoice', etc.
    associated_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 9. METADATA & ADDITIONAL LOGICAL TABLES (TO PREVENT JSON COLD STORAGE IN GENERAL CORES)
CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    address TEXT,
    head_office_address TEXT,
    logo_url TEXT,
    signature_url TEXT,
    stamp_url TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    account_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE erp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allow_negative_stock BOOLEAN DEFAULT false NOT NULL,
    sales_assignee_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE unit_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    factor NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE custom_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE sales_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE production_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL, -- 'Scheduled', 'In Progress', 'Completed'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    from_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    to_warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    item_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE funding_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE funding_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    partner_id UUID REFERENCES funding_partners(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque', 'UPI'
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE backup_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_backup_enabled BOOLEAN DEFAULT false NOT NULL,
    frequency TEXT, -- 'Daily', 'Weekly', 'Monthly'
    last_auto_backup_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);


-- 10. TRIGGER CONFIGURATION FOR TIMESTAMPS
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_stock_updated_at BEFORE UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_stock_movements_updated_at BEFORE UPDATE ON stock_movements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_purchase_bills_updated_at BEFORE UPDATE ON purchase_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_purchase_returns_updated_at BEFORE UPDATE ON purchase_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_sales_invoices_updated_at BEFORE UPDATE ON sales_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_customer_payments_updated_at BEFORE UPDATE ON customer_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_vendor_payments_updated_at BEFORE UPDATE ON vendor_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_ledger_entries_updated_at BEFORE UPDATE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_taxes_updated_at BEFORE UPDATE ON taxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_company_profiles_updated_at BEFORE UPDATE ON company_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_erp_settings_updated_at BEFORE UPDATE ON erp_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_production_runs_updated_at BEFORE UPDATE ON production_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_stock_transfers_updated_at BEFORE UPDATE ON stock_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_funding_partners_updated_at BEFORE UPDATE ON funding_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_funding_transactions_updated_at BEFORE UPDATE ON funding_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_backup_settings_updated_at BEFORE UPDATE ON backup_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 11. ADVANCED DATABASE TRIGGER: AUTOMATIC INVENTORY STOCK UPDATE
CREATE OR REPLACE FUNCTION process_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
    delta NUMERIC;
BEGIN
    -- Determine quantity delta based on direction or movement type
    IF NEW.type = 'In' OR NEW.type = 'Opening' THEN
        delta := NEW.quantity;
    ELSIF NEW.type = 'Out' THEN
        delta := -NEW.quantity;
    ELSE -- Adjustment
        delta := NEW.quantity;
    END IF;

    -- Update main products cumulative stock quantity
    UPDATE products 
    SET stock_quantity = stock_quantity + delta,
        updated_at = now()
    WHERE id = NEW.item_id;

    -- Upsert and maintain stock table values if warehouse_id is supplied
    IF NEW.warehouse_id IS NOT NULL THEN
        INSERT INTO stock (id, product_id, warehouse_id, quantity, updated_at)
        VALUES (
            gen_random_uuid(), 
            NEW.item_id, 
            NEW.warehouse_id, 
            delta, 
            now()
        )
        ON CONFLICT (product_id, warehouse_id) 
        DO UPDATE SET 
            quantity = stock.quantity + delta,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stock_movement
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION process_stock_movement();


-- 12. DATA REPORTING & ANALYTICAL VIEWS
CREATE OR REPLACE VIEW low_stock_alerts AS
SELECT p.id, p.code, p.name, p.stock_quantity, p.min_stock_level, c.name AS category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.stock_quantity <= p.min_stock_level;

CREATE OR REPLACE VIEW monthly_sales_summary AS
SELECT 
    TO_CHAR(date, 'YYYY-MM') AS sales_month,
    COUNT(id) AS total_invoices,
    SUM(total_amount) AS total_sales_amount,
    SUM(paid_amount) AS total_received_amount
FROM sales_invoices
GROUP BY sales_month
ORDER BY sales_month DESC;

CREATE OR REPLACE VIEW monthly_purchase_summary AS
SELECT 
    TO_CHAR(date, 'YYYY-MM') AS purchase_month,
    COUNT(id) AS total_bills,
    SUM(total_amount) AS total_purchase_amount,
    SUM(paid_amount) AS total_paid_amount
FROM purchase_bills
GROUP BY purchase_month
ORDER BY purchase_month DESC;

CREATE OR REPLACE VIEW warehouse_stock_valuation AS
SELECT 
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    SUM(s.quantity * p.purchase_price) AS total_stock_value,
    SUM(s.quantity) AS total_items_count
FROM stock s
JOIN warehouses w ON s.warehouse_id = w.id
JOIN products p ON s.product_id = p.id
GROUP BY w.id, w.name;


-- 13. INDEXES FOR EXCELLENT TRANSACTIONAL SPEED
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_stock_product_wh ON stock(product_id, warehouse_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_bills_vendor ON purchase_bills(vendor_id);
CREATE INDEX idx_purchase_bill_items_bill ON purchase_bill_items(purchase_bill_id);
CREATE INDEX idx_goods_receipts_po ON goods_receipts(purchase_order_id);
CREATE INDEX idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoice_items_invoice ON sales_invoice_items(sales_invoice_id);
CREATE INDEX idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX idx_vendor_payments_vendor ON vendor_payments(vendor_id);
CREATE INDEX idx_ledger_entries_party ON ledger_entries(party_id);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries(reference_id);


-- 14. ENABLE ROW LEVEL SECURITY (RLS) FOR DEFENSE-IN-DEPTH SECURITY
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_settings ENABLE ROW LEVEL SECURITY;


-- 15. SECURE PERMISSIVE ACCESS POLICIES FOR FULL PLATFORM ACCESS
CREATE POLICY "Allow public select on customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on customers" ON customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on customers" ON customers FOR DELETE USING (true);

CREATE POLICY "Allow public select on vendors" ON vendors FOR SELECT USING (true);
CREATE POLICY "Allow public insert on vendors" ON vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on vendors" ON vendors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on vendors" ON vendors FOR DELETE USING (true);

CREATE POLICY "Allow public select on categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert on categories" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on categories" ON categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on categories" ON categories FOR DELETE USING (true);

CREATE POLICY "Allow public select on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on products" ON products FOR DELETE USING (true);

CREATE POLICY "Allow public select on warehouses" ON warehouses FOR SELECT USING (true);
CREATE POLICY "Allow public insert on warehouses" ON warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on warehouses" ON warehouses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on warehouses" ON warehouses FOR DELETE USING (true);

CREATE POLICY "Allow public select on stock" ON stock FOR SELECT USING (true);
CREATE POLICY "Allow public insert on stock" ON stock FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on stock" ON stock FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on stock" ON stock FOR DELETE USING (true);

CREATE POLICY "Allow public select on stock_movements" ON stock_movements FOR SELECT USING (true);
CREATE POLICY "Allow public insert on stock_movements" ON stock_movements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on stock_movements" ON stock_movements FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on stock_movements" ON stock_movements FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_orders" ON purchase_orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_orders" ON purchase_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_orders" ON purchase_orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_orders" ON purchase_orders FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_order_items" ON purchase_order_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_order_items" ON purchase_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_order_items" ON purchase_order_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_order_items" ON purchase_order_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_items" ON purchase_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_items" ON purchase_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_items" ON purchase_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_items" ON purchase_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_bills" ON purchase_bills FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_bills" ON purchase_bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_bills" ON purchase_bills FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_bills" ON purchase_bills FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_bill_items" ON purchase_bill_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_bill_items" ON purchase_bill_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_bill_items" ON purchase_bill_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_bill_items" ON purchase_bill_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on goods_receipts" ON goods_receipts FOR SELECT USING (true);
CREATE POLICY "Allow public insert on goods_receipts" ON goods_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on goods_receipts" ON goods_receipts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on goods_receipts" ON goods_receipts FOR DELETE USING (true);

CREATE POLICY "Allow public select on goods_receipt_items" ON goods_receipt_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on goods_receipt_items" ON goods_receipt_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on goods_receipt_items" ON goods_receipt_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on goods_receipt_items" ON goods_receipt_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_returns" ON purchase_returns FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_returns" ON purchase_returns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_returns" ON purchase_returns FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_returns" ON purchase_returns FOR DELETE USING (true);

CREATE POLICY "Allow public select on purchase_return_items" ON purchase_return_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on purchase_return_items" ON purchase_return_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on purchase_return_items" ON purchase_return_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on purchase_return_items" ON purchase_return_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on sales_invoices" ON sales_invoices FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sales_invoices" ON sales_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sales_invoices" ON sales_invoices FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on sales_invoices" ON sales_invoices FOR DELETE USING (true);

CREATE POLICY "Allow public select on sales_invoice_items" ON sales_invoice_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sales_invoice_items" ON sales_invoice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sales_invoice_items" ON sales_invoice_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on sales_invoice_items" ON sales_invoice_items FOR DELETE USING (true);

CREATE POLICY "Allow public select on customer_payments" ON customer_payments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on customer_payments" ON customer_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on customer_payments" ON customer_payments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on customer_payments" ON customer_payments FOR DELETE USING (true);

CREATE POLICY "Allow public select on vendor_payments" ON vendor_payments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on vendor_payments" ON vendor_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on vendor_payments" ON vendor_payments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on vendor_payments" ON vendor_payments FOR DELETE USING (true);

CREATE POLICY "Allow public select on expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Allow public insert on expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on expenses" ON expenses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on expenses" ON expenses FOR DELETE USING (true);

CREATE POLICY "Allow public select on accounts" ON accounts FOR SELECT USING (true);
CREATE POLICY "Allow public insert on accounts" ON accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on accounts" ON accounts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on accounts" ON accounts FOR DELETE USING (true);

CREATE POLICY "Allow public select on ledger_entries" ON ledger_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert on ledger_entries" ON ledger_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on ledger_entries" ON ledger_entries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on ledger_entries" ON ledger_entries FOR DELETE USING (true);

CREATE POLICY "Allow public select on journal_entries" ON journal_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert on journal_entries" ON journal_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on journal_entries" ON journal_entries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on journal_entries" ON journal_entries FOR DELETE USING (true);

CREATE POLICY "Allow public select on taxes" ON taxes FOR SELECT USING (true);
CREATE POLICY "Allow public insert on taxes" ON taxes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on taxes" ON taxes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on taxes" ON taxes FOR DELETE USING (true);

CREATE POLICY "Allow public select on roles" ON roles FOR SELECT USING (true);
CREATE POLICY "Allow public insert on roles" ON roles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on roles" ON roles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on roles" ON roles FOR DELETE USING (true);

CREATE POLICY "Allow public select on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on users" ON users FOR DELETE USING (true);

CREATE POLICY "Allow public select on permissions" ON permissions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on permissions" ON permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on permissions" ON permissions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on permissions" ON permissions FOR DELETE USING (true);

CREATE POLICY "Allow public select on role_permissions" ON role_permissions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on role_permissions" ON role_permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on role_permissions" ON role_permissions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on role_permissions" ON role_permissions FOR DELETE USING (true);

CREATE POLICY "Allow public select on audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on audit_logs" ON audit_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on audit_logs" ON audit_logs FOR DELETE USING (true);

CREATE POLICY "Allow public select on notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert on notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on notifications" ON notifications FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on notifications" ON notifications FOR DELETE USING (true);

CREATE POLICY "Allow public select on attachments" ON attachments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on attachments" ON attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on attachments" ON attachments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on attachments" ON attachments FOR DELETE USING (true);

CREATE POLICY "Allow public select on company_profiles" ON company_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert on company_profiles" ON company_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on company_profiles" ON company_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on company_profiles" ON company_profiles FOR DELETE USING (true);

CREATE POLICY "Allow public select on erp_settings" ON erp_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on erp_settings" ON erp_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on erp_settings" ON erp_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on erp_settings" ON erp_settings FOR DELETE USING (true);

CREATE POLICY "Allow public select on unit_conversions" ON unit_conversions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on unit_conversions" ON unit_conversions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on unit_conversions" ON unit_conversions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on unit_conversions" ON unit_conversions FOR DELETE USING (true);

CREATE POLICY "Allow public select on custom_units" ON custom_units FOR SELECT USING (true);
CREATE POLICY "Allow public insert on custom_units" ON custom_units FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on custom_units" ON custom_units FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on custom_units" ON custom_units FOR DELETE USING (true);

CREATE POLICY "Allow public select on sales_assignees" ON sales_assignees FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sales_assignees" ON sales_assignees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sales_assignees" ON sales_assignees FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on sales_assignees" ON sales_assignees FOR DELETE USING (true);

CREATE POLICY "Allow public select on production_runs" ON production_runs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on production_runs" ON production_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on production_runs" ON production_runs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on production_runs" ON production_runs FOR DELETE USING (true);

CREATE POLICY "Allow public select on stock_transfers" ON stock_transfers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on stock_transfers" ON stock_transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on stock_transfers" ON stock_transfers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on stock_transfers" ON stock_transfers FOR DELETE USING (true);

CREATE POLICY "Allow public select on funding_partners" ON funding_partners FOR SELECT USING (true);
CREATE POLICY "Allow public insert on funding_partners" ON funding_partners FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on funding_partners" ON funding_partners FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on funding_partners" ON funding_partners FOR DELETE USING (true);

CREATE POLICY "Allow public select on funding_transactions" ON funding_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on funding_transactions" ON funding_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on funding_transactions" ON funding_transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on funding_transactions" ON funding_transactions FOR DELETE USING (true);

CREATE POLICY "Allow public select on backup_settings" ON backup_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on backup_settings" ON backup_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on backup_settings" ON backup_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on backup_settings" ON backup_settings FOR DELETE USING (true);


-- 16. SEED ESSENTIAL SYSTEM ROLES, PERMISSIONS, AND TAXES
INSERT INTO roles (id, name) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Admin'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Accountant'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Sales'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Purchase'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Store'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Production')
ON CONFLICT (name) DO NOTHING;

INSERT INTO taxes (id, name, rate, type) VALUES
  ('00000000-0000-0000-0000-000000000005', 'GST 5%', 5, 'GST'),
  ('00000000-0000-0000-0000-000000000012', 'GST 12%', 12, 'GST'),
  ('00000000-0000-0000-0000-000000000018', 'GST 18%', 18, 'GST'),
  ('00000000-0000-0000-0000-000000000028', 'GST 28%', 28, 'GST')
ON CONFLICT (name) DO NOTHING;
