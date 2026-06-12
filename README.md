# WhatsApp Automation Server

A lightweight, production-ready, multi-account WhatsApp API server built with [Baileys](https://github.com/WhiskeySockets/Baileys). 
Designed as a highly efficient, low-memory alternative to Evolution API, making it perfect for 1GB RAM VPS environments (like AWS Lightsail or DigitalOcean Droplets).

## ✨ Key Features
- **Multi-Account Support:** Connect and manage dozens of WhatsApp accounts simultaneously.
- **Visual Dashboard:** Beautiful, password-protected web UI to scan QR codes and monitor account health.
- **Anti-Ban Message Queue:** Built-in background queue service with automatic delays (1-3s) between messages.
- **State Persistence:** Automatically restores all sessions upon server reboot without requiring re-scans.
- **Dual-Layer Security:** Master Admin API Key for management, and isolated auto-generated API Keys for individual WhatsApp accounts.
- **No Database Required:** Uses robust local JSON file storage (`storage/`) to keep RAM usage under 150MB.

---

## 🚀 Deployment Guide (Linux VPS)

### 1. Install Node.js & Git
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
```

### 2. Clone & Setup
```bash
git clone https://github.com/shinchan1907/unofficial-waba.git
cd unofficial-waba
npm install
```

### 3. Configure Environment
Edit the `.env` file (or create one):
```env
PORT=80
API_KEY=your-master-admin-secret-key
NODE_ENV=production
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your_secure_password
```

### 4. Run in Production (PM2)
```bash
sudo npm install -g pm2
sudo setcap cap_net_bind_service=+ep $(which node) # Allow Node to use Port 80
sudo pm2 start server.js --name "wa-server"
sudo pm2 startup
sudo pm2 save
```
*Access the dashboard at `http://YOUR_VPS_IP`*

---

## 🔐 Authentication

The API uses header-based authentication. Pass the key in the `x-api-key` header.

1. **Admin Key:** Set in your `.env` file (`API_KEY`). Required to create or delete accounts.
2. **Account Key:** Auto-generated when you create an account (looks like `wa_2174f...`). Can be viewed in the Dashboard. Used specifically for sending messages from that account. 
*(Note: The Admin Key can safely override and act as an Account Key).*

---

## 📚 REST API Reference

**Base URL:** `http://YOUR_VPS_IP/api`

### 1. Create a New Account
Initialize a new WhatsApp session.
- **Method:** `POST /accounts`
- **Auth:** Admin Key
- **Body:**
```json
{
  "name": "marketing_bot"
}
```
- **Response:** Returns the generated `apiKey` for this account.

### 2. Get QR Code
Fetch the Base64 QR code image to scan with your phone. Keep calling this every 5 seconds until the status changes to `CONNECTED`.
- **Method:** `GET /accounts/marketing_bot/qr`
- **Auth:** Admin Key
- **Response:**
```json
{
  "success": true,
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### 3. Get Account Status
- **Method:** `GET /accounts/marketing_bot/status`
- **Auth:** Admin Key OR Account Key
- **Response:**
```json
{
  "status": "CONNECTED",
  "number": "919876543210"
}
```

### 4. Logout & Delete Account
Logs the phone out of WhatsApp web and deletes the session files.
- **Method:** `POST /accounts/marketing_bot/logout`
- **Auth:** Admin Key

---

## ✉️ Messaging API

### Send a Text Message
Adds a message to the internal background queue. The server will automatically process it, format the phone number, and send it with an anti-ban delay.
- **Method:** `POST /messages/send`
- **Auth:** Account Key (e.g., `wa_...`) or Admin Key
- **Headers:** 
  - `Content-Type: application/json`
  - `x-api-key: <YOUR_ACCOUNT_KEY>`
- **Body:**
```json
{
  "account": "marketing_bot",
  "number": "919876543210",
  "message": "Hello from the new WhatsApp Server API!"
}
```
*Note: The `number` should include the country code but NO plus sign or spaces.*
- **Response:**
```json
{
  "success": true,
  "message": "Message added to queue",
  "msgId": "msg_1718181234567"
}
```

---

## 🛠 Directory Structure
- `config/` - Core configuration and path management.
- `controllers/` - API route logic.
- `dashboard/` - HTML/Vanilla JS frontend interface.
- `middleware/` - Security layers (`adminAuth`, `accountAuth`, Basic Auth).
- `routes/` - Express route definitions.
- `services/` - Core logic (`whatsappManager.js` for Baileys, `queueService.js` for queueing).
- `storage/` - Auto-generated JSON databases and session files (Ignored by Git).
