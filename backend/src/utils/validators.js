/**
 * Normalise an email address: lowercase + trim.
 */
export function normalizeEmail(email) {
    return (email || "").toLowerCase().trim();
}

/**
 * Check whether the email belongs to the IIIT domain (iiit.ac.in).
 * Allows any valid local-part – only validates the domain portion.
 */
export function isValidIIITEmail(email) {
    const normalized = normalizeEmail(email);
    // Accept any local-part followed by @iiit.ac.in (or subdomains like @students.iiit.ac.in)
    return /^[^\s@]+@([a-zA-Z0-9-]+\.)*iiit\.ac\.in$/.test(normalized);
}

/**
 * Validate required fields for participant registration.
 * Returns an error string or null if valid.
 */
export function validateRegisterInput({
    email,
    password,
    firstName,
    lastName,
    participantType,
    collegeOrOrg,
    contact,
}) {
    if (!email || !password || !firstName || !lastName || !participantType || !collegeOrOrg || !contact) {
        return "Missing required fields: email, password, firstName, lastName, participantType, collegeOrOrg, contact";
    }
    if (!["IIIT", "NON_IIIT"].includes(participantType)) {
        return "participantType must be either IIIT or NON_IIIT";
    }
    if (participantType === "IIIT" && !isValidIIITEmail(email)) {
        return "IIIT participants must use a valid @iiit.ac.in email address";
    }
    if (password.length < 6) {
        return "Password must be at least 6 characters";
    }
    return null;
}

/**
 * Validate login input fields.
 */
export function validateLoginInput({ email, password }) {
    if (!email || !password) {
        return "Email and password are required";
    }
    return null;
}

/**
 * Validate admin organizer creation fields.
 */
export function validateOrganizerInput({ name, category }) {
    if (!name || !category) {
        return "name and category are required";
    }
    return null;
}

/**
 * Validate event creation / publish fields.
 * @param {object} data
 * @param {boolean} forPublish – enforce stricter checks when publishing
 */
export function validateEventInput(data, forPublish = false) {
    if (!data.name) return "Event name is required";
    if (!data.type) return "Event type is required";
    if (!["NORMAL", "MERCH"].includes(data.type))
        return "Event type must be NORMAL or MERCH";
    if (data.eligibility && !["IIIT", "NON_IIIT", "ALL"].includes(data.eligibility))
        return "Eligibility must be IIIT, NON_IIIT, or ALL";

    if (forPublish) {
        if (!data.startDate) return "startDate is required to publish";
        if (!data.endDate) return "endDate is required to publish";
        if (!data.registrationDeadline) return "registrationDeadline is required to publish";
        if (new Date(data.endDate) <= new Date(data.startDate))
            return "endDate must be after startDate";
        if (new Date(data.registrationDeadline) > new Date(data.startDate))
            return "registrationDeadline must be on or before startDate";
    }
    return null;
}
