# Event Planning & Management Platform

A comprehensive, full-stack event management system built using the **MERN stack** for organizing, managing, and participating in college fest events. The platform supports three distinct user roles — **Participant**, **Organizer**, and **Admin** — each with dedicated dashboards, workflows, and access controls.

---

## Table of Contents

1. [Libraries, Frameworks & Modules](#libraries-frameworks--modules)
2. [Advanced Features Implemented (Tier A / B / C)](#advanced-features-implemented-30-marks)
3. [Design Choices & Technical Decisions](#design-choices--technical-decisions)
4. [Setup & Installation](#setup--installation)

---

## Libraries, Frameworks & Modules

### Frontend

| Library | Version | Justification |
|---------|---------|---------------|
| **React** (via Vite) | 19.x | Component-driven SPA framework. **Vite** was chosen over Create React App for its native ESM support, instant HMR during development, and significantly faster production builds — reducing the feedback loop during iterative UI development. |
| **React Router DOM** | 7.x | Enables client-side routing across Admin, Organizer, and Participant interfaces. Used for SPA navigation with `ProtectedRoute` wrapper components that enforce **role-based access control** on every protected page, redirecting unauthorized users to login. |
| **Tailwind CSS** | 4.x | Utility-first CSS framework that eliminates the need for maintaining custom CSS files. Chosen for rapid prototyping of responsive layouts and consistent spacing/typography across the entire application without writing bespoke stylesheets. |
| **DaisyUI** | 5.x | Tailwind-based component library providing accessible, well-designed UI primitives (cards, modals, badges, tables, tabs, drawers). Significantly accelerates frontend development while maintaining visual consistency — solves the problem of building a polished UI from scratch. |
| **Axios** | 1.x | HTTP client with **interceptor support** for automatically injecting the JWT Bearer token from `localStorage` into every outgoing API request header. This centralizes authentication logic in a single place (`api/axios.js`) rather than manually attaching tokens in every fetch call. |
| **Socket.IO Client** | 4.x | Real-time bi-directional WebSocket communication powering the live **Event Discussion Forum**. Enables instant message delivery, reaction updates, and pin/delete broadcasts without constant HTTP polling — solving the real-time communication requirement for forums. |
| **jsQR** | 1.x | Client-side QR code decoder that operates directly on raw pixel data from an HTML5 Canvas element. Enables **live camera-based QR ticket scanning** entirely in the browser without needing server roundtrips for decoding. This saves bandwidth during physical event entry where many participants are scanned rapidly. |
| **qrcode.react** | 4.x | Client-side SVG/Canvas QR code generator used for rendering participant ticket QR codes in the Ticket/My Events views. Eliminates the need for backend image generation when displaying tickets in the browser. |
| **react-google-recaptcha** | 3.x | Google reCAPTCHA v2 checkbox widget integration for Login and Signup pages. Prevents automated bot registrations and brute-force login attempts by requiring human verification before form submission. |

### Backend

| Library | Version | Justification |
|---------|---------|---------------|
| **Node.js & Express.js** | 5.x | Lightweight, event-driven JavaScript runtime and web framework. Full-stack JavaScript eliminates context-switching between frontend and backend languages and simplifies shared validation logic. Express was chosen for its minimal overhead and mature middleware ecosystem. |
| **MongoDB (Native Driver)** | 7.x | NoSQL document database ideal for this project because of the **Dynamic Form Builder** feature — organizers can create custom registration forms with arbitrary fields (text, dropdown, checkbox, file upload) per event. MongoDB's schema-flexible document model handles these dynamic JSON payloads natively, which would require complex EAV patterns or JSONB workarounds in relational databases. The **native driver** was chosen over Mongoose for absolute query control, direct access to aggregation pipelines, and avoiding ODM overhead. |
| **jsonwebtoken (JWT)** | 9.x | Stateless authentication tokens encoding `userId` and `role` claims. JWTs enable **role-based access control** (RBAC) at the middleware level — every protected route validates the token and checks role boundaries (`admin`, `organizer`, `participant`) before processing the request. 24-hour token expiry balances security with usability. |
| **bcryptjs** | 3.x | Password hashing with configurable salt rounds (10 rounds), defending against rainbow table and brute-force attacks. Chosen over storing plaintext passwords as mandated by the assignment specification. bcryptjs is a pure JavaScript implementation — no native compilation dependencies, ensuring consistent behavior across OS environments and deployment platforms. |
| **Nodemailer** | 8.x | SMTP email integration for: registration confirmation emails with embedded QR ticket images, merchandise order approval notifications, and password reset credential delivery. Solves the requirement of sending tickets via email upon successful registration and purchase approval. |
| **qrcode** | 1.x | Server-side QR code image generation. Generates QR code data URLs containing ticket information (ticket ID, event ID, participant ID) that are embedded directly into confirmation emails. This ensures participants always have their ticket available even without accessing the web platform. |
| **Socket.IO** | 4.x | Server-side WebSocket management creating isolated **rooms per event** (`forum:<eventId>`) for real-time forum message broadcasting. Messages are emitted only to users in the same event room, not globally — solving efficient pub/sub routing. Also used for real-time pin/unpin and reaction synchronization. |
| **Cloudinary** | 2.x | Cloud-based media hosting for **payment proof uploads** in the merchandise approval workflow. Images are uploaded to Cloudinary rather than stored on the Node.js server filesystem — this prevents disk bloat on ephemeral hosting platforms (like Render) and enables CDN-backed delivery of proof images to organizers during the approval review. |
| **Multer** | 2.x | Multipart form-data parsing middleware for handling file uploads (payment proof images). Multer processes the `multipart/form-data` encoding before the request handler receives it, providing the file buffer required for Cloudinary upload. |
| **dotenv** | 17.x | Loads environment variables from `.env` files into `process.env`. Keeps sensitive configuration (database URIs, JWT secrets, SMTP credentials, API keys) out of source code and enables environment-specific configuration for development vs. production. |
| **cors** | 2.x | Cross-Origin Resource Sharing middleware. Required because the React frontend (served on `:5173` in development and from Vercel in production) makes API requests to the Express backend on a different origin. Without CORS headers, browsers would block all cross-origin API calls. |

---

## Advanced Features Implemented (30 Marks)

As per Section 13 of the assignment specification, the following advanced features have been implemented to reach exactly 30 marks: **Tier A (2 × 8 = 16)** + **Tier B (2 × 6 = 12)** + **Tier C (1 × 2 = 2)** = **30 Marks**.

### Tier A — Core Advanced Features (Choose 2 — 16 Marks)

#### 1. Merchandise Payment Approval Workflow [8 Marks]

**Justification for Selection:** This feature exercises complex transactional state machine logic — orders transition through `PENDING → APPROVED` or `PENDING → REJECTED` states with side effects (stock decrement, QR generation, email delivery) triggered only on approval. It demonstrates proficiency in multi-step business workflows, concurrent stock management, and integration of cloud file storage with approval UIs.

**Design Choices & Implementation Approach:**
- **Order Lifecycle:** Participants browse merchandise items on the Event Details page. Upon purchase, they upload a payment proof screenshot (jpg/png), and the order enters a `PENDING` state. No stock is decremented at order creation — preventing stock lockup from unapproved orders.
- **Organizer Approval Dashboard:** A dedicated "Merch Orders" tab on the event management page lets organizers view all orders with their uploaded payment proof images, current status (`PENDING`/`APPROVED`/`REJECTED`), and action buttons to approve or reject.
- **Approval Side Effects:** Upon approval, the backend atomically decrements stock using MongoDB `$inc` operators, generates a unique ticket with QR code, and sends a confirmation email with the ticket. This atomic stock operation prevents race conditions under concurrent approvals.
- **Rejection Flow:** Organizers can reject orders with optional comments explaining the reason. Rejected orders are visible to the participant in their order history with the rejection reason.
- **Per-User Purchase Limits:** Each merchandise item can have a configurable purchase limit per participant. The system aggregates existing `PENDING` and `APPROVED` orders for the same item/participant and enforces the cap before accepting new orders.

**Technical Decisions:**
- Payment proof images are uploaded to **Cloudinary** rather than stored on disk — avoiding filesystem issues on ephemeral hosting platforms and enabling CDN-backed delivery to organizers.
- Stock management uses MongoDB `$inc: { -quantity }` atomic operators to prevent overselling under concurrent approval requests.
- Order IDs are generated using `crypto.randomBytes` for uniqueness without centralized sequence counters.

---

#### 2. QR Scanner & Attendance Tracking [8 Marks]

**Justification for Selection:** Essential for bridging the digital registration system with physical event access control. This feature demonstrates real-time camera interaction, client-side image processing, and database-level duplicate prevention — all integrated into a live dashboard accessible to organizers during events.

**Design Choices & Implementation Approach:**
- **Live Camera QR Scanning:** Organizers open the Attendance page for an event and activate the device camera via the `getUserMedia` API. The live video feed is rendered to a `<canvas>` element, and `jsQR` decodes QR data from the canvas frames at regular intervals (~4 fps). Upon successful detection, the ticket is automatically submitted — no manual "confirm" step required.
- **Throttled Scanning:** Scanning is throttled with `setInterval` at 250ms to balance between detection speed and browser thread responsiveness, preventing rapid-fire duplicate submissions.
- **Duplicate Scan Rejection:** The backend uses a unique compound index on `(eventId, ticketId)` in the attendance collection. Duplicate entries are rejected at the database level with a clear error message displayed on the scanner UI.
- **Live Attendance Dashboard:** Displays real-time counts of scanned vs. not-yet-scanned participants. The participant list is shown with name, email, ticket ID, scan timestamp, and scan method (QR/Manual).
- **Manual Override:** For exceptional situations (lost QR code, identity verified manually), organizers can manually mark attendance by entering a ticket ID or selecting from the participant list. A required audit note/reason must be provided, creating an audit trail.
- **CSV Export:** Complete attendance records (name, email, ticket ID, timestamp, method, notes) can be exported as a downloadable CSV file for post-event reporting.

**Technical Decisions:**
- QR scanning runs entirely **client-side** using `jsQR` on raw canvas pixel data — no server roundtrip for decoding, reducing latency during rapid event check-in.
- Manual override entries are tagged with `method: "manual"` and include the organizer's audit note, stored alongside QR-scanned entries for transparent record keeping.
- Attendance records include both `ObjectId` and `string` event ID matching to handle storage format inconsistencies between collections.

---

### Tier B — Real-time & Communication Features (Choose 2 — 12 Marks)

#### 1. Real-Time Discussion Forum [6 Marks]

**Justification for Selection:** Demonstrates proficiency in WebSocket architecture, pub/sub patterns, and real-time state synchronization across multiple connected clients. The forum validates event-by-event access control and combines persistent storage with live broadcasting.

**Design Choices & Implementation Approach:**
- **Room-based Architecture:** Each event has its own Socket.IO room (`forum:<eventId>`). Participants auto-join the room upon navigating to the forum page. Messages are broadcast only to users in the same room, not globally.
- **Persistent Message History:** All messages are stored in the `forum_messages` MongoDB collection. Upon page load, the most recent messages are fetched via REST API (with cursor-based pagination). New messages are received in real-time via Socket.IO.
- **Message Threading:** Users can reply to specific messages, creating threaded conversations with visual indentation in the UI. Replies reference a `parentId` linking to the original message.
- **Emoji Reactions:** Users can react to messages with a curated set of emoji (👍, ❤️, 😂, 🔥, 👏). Reactions toggle on/off and aggregate counts are displayed per message. Reaction updates are broadcast in real-time.
- **Message Pinning:** Organizers and admins can pin/unpin important messages. Pinned messages are highlighted with a banner at the top of the forum. Pin state changes are broadcast to all connected users instantly.
- **Message Deletion:** Organizers can delete inappropriate messages. Deletion is broadcast to all connected clients who remove the message from their local view without refresh.
- **Organizer Visual Distinction:** Messages from organizers are styled with distinct badges and colored borders, making official communications easily identifiable.
- **Notification System:** When an organizer posts a message, notifications are created for all registered participants of that event. Notifications appear in the Navbar's notification bell with an unread count badge, and are polled every 30 seconds.
- **Access Control:** Forum access is restricted to registered (and approved, for paid/merchandise events) participants, the event's organizer, and admins. Unauthorized users receive a 403 error.

**Technical Decisions:**
- Socket.IO rooms provide efficient message routing without broadcasting to unrelated users — each `emit` targets only the event's room rather than all connected sockets.
- Notifications are stored in a dedicated `notifications` collection rather than retrofitting `forum_messages`, keeping read-state tracking and notification delivery concerns separated from the message storage layer.
- The forum supports `limit` and `before` query parameters for cursor-based pagination of historical messages.

---

#### 2. Organizer Password Reset Workflow [6 Marks]

**Justification for Selection:** Validates a cross-role negotiation flow (Organizer → Admin → Organizer) rather than standard self-service password recovery. This mirrors the real-world constraint where organizer accounts are admin-provisioned, so password resets must also be admin-mediated.

**Design Choices & Implementation Approach:**
- **Request Submission:** Organizers (and participants) can submit password reset requests from their login screen or profile. Each request includes a custom reason explaining why the reset is needed.
- **Admin Review Dashboard:** The Admin dashboard includes a dedicated "Password Reset Requests" section split into two views:
  - **Pending Requests:** Showing club/requester name, email, submission date, and stated reason.
  - **Password Reset History:** All past requests with their resolution (approved/rejected), admin comments, and timestamps.
- **Approval Flow:** Upon approving a request, the backend generates a new secure password using `crypto.randomBytes(6).toString("hex")` (12-character hex string), hashes it with bcrypt, updates the user's record, and sends the new password to the requester's email via Nodemailer. The admin also sees the generated password in the response for manual sharing if needed.
- **Rejection Flow:** Admin can reject requests with explanatory comments. The rejection reason is stored as `adminComment` on the request document, visible to the requester for transparency.
- **Request Status Tracking:** Each request tracks its lifecycle: `PENDING → APPROVED` or `PENDING → REJECTED`, with timestamps and admin comments forming an audit trail.

**Technical Decisions:**
- Password generation uses `crypto.randomBytes` from Node.js's cryptographic module — not `Math.random()` — ensuring unpredictable, high-entropy passwords.
- Reset requests are stored in a `reset_requests` collection with the requester's `userId`, `role`, `reason`, `status`, `adminComment`, and timestamps. This collection is cascade-deleted when an organizer is removed by the admin.

---

### Tier C — Integration & Enhancement Features (Choose 1 — 2 Marks)

#### 1. Bot Protection (reCAPTCHA) [2 Marks]

**Justification for Selection:** Low implementation overhead with high practical value. Prevents automated bot registrations and credential-stuffing attacks without degrading the user experience for legitimate users.

**Implementation:**
- **Google reCAPTCHA v2** checkbox widget is integrated on both the **Login** and **Signup** pages using the `react-google-recaptcha` library on the frontend.
- The captcha token is submitted alongside login/registration form data.
- The backend verifies the token against Google's `siteverify` API before processing the request. If verification fails, the request is rejected with a 400 error.
- Configuration is handled via environment variables (`RECAPTCHA_SECRET_KEY` on backend, `VITE_RECAPTCHA_SITE_KEY` on frontend), keeping credentials out of source code.
- Graceful degradation: if `RECAPTCHA_SECRET_KEY` is not configured (e.g., local development), captcha verification is skipped to avoid blocking development workflows.

---

## Design Choices & Technical Decisions

### Architecture Overview

- **No ORM/ODM (Raw MongoDB Driver):** Chosen deliberately over Mongoose because the dynamic form builder feature requires storing arbitrary, schema-less form definitions and responses. The native driver provides direct access to aggregation pipelines, atomic operators (`$inc`, `$push`, `$pull`), and compound index creation without ODM abstractions getting in the way.

- **JWT with localStorage:** Tokens are stored in `localStorage` and automatically injected into API requests via an Axios interceptor. Sessions persist across browser restarts (as required by the spec) and are cleared only on explicit logout. Token expiry is set to 24 hours.

- **Role-Based Access Control (RBAC):** Enforced at two layers:
  1. **Backend middleware:** `authRequired` validates JWT, `requireRole([...])` checks the token's role claim before any route handler executes.
  2. **Frontend `ProtectedRoute`:** Wrapper component that checks the user's stored role and redirects unauthorized users to login.

- **Admin Seeding:** The admin account is provisioned on first server boot via a seed script (`scripts/seedAdmin.js`). No UI registration exists for admins — the admin email and password are set in the backend code, meeting the spec requirement.

- **Event Status Computation:** Event status (`Draft`, `Published`, `Ongoing`, `Completed`, `Closed`) is computed dynamically from `startDate`, `endDate`, and an optional `statusOverride` field — rather than stored as a static value. This ensures status is always current without scheduled jobs.

- **Discord Webhook Integration:** Organizers can configure a Discord webhook URL in their profile. When an event is published, the system auto-posts an embed to the configured Discord channel with event details, solving the requirement for external notification.

- **Email with Embedded QR:** Registration confirmation emails include an inline QR code image (generated server-side as a data URL and embedded in the email HTML). This ensures participants have their ticket accessible even without opening the platform.

- **Notification Polling:** Forum notifications are polled every 30 seconds from the frontend Navbar component rather than using WebSockets for notifications. This simplifies the notification architecture — WebSockets are reserved for the forum's real-time message flow where sub-second latency matters, while notifications are acceptable with a 30-second delay.

---

## Setup & Installation

### Prerequisites

- **Node.js** v18.x or above
- **MongoDB** — A running local instance or a MongoDB Atlas cluster URI
- **SMTP Credentials** — For sending emails (e.g., Gmail with App Passwords enabled)
- **(Optional) Google reCAPTCHA Keys** — From the reCAPTCHA admin console for bot protection
- **(Optional) Cloudinary Account** — For payment proof image hosting in the merchandise workflow

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
PORT=3000
MONGO_URI=mongodb+srv://<your_user>:<your_pass>@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=super_secret_dev_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="Event Platform <your_email@gmail.com>"
FRONTEND_URL=http://localhost:5173
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the development server:

```bash
npm run dev
# or for production: npm start
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:3000
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

Start the development server:

```bash
npm run dev
```

### 3. First-Time Initialization

1. Access the application at `http://localhost:5173`
2. The backend auto-seeds a root **Admin** account on first boot:
   - **Email:** `admin@iiit.ac.in`
   - **Password:** `admin123`
3. Log in with the admin credentials
4. Create Organizer accounts via the Admin Dashboard — the system auto-generates login emails and passwords for each organizer
5. Share the generated credentials with organizers for them to log in
6. Participants self-register via the Signup page (IIIT students must use `@iiit.ac.in` email domain; non-IIIT participants can register with any email)
