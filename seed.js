require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Tenant = require('./backend/models/Tenant');
const Payment = require('./backend/models/Payment');
const { Device } = require('./backend/models/Device');

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartrental');
    console.log('✅ Connected to MongoDB');

    // Clear existing data (be careful in production!)
    await User.deleteMany({});
    await Tenant.deleteMany({});
    await Payment.deleteMany({});
    await Device.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Admin User
    const admin = await User.create({
      name: 'Admin Mkuu',
      email: process.env.ADMIN_EMAIL || 'admin@smartrental.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@2024',
      role: 'admin',
      phone: '+255700000001'
    });
    console.log('👤 Admin created:', admin.email);

    // Create Sample Tenants
    const tenant1User = await User.create({
      name: 'Juma Mwalimu',
      email: 'juma@tenant.com',
      password: 'Tenant@2024',
      role: 'tenant',
      phone: '+255712345678'
    });

    const tenant2User = await User.create({
      name: 'Amina Hassan',
      email: 'amina@tenant.com',
      password: 'Tenant@2024',
      role: 'tenant',
      phone: '+255787654321'
    });

    const tenant1 = await Tenant.create({
      userId: tenant1User._id,
      name: 'Juma Mwalimu',
      phone: '+255712345678',
      roomNo: 'A1',
      rentAmount: 150000,
      rfidTag: 'A1B2C3D4',
      fingerprintId: 1,
      doorAccess: true,
      status: 'active'
    });

    const tenant2 = await Tenant.create({
      userId: tenant2User._id,
      name: 'Amina Hassan',
      phone: '+255787654321',
      roomNo: 'B2',
      rentAmount: 180000,
      rfidTag: 'E5F6G7H8',
      doorAccess: false,  // Hasn't paid
      status: 'blocked'
    });

    console.log('🏠 Tenants created');

    // Create Sample Payments
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [year, mon] = currentMonth.split('-').map(Number);

    await Payment.create({
      tenantId: tenant1._id,
      amount: 150000,
      month: currentMonth,
      status: 'paid',
      paymentMethod: 'mpesa',
      transactionId: 'MP240001',
      paidAt: new Date(),
      dueDate: new Date(year, mon - 1, 1),
      expiryDate: new Date(year, mon, 0),
      recordedBy: admin._id
    });

    // Amina hasn't paid this month (no payment record)
    // Previous month payment for Amina
    const prevMonth = new Date(year, mon - 2, 1).toISOString().slice(0, 7);
    await Payment.create({
      tenantId: tenant2._id,
      amount: 180000,
      month: prevMonth,
      status: 'paid',
      paymentMethod: 'cash',
      paidAt: new Date(year, mon - 2, 5),
      dueDate: new Date(year, mon - 2, 1),
      expiryDate: new Date(year, mon - 1, 0),
      recordedBy: admin._id
    });

    console.log('💰 Sample payments created');

    // Create Sample Device
    await Device.create({
      deviceName: 'Door1',
      deviceType: 'door_lock',
      location: 'Main Entrance - Ground Floor',
      isOnline: false,
      isLocked: true,
      assignedRoom: 'All'
    });

    console.log('🚪 Door device created');

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║         DATABASE SEEDED SUCCESSFULLY         ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('\n📋 Login Credentials:');
    console.log('   Admin:  admin@smartrental.com / Admin@2024');
    console.log('   Tenant: juma@tenant.com / Tenant@2024 (Paid ✅)');
    console.log('   Tenant: amina@tenant.com / Tenant@2024 (Unpaid ❌)');
    console.log('\n🔑 RFID Tags:');
    console.log('   Juma (A1):  A1B2C3D4 → Access GRANTED');
    console.log('   Amina (B2): E5F6G7H8 → Access DENIED');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedDatabase();
