require('dotenv').config();
const pool = require('../src/config/database');

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Running database migrations...');

    await client.query(`
      -- Users table (for authentication)
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20) NOT NULL DEFAULT 'tenant' CHECK (role IN ('admin','tenant')),
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );

      -- Tenants table (linked to users)
      CREATE TABLE IF NOT EXISTS tenants (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        room_no        VARCHAR(20) NOT NULL,
        rfid_code      VARCHAR(100) UNIQUE,
        fingerprint_id INTEGER,
        phone          VARCHAR(20),
        is_active      BOOLEAN DEFAULT true,
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      );

      -- Payments table
      CREATE TABLE IF NOT EXISTS payments (
        id             SERIAL PRIMARY KEY,
        tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        amount         NUMERIC(12,2) NOT NULL,
        payment_method VARCHAR(30) DEFAULT 'cash',
        reference      VARCHAR(100),
        status         VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('paid','unpaid','pending')),
        expiry_date    TIMESTAMP,
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      );

      -- Devices table (ESP32 devices)
      CREATE TABLE IF NOT EXISTS devices (
        id           SERIAL PRIMARY KEY,
        device_name  VARCHAR(100) NOT NULL,
        location     VARCHAR(100),
        room_no      VARCHAR(20),
        ip_address   VARCHAR(45),
        status       VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online','offline')),
        last_seen    TIMESTAMP,
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW()
      );

      -- Access logs table (every door attempt)
      CREATE TABLE IF NOT EXISTS access_logs (
        id          SERIAL PRIMARY KEY,
        tenant_id   INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
        device_id   INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        decision    VARCHAR(10) NOT NULL CHECK (decision IN ('ALLOW','DENY')),
        reason      VARCHAR(100),
        created_at  TIMESTAMP DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_tenants_rfid    ON tenants(rfid_code);
      CREATE INDEX IF NOT EXISTS idx_tenants_user    ON tenants(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_logs_tenant     ON access_logs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created    ON access_logs(created_at DESC);
    `);

    console.log('✅ Migration complete! All tables created.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
