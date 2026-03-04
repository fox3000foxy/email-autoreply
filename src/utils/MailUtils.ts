// Utility functions for mail processing

export function isAutomatedSender(address: string): boolean {
    const local = (address.split("@")[0] || "").toLowerCase();
    const automatedPatterns = [
        "donotreply", "do-not-reply", "do_not_reply",
        "noreply", "no-reply", "no_reply",
        "mailer-daemon", "postmaster",
        "bounce", "bounces",
        "notification", "notifications",
        "newsletter", "news",
        "info", "alert", "alerts",
        "digest", "update", "updates",
        "system", "admin", "webmaster",
        "feedback", "service", "billing",
        "receipt", "receipts",
        "marketing", "promo", "promotion", "promotions",
        "support", "help", "helpdesk"
    ];
    return automatedPatterns.some(pattern => local.includes(pattern));
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
