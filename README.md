# Event Planning & Management Platform

A comprehensive, full-stack application built for organizing, managing, and participating in college club events, hackathons, and merchandise sales.

## Features & Architecture

This platform provides three distinct role-based interfaces (Admin, Organizer, Participant) mapped to customized workflows. Organizers can craft events with dynamic registration forms, track attendance via live QR camera scanning, and sell merchandise. Participants browse personalized feeds based on their interests and followed clubs, register for events natively, and interact in real-time forums with threaded replies, reactions, and notifications.

---

## Libraries, Frameworks, and Modules

### Frontend

| Library | Version | Justification |
|---------|---------|---------------|
| **React** (via Vite) | 19.x | Highly optimized SPA framework with instant HMR during development and fast production builds. Vite chosen over CRA for native ESM speed. |
| **React Router DOM** | 7.x | Enables seamless SPA routing with protected routes and role-based redirects across Admin/Organizer/Participant interfaces. |
| **Tailwind CSS** | 4.x | Utility-first CSS framework providing robust, responsive styling without writing custom CSS files. |
| **DaisyUI** | 5.x | Component library built on Tailwind that provides accessible, aesthetically pleasing UI components (cards, modals, badges, tables) with minimal bundle overhead. |
| **Axios** | 1.x | HTTP client with interceptor support for automatically injecting JWT Bearer tokens into every outgoing API request. |
| **Socket.IO-client** | 4.x | Real-time bi-directional WebSocket communication powering the live Event Discussion Forums without constant HTTP polling. |
| **jsQR** | 1.x | Client-side QR code decoder operating directly on HTML5 Canvas. Enables live camera-based QR ticket scanning in the browser without server roundtrips, saving bandwidth during physical event entry. |
| **qrcode.react** | 4.x | Client-side SVG/Canvas QR code generator for participant tickets, eliminating backend image generation overhead. |
| **react-google-recaptcha** | 3.x | Google reCAPTCHA v2 widget integration to prevent bot registrations and brute-force login attempts. |

### Backend

| Library | Version | Justification |
|---------|---------|---------------|
| **Node.js & Express.js** | 5.x | Lightweight, highly scalable JavaScript runtime enabling full-stack JS without context-switching. |
| **MongoDB (Native Driver)** | 7.x | NoSQL datastore chosen over SQL to support **Dynamic Form Builders** — organizers inject custom registration fields on the fly, and MongoDB handles schemaless JSON payloads gracefully. Native driver used over Mongoose for absolute query control and performance. |
| **jsonwebtoken (JWT)** | 9.x | Stateless authentication tokens strictly mapping to RBAC boundaries (`admin`, `organizer`, `participant`). |
| **bcryptjs** | 3.x | Password hashing with randomized salt rounds defending against rainbow table attacks. |
| **nodemailer** | 8.x | SMTP email integration for confirmation emails, ticket delivery, and password reset notifications. |
| **qrcode** | 1.x | Server-side QR code generation for ticket payloads embedded in registration confirmation emails. |
| **Socket.IO** | 4.x | Server-side WebSocket management creating isolated rooms per event for real-time forum message broadcasting. |
| **Cloudinary** | 2.x | Cloud-based image/file hosting for event banners, payment proof uploads, and organizer assets. |
| **Multer** | 2.x | Multipart form-data parsing middleware for handling file uploads (event images, payment proofs). |
| **dotenv** | 17.x | Environment variable management for secure configuration of secrets, database URIs, and API keys. |
| **cors** | 2.x | Cross-Origin Resource Sharing middleware enabling frontend-backend communication across different origins. |

---

## Advanced Features Implemented (30 Marks Total)

As per Section 13 instructions, exactly 30 marks of advanced modules were implemented.

### Tier A (Choose 2 — 16 Marks)

#### 1. Merchandise Payment Approval Workflow (8 Marks)
- **Justification**: Exposes the platform's ability to handle complex transactional state machines with multi-step approval flows.
- **Design Choices**:
  - Participants upload payment proof screenshots, locking orders into a `PENDING` state
  - Organizers use a dedicated approval dashboard to audit payment proofs visually
  - MongoDB atomic operations (`$inc`) safely decrement `stockQuantity` preventing concurrency race conditions
  - Upon approval, a unique QR ticket is generated and emailed to the participant
  - Rejection includes optional organizer comments visible to the participant
- **Technical Decisions**: Used Cloudinary for payment proof storage to avoid serving large binary files from the Node.js process. Stock management uses atomic MongoDB operators to prevent overselling under concurrent requests.

#### 2. QR Scanner & Attendance Tracking (8 Marks)
- **Justification**: Essential for physical campus event workflows, bridging digital authorization and physical access control.
- **Design Choices**:
  - **Live camera QR scanning** using device camera (via `getUserMedia` API) with real-time `jsQR` decoding at 4fps
  - Automatic submission on QR detection — no manual "confirm" step needed
  - Duplicate scan rejection with clear error messaging
  - **Live Attendance Dashboard** showing scanned vs. not-yet-scanned participants in real-time
  - **Manual override** with required audit reason/note for exceptional cases (lost QR, identity verified manually)
  - **CSV export** of complete attendance records with timestamps and methods
- **Technical Decisions**: QR scanning runs client-side via `setInterval` at 250ms to balance detection speed with browser thread responsiveness. Backend uses a unique compound index on `(eventId, ticketId)` to enforce duplicate rejection at the database level.

### Tier B (Choose 2 — 12 Marks)

#### 1. Real-Time Discussion Forum (6 Marks)
- **Justification**: Demonstrates proficiency in WebSockets, pub/sub architecture, and real-time state synchronization.
- **Design Choices**:
  - Participants auto-join Socket.IO rooms identified by `eventId`
  - Messages broadcast to the room and persist to `forum_messages` collection for history across reloads
  - **Message threading** with nested replies and visual indentation
  - **Emoji reactions** on messages with aggregate counts
  - **Message pinning** by organizers/admins with pinned message banner
  - **Organizer message styling** with distinct visual badges and colored borders
  - **Notification system** — organizer messages trigger notifications to all registered participants, displayed via a notification bell with unread count and polling every 30 seconds
  - **Access control** — forum access restricted to registered (and approved, for paid events) participants only
- **Technical Decisions**: Used Socket.IO rooms for efficient message routing without broadcasting to unrelated users. Notifications stored in a dedicated `notifications` collection rather than attempting to retrofit forum_messages, keeping concerns separated.

#### 2. Organizer Password Reset Workflow (6 Marks)
- **Justification**: Validates cross-role negotiation flows rather than standard self-service password recovery.
- **Design Choices**:
  - Organizers/participants submit reset requests with custom reasons
  - Admin reviews requests in a dedicated dashboard split into **Pending Requests** and **Password Reset History**
  - Admin can **reject with comments** — rejection reason is visible to the requester
  - Approved requests generate `crypto.randomBytes()` passwords, update the DB hash, and email the new password
  - Full request history with timestamps, status, and admin comments for audit trail
- **Technical Decisions**: Password generation uses `crypto.randomBytes(6).toString("hex")` for 12-character hex passwords. Rejection comments stored as `adminComment` on the request document for transparency.

### Tier C (Choose 1 — 2 Marks)

- **Google reCAPTCHA v2** on Login and Signup pages with backend verification to prevent bot abuse


## Additional Features
- **Dynamic Registration Forms** — organizers build custom forms with arbitrary fields per event
- **Role-Based Access Control** — Admin, Organizer, Participant with distinct dashboards and capabilities
- **Event Analytics** — organizer dashboard with overview stats (total events, published, upcoming, total registrations)
- **Personalized Event Feed** — participants see events filtered by their interests and followed organizers
- **Email Notifications** — registration confirmations, ticket delivery, password reset emails via SMTP

---

## Setup and Installation Instructions

### 1. Pre-requisites
- **Node.js**: v18.x or above
- **MongoDB**: A running local Mongo instance or a MongoDB Atlas URI
- **SMTP Credentials**: Standard email forwarding configs (e.g. Google App Passwords)

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `/backend` directory:
```env
PORT=5000
MONGO_URI=mongodb+srv://<your_user>:<your_pass>@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=super_secret_dev_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="Event Platform <your_email@gmail.com>"
FRONTEND_URL=http://localhost:5173
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

Start the server:
```bash
npm run dev
# or: node src/server.js (production)
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `/frontend` directory:
```env
VITE_API_URL=http://localhost:5000
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

Start the dev server:
```bash
npm run dev
```

### 4. First-Time Initialization
- Access the app at `http://localhost:5173`
- Navigate to `/login`. The platform auto-seeds a root Administrator on first boot:
  - **Email**: `admin@iiit.ac.in`
  - **Password**: `admin123`
- Login with root credentials and create Organizer profiles via the Admin Dashboard
