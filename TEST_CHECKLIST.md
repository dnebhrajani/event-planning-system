# Manual Test Checklist – Event Management Platform

## Prerequisites
- MongoDB running locally
- Backend: `cd backend && npm run dev` (port 3000)
- Frontend: `cd frontend && npm run dev` (port 5173)
- Seed an admin user in users collection (role: "admin")

---

## 1. Authentication

### 1.1 Participant Registration
- [ ] Navigate to `/signup`
- [ ] Fill form (first name, last name, email, password, college, type IIIT/NON_IIIT)
- [ ] Submit – should redirect to participant dashboard
- [ ] Try duplicate email – should show error

### 1.2 Login
- [ ] Navigate to `/login`
- [ ] Login with registered participant – redirects to `/participant`
- [ ] Login with organizer credentials – redirects to `/organizer`
- [ ] Login with admin credentials – redirects to `/admin`
- [ ] Invalid credentials – shows error
- [ ] Logout – clears token, redirects to `/login`

---

## 2. Admin Dashboard

### 2.1 Organizer Management
- [ ] Create organizer (name, category, sub-category, description, contact email)
- [ ] Verify credentials banner shows email + generated password
- [ ] Verify organizer appears in table
- [ ] Disable organizer – badge turns "Disabled"
- [ ] Enable organizer – badge turns "Active"
- [ ] Delete organizer – removed from table (with confirmation)

### 2.2 Password Reset Requests Tab
- [ ] Switch to "Password Resets" tab
- [ ] Verify pending requests show count badge
- [ ] Approve request – shows new password in alert
- [ ] Reject request – status updates to "rejected"

---

## 3. Organizer

### 3.1 Dashboard
- [ ] View overview stats (Total Events, Published, Upcoming, Registrations)
- [ ] Quick action cards link to correct pages
- [ ] Password Reset: submit request → shows "pending" status
- [ ] After admin approves: shows new password

### 3.2 Profile
- [ ] Navigate to `/organizer/profile`
- [ ] View club name, description, category, contact email, Discord webhook
- [ ] Edit fields and save → changes persist on reload

### 3.3 Create Event
- [ ] Navigate to `/organizer/create-event`
- [ ] Fill all fields (name, type, eligibility, dates, description, tags, fee, limit)
- [ ] Submit → redirects to My Events

### 3.4 My Events
- [ ] View list of all events with status badges
- [ ] Click "Edit" on draft event → opens edit form
- [ ] Click "Publish" on draft → status changes to Published
- [ ] Click "Manage" → opens manage page

### 3.5 Manage Event
- [ ] Overview tab: event details, action buttons
- [ ] Analytics tab: registration count, attended, IIIT/Non-IIIT, revenue, fill rate
- [ ] Participants tab: table with filters (type, attendance), CSV export
- [ ] Links to Attendance, Form Builder, Merch Orders, Discussion Forum

### 3.6 Form Builder
- [ ] Navigate from Manage Event → "Form Builder"
- [ ] Add fields: text, textarea, number, select, checkbox, file
- [ ] Set required flag
- [ ] Reorder fields (Up/Dn buttons)
- [ ] Remove fields (X button)
- [ ] For select type: enter comma-separated options
- [ ] Save → success message
- [ ] Reload → fields persist

### 3.7 Attendance
- [ ] Navigate from Manage Event → "Attendance"
- [ ] Enter ticket ID in scan box → click "Mark Attendance" → success message
- [ ] Enter ticket ID in manual box → click "Mark Manually" → success message
- [ ] Duplicate attendance → shows conflict error
- [ ] Records appear in table
- [ ] Export CSV → downloads file

### 3.8 Merch Orders Management
- [ ] Navigate from Manage Event → "Merch Orders"
- [ ] Edit Items: add merch items (name, price, sizes), save
- [ ] View orders table
- [ ] Approve order → status changes
- [ ] Reject order → status changes

---

## 4. Participant

### 4.1 Dashboard
- [ ] View dashboard at `/participant`
- [ ] Navigation links: Dashboard, Profile, Browse Events, My Events, Clubs, Merch Orders

### 4.2 Profile
- [ ] Navigate to `/participant/profile`
- [ ] View/edit first name, last name, contact, college
- [ ] Toggle areas of interest
- [ ] View followed clubs list with unfollow option
- [ ] Save → changes persist

### 4.3 Browse Events
- [ ] Navigate to `/participant/events`
- [ ] Search by event name
- [ ] Filter by type/eligibility
- [ ] Click event → opens event detail

### 4.4 Event Details
- [ ] View event info (name, organizer, type, dates, registration count, fee, tags)
- [ ] Register for event → success banner with ticket ID
- [ ] QR code displayed (if qrcode.react installed)
- [ ] Already registered → shows "You are registered" message
- [ ] "Add to Calendar" section: Google Calendar, Outlook, .ics download links
- [ ] "Discussion Forum" button → navigates to forum

### 4.5 My Events
- [ ] Navigate to `/participant/my-events`
- [ ] View list of registered events with ticket IDs
- [ ] Tab filtering if supported (Upcoming, Completed)

### 4.6 Clubs / Organizers
- [ ] Navigate to `/participant/organizers`
- [ ] Search by name
- [ ] Filter by category
- [ ] Follow/Unfollow clubs
- [ ] Click club → opens detail page with upcoming/past events

### 4.7 Merch Orders
- [ ] Navigate to `/participant/merch-orders`
- [ ] View all orders with status badges (pending/approved/rejected)
- [ ] Order items and totals displayed correctly

---

## 5. Discussion Forum

- [ ] Navigate to `/forum/:eventId` (from Event Details or Manage Event)
- [ ] Send message → appears in chat
- [ ] Messages show sender name, role badge, timestamp
- [ ] Delete own message → removed from list
- [ ] Organizer/admin can delete any message
- [ ] (If socket.io-client installed) Real-time updates across tabs

---

## 6. Calendar Integration

- [ ] On Event Details: "Add to Calendar" section visible
- [ ] "Google Calendar" link opens Google Calendar with event data
- [ ] "Outlook" link opens Outlook with event data
- [ ] "Download .ics" link downloads valid ICS file

---

## 7. Cross-Cutting

- [ ] Protected routes redirect to login when not authenticated
- [ ] Role-based access: participant can't access `/organizer/*` and vice versa
- [ ] 401/403 errors clear auth state and redirect to login
- [ ] All API errors display user-friendly messages
- [ ] Navbar shows correct links per role
