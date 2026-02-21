# Event Planning & Management Platform

A comprehensive, full-stack application built for organizing, managing, and participating in college club events, hackathons, and merchandise sales.

## Features & Architecture

This platform provides three distinct role-based interfaces (Admin, Organizer, Participant) mapped to customized workflows. Organizers can craft events with dynamic registration forms, track attendance, and sell merchandise. Participants browse personalized feeds based on their interests and followed clubs, register for events natively, and interact in real-time forums.

---

## 🛠 Libraries, Frameworks, and Modules

### Frontend
* **React (Vite)**: Selected for highly optimized, instant hot-module-replacement (HMR) during development and blistering fast production builds.
* **React Router DOM**: Enables seamless Single Page Application (SPA) routing, protected routes, and role-based redirects.
* **Tailwind CSS & DaisyUI**: Tailwind provides robust utility-first styling; DaisyUI layers accessible, aesthetically pleasing component classes on top of it, ensuring a premium feel without bogging down the bundle size.
* **Axios**: Simplifies HTTP requests, handles interceptors perfectly for injecting the JWT Bearer tokens automatically into every outgoing request.
* **Socket.IO-client**: Facilitates real-time, bi-directional communication to power the live Event Discussion Forums without constant HTTP polling.
* **jsQR**: A fast, client-side QR code decoder. By decoding QR tickets directly in the browser's HTML5 Canvas, we eliminate the need to upload images to the server purely for decoding, saving massive bandwidth during physical entry scans.
* **qrcode.react**: Generates crisp SVGs and Canvas QR codes client-side for tickets, completely unburdening the backend from generating and serving images.

### Backend
* **Node.js & Express.js**: Extremely lightweight, highly scalable JavaScript runtime. Prevents context-switching by allowing full-stack JS logic.
* **MongoDB (Native Driver)**: A NoSQL datastore was explicitly chosen over SQL to support **Dynamic Form Builders**. Since Organizers can inject custom registration fields on the fly, MongoDB handles these schemaless JSON payloads gracefully without strict, brittle migrations. Mongoose was bypassed in favor of the raw native driver for absolute query control and performance.
* **jsonwebtokens (JWT)**: Ensures stateless authentication. Tokens strictly map to RBAC boundaries (`admin`, `organizer`, `participant`).
* **bcrypt**: Safely hashes passwords at rest with randomized salt rounds to defend against rainbow table attacks.
* **nodemailer**: Configured to interface with standardized SMTP grids, seamlessly dropping confirmation and ticket emails directly into participant inboxes.
* **ics**: A lightweight utility to compile strictly compliant `.ics` calendar invitation payloads directly from the MongoDB event schemas.
* **Socket.IO**: Works heavily in tandem with the frontend to instantly marshal chat messages into specific Socket rooms mapped by `eventId`.

---

## 🚀 Advanced Features Implemented (30 Marks total)

As per Section 13 instructions, exactly 30 marks of advanced modules were carefully crafted.

### Tier A (Choose 2 — 16 Marks)
1. **Merchandise Payment Approval Workflow (8 Marks)**
   * **Justification**: Exposes the platform's ability to handle complex transactional state machines.
   * **Implementation**: Participants upload payment proofs, locking orders into a `PENDING` state. Organizers use a dedicated dashboard to audit the proofs. When approved, MongoDB atomic operations (`$inc`) safely decrement the `stockQuantity` preventing concurrency race conditions, immediately firing off a QR ticket and an email to the user.
2. **QR Scanner & Attendance Tracking (8 Marks)**
   * **Justification**: Essential for physical campus event workflows, demonstrating the bridge between digital authorization and physical access.
   * **Implementation**: Uses `jsQR` to decode uploaded or scanned QR code ticket hashes on the frontend. The extracted `ticketId` is bridged to the backend `POST /api/attendance/scan`, which locks the timestamp and blocks duplicate scans natively. The organizer table dynamically tracks attendance rates natively.

### Tier B (Choose 2 — 12 Marks)
1. **Real-Time Discussion Forum (6 Marks)**
   * **Justification**: Demonstrates proficiency in WebSockets, pub/sub layouts, and real-time state synchronization.
   * **Implementation**: Employs `Socket.IO`. Participants are automatically joined to an isolated Room named after the `eventId`. Emitted messages broadcast to the room and are concurrently synced to the `forum_messages` MongoDB collection to preserve history across reloads. Organizers receive moderator payloads that allow for real-time pinned/deleted commands to be forced onto participant clients.
2. **Organizer Password Reset Workflow (6 Marks)**
   * **Justification**: Validates the capability to construct cross-role negotiation flows rather than automated, standard self-service paths.
   * **Implementation**: Organizers push custom reasons into a `reset_requests` collection. The Admin checks a separate dashboard pooling these. Approving the request triggers `crypto.randomBytes()`, salting a new password natively into the DB, and providing it exactly once to the Admin UI for safe transmission to the Organizer.

### Tier C (Choose 1 — 2 Marks)
1. **Add to Calendar Integration (2 Marks)**
   * **Justification**: High utility enhancement that strictly organizes participant schedules directly into their OS-native routines.
   * **Implementation**: Using the `ics` package on a dedicated REST endpoint, dynamic `.ics` binaries are formed from the DB properties, and a dedicated Google Calendar string interpolator crafts instant-add URLs natively in the UI.

---

## ⚙️ Setup and Installation Instructions

### 1. Pre-requisites
* **Node.js**: v18.x or above.
* **MongoDB**: A running local Mongo instance or a MongoDB Atlas URI.
* **SMTP Credentials**: Standard email forwarding configs (e.g. Google App Passwords).

### 2. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the required Node dependencies:
   ```bash
   npm install
   ```
3. Establish Environment Variables by creating a `.env` file in the root of `/backend`:
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
   ```
4. Start the backend Node server:
   ```bash
   npm run dev
   # (or `node src/server.js` for production)
   ```

### 3. Frontend Setup
1. Open a separate terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Establish Environment Variables by creating a `.env` file inside `/frontend`:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 4. Initialization
* Access the app at `http://localhost:5173`.
* Navigate to `/login`. Upon first boot, the platform automatically drops a root Administrator into the database:
  * **Email**: `admin@iiit.ac.in`
  * **Password**: `admin123`
* Login with the root credentials and begin issuing standard Organizer profiles via the Dashboard!
