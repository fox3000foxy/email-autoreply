// Utility functions for mail processing

export function isAutomatedSender(address: string): boolean {
    const local = (address.split("@")[0] || "").toLowerCase();
    return /^(?:do[-_.]?not[-_.]?reply|no[-_.]?reply|noreply|donotreply|mailer-daemon|postmaster|bounce[s]?|notifications?|news(?:letter)?|info|alert[s]?|digest|updates?|system|admin|webmaster|feedback|service|billing|receipts?|marketing|promo(?:tions?)?|support(?:[-_.+].*)?|help(?:desk)?)/i.test(local);
}

export function isValidEmail(address: string): boolean {
    // Basic RFC 5322 email validation
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(address);
}

export function isAutomatedByHeaders(headers: Record<string, string>): boolean {
    const precedence = headers["precedence"] || "";
    const autoSubmitted = headers["auto-submitted"] || "";
    const listUnsubscribe = headers["list-unsubscribe"] || "";
    const xAutoResponseSuppress = headers["x-auto-response-suppress"] || "";
    const xMailer = headers["x-mailer"] || "";
    return ["bulk", "list", "junk"].includes(precedence) ||
        (autoSubmitted !== "" && autoSubmitted !== "no") ||
        listUnsubscribe !== "" ||
        xAutoResponseSuppress !== "" ||
        /mailchimp|sendinblue|brevo|sendgrid|mailgun|amazonses|postmark/i.test(xMailer);
}
