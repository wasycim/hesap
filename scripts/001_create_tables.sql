-- Hesap Rapor Yonetim Sistemi - Veritabani Tablolari
-- Bu script tum gerekli tablolari olusturur

-- 1. Sirketler Tablosu
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#EAB308',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ortaklar Tablosu
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#F97316',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ana Kayitlar Tablosu
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  period TEXT CHECK (period IN ('sabah', 'aksam')),
  record_type TEXT NOT NULL CHECK (record_type IN ('gelir', 'gider')),
  month_year TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sirket Tutarlari Tablosu
CREATE TABLE IF NOT EXISTS company_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) DEFAULT 0,
  UNIQUE(record_id, company_id)
);

-- 5. Ortak Paylari Tablosu
CREATE TABLE IF NOT EXISTS partner_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) DEFAULT 0,
  UNIQUE(record_id, partner_id)
);

-- 6. Kayit Ozeti Tablosu
CREATE TABLE IF NOT EXISTS record_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID UNIQUE NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  kasa_gelen DECIMAL(15,2) DEFAULT 0,
  diger_komisyon DECIMAL(15,2) DEFAULT 0,
  toplam DECIMAL(15,2) DEFAULT 0,
  giderler DECIMAL(15,2) DEFAULT 0,
  kalan DECIMAL(15,2) DEFAULT 0,
  durum TEXT DEFAULT 'beklemede'
);

-- Row Level Security (RLS) Politikalari

-- Companies RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select_own" ON companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "companies_insert_own" ON companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companies_update_own" ON companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "companies_delete_own" ON companies FOR DELETE USING (auth.uid() = user_id);

-- Partners RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_select_own" ON partners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "partners_insert_own" ON partners FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "partners_update_own" ON partners FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "partners_delete_own" ON partners FOR DELETE USING (auth.uid() = user_id);

-- Records RLS
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records_select_own" ON records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "records_insert_own" ON records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "records_update_own" ON records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "records_delete_own" ON records FOR DELETE USING (auth.uid() = user_id);

-- Company Amounts RLS (record uzerinden kontrol)
ALTER TABLE company_amounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_amounts_select" ON company_amounts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = company_amounts.record_id AND records.user_id = auth.uid()));
CREATE POLICY "company_amounts_insert" ON company_amounts FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM records WHERE records.id = company_amounts.record_id AND records.user_id = auth.uid()));
CREATE POLICY "company_amounts_update" ON company_amounts FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = company_amounts.record_id AND records.user_id = auth.uid()));
CREATE POLICY "company_amounts_delete" ON company_amounts FOR DELETE 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = company_amounts.record_id AND records.user_id = auth.uid()));

-- Partner Shares RLS (record uzerinden kontrol)
ALTER TABLE partner_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner_shares_select" ON partner_shares FOR SELECT 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = partner_shares.record_id AND records.user_id = auth.uid()));
CREATE POLICY "partner_shares_insert" ON partner_shares FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM records WHERE records.id = partner_shares.record_id AND records.user_id = auth.uid()));
CREATE POLICY "partner_shares_update" ON partner_shares FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = partner_shares.record_id AND records.user_id = auth.uid()));
CREATE POLICY "partner_shares_delete" ON partner_shares FOR DELETE 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = partner_shares.record_id AND records.user_id = auth.uid()));

-- Record Summary RLS (record uzerinden kontrol)
ALTER TABLE record_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "record_summary_select" ON record_summary FOR SELECT 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = record_summary.record_id AND records.user_id = auth.uid()));
CREATE POLICY "record_summary_insert" ON record_summary FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM records WHERE records.id = record_summary.record_id AND records.user_id = auth.uid()));
CREATE POLICY "record_summary_update" ON record_summary FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = record_summary.record_id AND records.user_id = auth.uid()));
CREATE POLICY "record_summary_delete" ON record_summary FOR DELETE 
  USING (EXISTS (SELECT 1 FROM records WHERE records.id = record_summary.record_id AND records.user_id = auth.uid()));

-- Indexler (performans icin)
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_month_year ON records(month_year);
CREATE INDEX IF NOT EXISTS idx_records_record_date ON records(record_date);
CREATE INDEX IF NOT EXISTS idx_company_amounts_record_id ON company_amounts(record_id);
CREATE INDEX IF NOT EXISTS idx_partner_shares_record_id ON partner_shares(record_id);
