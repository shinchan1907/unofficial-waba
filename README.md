# WhatsApp Automation Server

A lightweight, production-ready, multi-account WhatsApp API server built with [Baileys](https://github.com/WhiskeySockets/Baileys). 
Designed as a highly efficient, low-memory alternative to Evolution API, making it perfect for 1GB RAM VPS environments (like AWS Lightsail or DigitalOcean Droplets).

## 🏛️ System Architecture & Data Flow

```mermaid
graph TD
    Client[Client App / Postman] -->|POST /messages/send| API[Express REST API]
    Admin[Browser] -->|Basic Auth| Dashboard[Web Dashboard]
    
    API -->|Validates Account Key| Auth[Auth Middleware]
    
    Auth --> QueueService[Message Queue Service]
    Auth --> AccountController[Account Controller]
    
    QueueService -->|Saves Pending Msgs| QueueDB[(queue.json)]
    QueueService -->|Pulls 1 by 1| Processor[Background Queue Processor]
    
    AccountController -->|Manage Sessions| WAManager[WhatsApp Core Manager]
    WAManager -->|Updates State| AccountsDB[(accounts.json)]
    WAManager -->|Spins up instances| Baileys[Baileys Sockets in RAM]
    
    Processor -->|Dispatches Msg (1-3s delay)| Baileys
    Baileys <-->|WebSockets| WA_Servers[WhatsApp Core Servers]
    Baileys -->|Persists Auth Keys| Storage[(storage/sessions/)]
```

## ✨ Key Features
- **Multi-Account Support:** Connect and manage dozens of WhatsApp accounts simultaneously via REST APIs.
- **Visual Dashboard:** Beautiful, password-protected web UI to scan QR codes and monitor account health.
- **Anti-Ban Message Queue:** Built-in background queue service with automatic random delays (1-3s) between messages to mimic human behavior.
- **State Persistence:** Automatically restores all disconnected or stopped sessions upon server reboot without requiring re-scans.
- **Dual-Layer Security:** Master Admin API Key for management, and isolated auto-generated API Keys for individual WhatsApp accounts.
- **No Heavy Database:** Uses robust local JSON file storage (`storage/`) avoiding the massive RAM footprint of MongoDB/PostgreSQL.

---

## 🚀 Deployment Guide (Production VPS)

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
Edit the `.env` file in the root folder:
```env
PORT=80
API_KEY=your-master-admin-secret-key
NODE_ENV=production
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your_secure_password
```

### 4. Run as a Background Service (PM2)
Using PM2 ensures the app runs 24/7 and restarts automatically if it crashes or if the server reboots.
```bash
sudo npm install -g pm2
# Allow Node to bind to privileged Port 80 without being root user
sudo setcap cap_net_bind_service=+ep $(which node) 

# Start and save the process
sudo pm2 start server.js --name "wa-server"
sudo pm2 startup
sudo pm2 save
```
*Access the dashboard at `http://YOUR_VPS_IP`*

---

## 🔐 Authentication System

The API uses header-based authentication. Pass the key in the `x-api-key` header for all requests.

1. **Admin Key (`API_KEY` in `.env`):** The master key. Required to access global routes like creating or deleting accounts.
2. **Account Key (`wa_...`):** Auto-generated when you link an account. This key is isolated; it can ONLY be used to send messages from the specific account it was generated for.

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
- **Response:** 
```json
{
  "success": true,
  "accountId": "marketing_bot",
  "apiKey": "wa_2174fbd23197d4129...",
  "message": "Account creation initiated. Fetch QR code next."
}
```

### 2. Get QR Code
Fetch the Base64 QR code image to scan with your phone. Keep polling this endpoint every 5 seconds until the status changes to `CONNECTED`.
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
Check if a phone is online, offline, or awaiting QR scan.
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
Logs the phone out of WhatsApp web completely and deletes all session files from the server storage.
- **Method:** `POST /accounts/marketing_bot/logout`
- **Auth:** Admin Key

---

## ✉️ Messaging API

### Send a Text Message
This adds a message to the internal background queue. The server will process the queue sequentially to prevent WhatsApp from banning the account for spamming.
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
- `config/` - Core configuration, environment variables, and storage path mapping.
- `controllers/` - Handles the logic for incoming API requests.
- `dashboard/` - HTML/Vanilla JS frontend interface for browser-based management.
- `middleware/` - Security layers (`adminAuth`, `accountAuth`, Basic Auth).
- `routes/` - Express route definitions.
- `services/` - Core daemon logic (`whatsappManager.js` handles Baileys WebSocket lifecycle, `queueService.js` handles the sequential dispatching of messages).
- `storage/` - Auto-generated JSON databases and persistent Baileys session files (Ignored by Git to prevent leakages).
