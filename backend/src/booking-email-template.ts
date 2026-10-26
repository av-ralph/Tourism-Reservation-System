import type { Row } from './record-store.js';

export type BookingEmailEvent = 'instructor-approved' | 'instructor-declined' | 'admin-approved' | 'admin-rejected';

const siteUrl = 'https://hmreservation.vercel.app/';
const messages: Record<BookingEmailEvent, { subject: string; heading: string; body: string; status: string; color: string; tint: string }> = {
  'instructor-approved': {
    subject: 'Your HM laboratory request passed instructor review',
    heading: 'Your instructor approved your request',
    body: 'Your request is now with the laboratory administrator for final review. We will email you when a final decision is made.',
    status: 'Pending final approval', color: '#174c83', tint: '#eaf3fb',
  },
  'instructor-declined': {
    subject: 'Your HM laboratory request was declined',
    heading: 'Your request was declined',
    body: 'Your instructor could not approve this request. Please review the reason below, if provided, before making another booking.',
    status: 'Declined by instructor', color: '#9b3c20', tint: '#fff0e8',
  },
  'admin-approved': {
    subject: 'Your HM laboratory booking is approved',
    heading: 'Your booking is fully approved',
    body: 'Your HM laboratory reservation is ready. Open My bookings to view the final details and download your completed utilization form.',
    status: 'Fully approved', color: '#176344', tint: '#eaf7ef',
  },
  'admin-rejected': {
    subject: 'Your HM laboratory request was declined',
    heading: 'Your request was declined',
    body: 'The laboratory administrator could not approve this request. Please review the reason below, if provided, before making another booking.',
    status: 'Declined by administrator', color: '#9b3c20', tint: '#fff0e8',
  },
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

export function createBookingEmail(row: Row, event: BookingEmailEvent) {
  const message = messages[event];
  const name = String(row.name || 'student').trim();
  const reference = String(row.id || '').trim();
  const facility = String(row.facility || 'Not recorded').trim();
  const schedule = [row.date, [row.start, row.end].filter(Boolean).join('–')].filter(Boolean).join(' · ') || 'Not recorded';
  const reason = event === 'instructor-declined'
    ? String(row.instructorNote || row.reviewNote || '').trim()
    : event === 'admin-rejected' ? String(row.reviewNote || row.instructorNote || '').trim() : '';
  const text = [
    `Hello ${name},`, '', message.heading, message.body, '',
    `Status: ${message.status}`, `Booking reference: ${reference}`, `Space: ${facility}`,
    `Schedule: ${schedule}`, ...(reason ? [`Reason: ${reason}`] : []),
    '', `View My bookings: ${siteUrl}`, '', 'Cristal e-College HM Laboratory',
  ].join('\n');
  const detail = (label: string, value: string) => `<tr><td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top;width:120px">${label}</td><td style="padding:10px 0;color:#102f60;font-size:14px;font-weight:600;word-break:break-word">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(message.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fa;color:#17345e;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(message.status)} · Booking ${escapeHtml(reference)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6fa"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #dbe4ee;border-radius:14px;overflow:hidden">
<tr><td style="background:#153d6b;border-top:6px solid #fa6420;padding:20px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="62" style="vertical-align:middle"><img src="${siteUrl}cec.png" alt="Cristal e-College seal" width="54" height="54" style="display:block;width:54px;height:54px"></td>
<td style="vertical-align:middle;color:#ffffff;font-size:17px;font-weight:700;line-height:1.3">Cristal e-College<br><span style="color:#d7e5f3;font-size:12px;font-weight:400;letter-spacing:.04em">HOSPITALITY MANAGEMENT LABORATORY</span></td>
<td width="62" align="right" style="vertical-align:middle"><img src="${siteUrl}hm-logo.webp" alt="HM Hospitality Management logo" width="54" height="54" style="display:block;width:54px;height:54px"></td>
</tr></table></td></tr>
<tr><td style="padding:30px 28px 12px">
<span style="display:inline-block;background:${message.tint};color:${message.color};border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700">${message.status}</span>
<h1 style="margin:18px 0 12px;color:#102f60;font-size:25px;line-height:1.25">${message.heading}</h1>
<p style="margin:0 0 13px;color:#334b68;font-size:15px;line-height:1.6">Hello ${escapeHtml(name)},</p>
<p style="margin:0;color:#334b68;font-size:15px;line-height:1.6">${message.body}</p>
${reason ? `<div style="margin:20px 0 0;padding:14px 16px;background:#fff7ed;border-left:4px solid #fa6420;border-radius:5px;color:#6b3f23;font-size:14px;line-height:1.5"><strong>Reason:</strong> ${escapeHtml(reason)}</div>` : ''}
</td></tr>
<tr><td style="padding:12px 28px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f9fc;border:1px solid #e1e8f0;border-radius:9px"><tr><td style="padding:14px 18px">
<div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#62748e;padding-bottom:7px">BOOKING DETAILS</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${detail('Reference', reference)}${detail('Space', facility)}${detail('Schedule', schedule)}</table>
</td></tr></table></td></tr>
<tr><td style="padding:24px 28px 30px"><a href="${siteUrl}" style="display:inline-block;background:#f7631e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:7px">Open My bookings →</a>
<p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5">If the button does not work, visit <a href="${siteUrl}" style="color:#174c83">${siteUrl}</a> and open My bookings.</p></td></tr>
<tr><td style="background:#f7f9fc;border-top:1px solid #e1e8f0;padding:16px 28px;color:#64748b;font-size:12px;line-height:1.5">Cristal e-College · HM Laboratory<br>This is an update about your reservation. Please keep your booking reference for tracking.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: message.subject, text, html };
}
