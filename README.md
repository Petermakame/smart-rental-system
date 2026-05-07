# 🏠 Smart Rental Management System

A full-stack IoT-enabled rental management system with:
- **Node.js + Express** backend
- **PostgreSQL** database  
- **EJS** server-rendered frontend
- **ESP32** door lock controller (RFID + Relay)
- **Render** cloud hosting

---

## 📁 Project Structure

```
smart-rental-system/
├── src/
│   ├── server.js                  ← App entry point
│   ├── config/
│   │   └── database.js            ← PostgreSQL connection
│   ├── controllers/
│   │   ├── authController.js      ← Login/Register logic
│   │   ├── tenantController.js    ← Tenant CRUD
│   │   ├── paymentController.js   ← Payment recording & verification
│   │   ├── doorController.js      ← Door access logic (ESP32 endpoint)
│   │   └── deviceController.js    ← ESP32 device management
│   ├── middleware/
│   │   └── auth.js                ← JWT + session middleware
│   └── routes/
│       ├── auth.js   web.js
│       ├── tenants.js payments.js
│       ├── door.js   devices.js
├── public/
│   ├── css/style.css
│   ├── js/admin.js
│   └── views/
│       ├── auth/login.ejs  register.ejs
│       ├── admin/dashboard.ejs  tenants.ejs  payments.ejs  access-logs.ejs
│       ├── tenant/dashboard.ejs
│       └── partials/head.ejs  admin-nav.ejs
├── scripts/
│   ├── migrate.js                 ← Creates all DB tables
│   └── seed.js                    ← Creates admin + sample data
├── esp32/
│   └── smart_door.ino             ← Arduino code for ESP32
├── .env.example
├── package.json
└── render.yaml                    ← Render auto-deploy config
```

---

## 🚀 DEPLOYMENT GUIDE

### STEP 1 — Local Setup

```bash
# 1. Clone or download project
git clone https://github.com/YOUR_USERNAME/smart-rental-system
cd smart-rental-system

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your DB credentials

# 4. Run migrations (creates tables)
npm run migrate

# 5. Seed database (creates admin + sample data)
npm run seed

# 6. Start development server
npm run dev
```

Open: http://localhost:3000

---

### STEP 2 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Smart Rental System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-rental-system.git
git push -u origin main
```

---

### STEP 3 — Deploy to Render

1. Go to **https://render.com** → Sign up / Log in
2. Click **"New +"** → **"Web Service"**
3. Connect your **GitHub** account
4. Select your **smart-rental-system** repository
5. Fill in:
   - **Name:** `smart-rental-system`
   - **Region:** Choose closest to Tanzania
   - **Build Command:** `npm install && node scripts/migrate.js && node scripts/seed.js`
   - **Start Command:** `npm start`
   - **Plan:** Free

6. Add **Environment Variables** (click "Advanced"):
   ```
   NODE_ENV=production
   JWT_SECRET=<click "Generate" for random value>
   SESSION_SECRET=<click "Generate" for random value>
   ```

7. **Add PostgreSQL Database:**
   - Click **"New +"** → **"PostgreSQL"**
   - Name: `smart-rental-db`, Plan: Free
   - Copy the **Internal Database URL**
   - Add as env var: `DATABASE_URL=<paste URL>`

8. Click **"Create Web Service"**

✅ Your app will be live at: `https://smart-rental-system.onrender.com`

---

### STEP 4 — ESP32 Setup

1. **Install Arduino IDE** from https://www.arduino.cc/en/software

2. **Add ESP32 board:**
   - File → Preferences → Additional URLs:
   ```
   https://dl.espressif.com/dl/package_esp32_index.json
   ```
   - Tools → Board → Board Manager → Search "esp32" → Install

3. **Install Libraries** (Tools → Manage Libraries):
   - `MFRC522` by GithubCommunity
   - `ArduinoJson` by Benoit Blanchon

4. **Edit `esp32/smart_door.ino`:**
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* SERVER_URL    = "https://YOUR-APP.onrender.com";
   const int   DEVICE_ID     = 1;  // From your devices table
   ```

5. **Wire the hardware** (see wiring diagram in smart_door.ino)

6. **Upload:** Select board "ESP32 Dev Module", choose port, Upload

---

## 🔌 API Endpoints

### Authentication
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/logout` | Logout |
| GET  | `/api/auth/me` | Get current user |

### Tenants (Admin only)
| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/tenants` | List all tenants |
| GET  | `/api/tenants/:id` | Get tenant |
| POST | `/api/tenants` | Create tenant |
| PUT  | `/api/tenants/:id` | Update tenant |
| DELETE | `/api/tenants/:id` | Delete tenant |

### Payments
| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/payments` | All payments |
| POST | `/api/payments` | Record payment |
| POST | `/api/payments/verify` | Check payment status |
| PUT  | `/api/payments/:id/status` | Update status |

### Door Access (ESP32)
| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/door/access?rfid=XXXX` | Check RFID access |
| GET  | `/api/door/access?tenantId=1` | Check by tenant ID |
| GET  | `/api/door/logs` | Access logs (Admin) |
| POST | `/api/door/manual` | Manual door control |

### Devices (ESP32)
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/devices/heartbeat` | ESP32 ping |
| GET  | `/api/devices` | List devices |
| POST | `/api/devices` | Register device |

---

## 🔐 Demo Credentials

After seeding:
- **Admin:** admin@smartrental.com / Admin@123
- **Tenant (Paid):** alice@tenant.com / Tenant@123
- **Tenant (Unpaid):** bob@tenant.com / Tenant@123

---

## 🏗️ System Flow

```
Admin registers tenant + assigns RFID
         ↓
Tenant pays rent → Admin records payment
         ↓
Server sets tenant status = ACTIVE
         ↓
Tenant scans RFID at door
         ↓
ESP32 → GET /api/door/access?rfid=XXXX
         ↓
Server checks: is_active? + payment status + expiry
         ↓
    ALLOW → Relay ON (Door Opens for 5s)
    DENY  → Relay OFF (Door Stays Locked)
         ↓
Access logged in database
```

---

## 🌍 Mobile Money (Tanzania)

Currently simulated. To integrate real M-Pesa/Tigo/Airtel:
- M-Pesa Tanzania: Use Vodacom Tanzania Open API
- Tigo Pesa: Use MFS Africa API
- Airtel Money: Use Airtel Africa API

Set `payment_method` field accordingly in payment records.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | PostgreSQL |
| ORM | pg (node-postgres) |
| Auth | JWT + express-session |
| Views | EJS |
| Security | Helmet, bcryptjs, rate-limit |
| Hosting | Render |
| IoT | ESP32 + MFRC522 RFID |
