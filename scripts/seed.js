require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');

    // Admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@smartrental.com';
    const adminPass  = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminName  = process.env.ADMIN_NAME || 'System Admin';

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (!existing.rows.length) {
      const hashed = await bcrypt.hash(adminPass, 12);
      await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4)',
        [adminName, adminEmail, hashed, 'admin']
      );
      console.log(`✅ Admin created: ${adminEmail} / ${adminPass}`);
    } else {
      console.log('ℹ️  Admin already exists, skipping.');
    }

    // Sample tenant 1
    const t1Email = 'alice@tenant.com';
    const t1Exists = await client.query('SELECT id FROM users WHERE email=$1', [t1Email]);
    if (!t1Exists.rows.length) {
      const hashed = await bcrypt.hash('Tenant@123', 12);
      const u = await client.query(
        'INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id',
        ['Alice Mwangi', t1Email, hashed, 'tenant']
      );
      const t = await client.query(
        'INSERT INTO tenants (user_id,room_no,rfid_code,phone) VALUES ($1,$2,$3,$4) RETURNING id',
        [u.rows[0].id, 'Room 101', 'RFID-A1B2C3', '+255712345678']
      );
      // Add a paid payment
      const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 1);
      await client.query(
        "INSERT INTO payments (tenant_id,amount,payment_method,reference,status,expiry_date) VALUES ($1,$2,$3,$4,'paid',$5)",
        [t.rows[0].id, 150000, 'mpesa', 'MP-001', expiry]
      );
      console.log('✅ Sample tenant created: alice@tenant.com / Tenant@123 (Room 101, PAID)');
    }

    // Sample tenant 2
    const t2Email = 'bob@tenant.com';
    const t2Exists = await client.query('SELECT id FROM users WHERE email=$1', [t2Email]);
    if (!t2Exists.rows.length) {
      const hashed = await bcrypt.hash('Tenant@123', 12);
      const u = await client.query(
        'INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id',
        ['Bob Kimani', t2Email, hashed, 'tenant']
      );
      await client.query(
        'INSERT INTO tenants (user_id,room_no,rfid_code,phone,is_active) VALUES ($1,$2,$3,$4,false)',
        [u.rows[0].id, 'Room 102', 'RFID-D4E5F6', '+255787654321']
      );
      console.log('✅ Sample tenant created: bob@tenant.com / Tenant@123 (Room 102, UNPAID/BLOCKED)');
    }

    // Sample device
    const devExists = await client.query("SELECT id FROM devices WHERE device_name='Door-Main'");
    if (!devExists.rows.length) {
      await client.query(
        "INSERT INTO devices (device_name,location,room_no,status) VALUES ('Door-Main','Main Entrance','Lobby','offline')"
      );
      console.log('✅ Sample device created: Door-Main');
    }

    console.log('\n🎉 Seeding complete!');
    console.log('──────────────────────────────');
    console.log('Admin:    admin@smartrental.com / Admin@123');
    console.log('Tenant 1: alice@tenant.com / Tenant@123 (Paid)');
    console.log('Tenant 2: bob@tenant.com / Tenant@123 (Unpaid)');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
