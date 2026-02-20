# Felicity Event Management System

A comprehensive, centralized platform built to streamline the management of events, clubs, and participants for Felicity. The system eliminates the chaos of scattered Google Forms and spreadsheets by offering robust role-based dashboards, dynamic registration workflows, merchandise handling, and real-time communication.

## 1. Technology Stack & Justifications

### Frontend
*   **React (v19)**: Used for building the user interface. Its component-based architecture ensures reusability across complex views like Dashboards and Event Details.
*   **Vite**: Chosen as the frontend build tool for its extremely fast Hot Module Replacement (HMR) and optimized production builds, outperforming older tools like Create React App.
*   **React Router DOM (v7)**: Implements client-side routing, enabling seamless transitions between nested layouts (e.g., switching between My Events tabs) without full page reloads.
*   **Tailwind CSS & DaisyUI**: Tailwind provides highly customizable utility classes for rapid styling. DaisyUI sits on top of Tailwind to provide semantic, accessible, pre-built components (buttons, cards, modals), significantly accelerating UI development while maintaining a cohesive, modern aesthetic.
*   **Axios**: Chosen over native `fetch` for its built-in interceptor support, which cleanly handles attaching JWT authorization headers to every outgoing request and centralizing error handling.
*   **jsQR**: Used for client-side QR code scanning. It decodes uploaded QR ticket images directly in the browser via HTML5 Canvas, securely transmitting only the ticket payload to the server, heavily reducing backend computational load and bandwidth usage.
*   **qrcode.react**: Used to instantly render crisp, scalable SVG QR codes for event tickets directly within React components.
*   **socket.io-client**: The client-side counterpart for establishing persistent WebSocket connections, enabling instantaneous message delivery for the event discussion forums.

### Backend
*   **Node.js & Express (v5)**: Express provides a lightweight, flexible routing system well-suited for RESTful APIs. Node.js allows for a unified JavaScript ecosystem across the entire stack.
*   **MongoDB (Native Driver)**: Chosen over strict ORMs (like Mongoose) to maximize flexibility and performance. Since organizing events requires dynamic, custom registration forms (where fields vary per event), the schema-less nature of native MongoDB allows us to store unpredictable `formAnswers` and perform complex atomic updates (like `$inc` for merchandise stock) seamlessly.
*   **JSON Web Token (JWT)**: Ensures scalable, stateless authentication for all protected routes, enforcing strict Role-Based Access Control (RBAC) securely.
*   **bcrypt**: Essential for security; hashes user passwords with a salt before storing them, ensuring no plaintext passwords exist in the database.
*   **multer**: Handles `multipart/form-data` parsing, enabling smooth processing of file uploads (specifically for merchandise payment proof images).
*   **nodemailer**: Standardizes automated email delivery for essential workflows, such as ticket generation confirmations and sending provisional credentials to newly onboarded Organizer accounts.
*   **socket.io**: Enables real-time, bidirectional communication by segregating socket connections into event-specific "rooms," optimizing the broadcast of chat messages in the discussion forum.
*   **ics**: A dedicated package for programmatically generating perfectly formatted `.ics` calendar files, avoiding fragile manual string-concatenation schemas.
*   **cors & dotenv**: Standard modules implemented to handle Cross-Origin Resource Sharing safely and keep environment variables securely isolated.

---

## 2. Advanced Features Implemented (Tier A, B, C)

To meet the complete 30-mark requirement, the following exact features were implemented.

### Tier A: Core Advanced Features (16 Marks)
1. **Merchandise Payment Approval Workflow (8 Marks)**
    *   **Justification:** Managing hard goods involves physical constraints and manual verifications. This feature bridges the gap between digital registration and offline payment processing.
    *   **Implementation & Design:** Built a state-machine logic (Pending -> Approved/Rejected). Participants upload payment proofs via `multer`. Organizers have a dedicated UI to review the images. The backend uses atomic `$inc` constraints to ensure stock cannot be overallocated even under concurrent approval attempts. Tickets / QR codes are *only* minted upon strict "APPROVED" status.
2. **QR Scanner & Attendance Tracking (8 Marks)**
    *   **Justification:** Vital for fast throughput at college fests, avoiding manual checklist bottlenecks.
    *   **Implementation & Design:** Utilizing `jsQR`, the Organizer uploads a screenshot/image of the participant's QR code. The browser paints it to a hidden `<canvas>`, extracts the Uint8ClampedArray pixel data, and decodes the JSON payload. The backend validates the cryptographic integrity of the ticket and gracefully rejects duplicates, keeping secure timestamped logs in the `attendance` collection. Complete with CSV exports.

### Tier B: Real-time & Communication Features (12 Marks)
1. **Real-Time Discussion Forum (6 Marks)**
    *   **Justification:** Solves the core assignment thesis ("information vanishing into WhatsApp groups") by decentralizing communication directly to the relevant event context.
    *   **Implementation & Design:** Integrated `socket.io`. When a user visits an Event Detail page, they silently `join_room` mapped directly to the `eventId`. Messages are persisted to MongoDB via an API call and simultaneously broadcast via websockets to all connected clients in that room for instant UI updates.
2. **Organizer Password Reset Workflow (6 Marks)**
    *   **Justification:** Crucial administrative requirement because organizers do not have self-serve registration. Without this, admins would have to manually tamper with DB hashes.
    *   **Implementation & Design:** Dedicated `reset_requests` collection. Organizers submit a reason via their profile. The Admin Dashboard maps over pending requests. Upon approval, the backend securely generates a secure temporary string, hashes it via `bcrypt`, replaces the Organizer's record, and resolves the request state. 

### Tier C: Integration & Enhancement Features (2 Marks)
1. **Add to Calendar Integration (2 Marks)**
    *   **Justification:** Directly tackles the problem of participants missing events due to forgetfulness.
    *   **Implementation & Design:** The backend exposes `/api/calendar/events/:eventId/ics`. Using the `ics` Node package, it maps our `startDate` and `endDate` formats into stringent arrays `[YYYY, MM, DD, HH, mm]`. Additionally, URL query handlers were written to dynamically redirect users directly to the pre-filled Google Calendar web interface.

---

## 3. Setup & Installation Instructions

### Prerequisites
*   Node.js (v18 or higher recommended)
*   Local MongoDB instance running on `mongodb://localhost:27017`

### Backend Setup
1. Inside the root directory, navigate to the backend:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables by copying the example:
   ```bash
   cp .env.example .env
   ```
   *(Ensure your `MONGO_URI` is correct. You may also configure `SMTP_*` variables if you wish to test real email capability, but it is not strictly required for local browsing).*
4. Seed the Admin user:
   ```bash
   npm run seed:admin
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *(The backend runs on `http://localhost:3000`)*

### Frontend Setup
1. Open a new terminal instance and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *(The frontend typically spins up on `http://localhost:5173`. A local `.env` file should already point `VITE_API_URL` to the backend).*

### Evaluation Bootstrapping
Once successfully running locally:
1. Try logging into the portal using the seeded admin credentials configured in your backend `.env` file (`admin@example.com` / `admin123`).
2. Navigate to the Admin Dashboard and provision a new Organizer (the dashboard will supply the temporary generated password).
3. Log in as the Organizer, set up an event, configure a custom form, publish it, and test the real-time flows as a self-registered Participant!
# event-planning-system
