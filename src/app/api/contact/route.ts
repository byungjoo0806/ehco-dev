import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import ContactConfirmation from '@/emails/contact-confirmation';
import ContactNotification from '@/emails/contact-notification';

const resend = new Resend(process.env.RESEND_API_KEY);

// Replace with your domain when you have one set up with Resend
const FROM_EMAIL = 'noreply@ehco.ai';
const TO_EMAIL = 'info@ehco.ai'; // Your email to receive notifications

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    // Validation
    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: 'Email, subject, and message are required' },
        { status: 400 }
      );
    }

    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      // Send notification email to you
      await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: `New Contact Form Submission: ${subject}`,
        react: ContactNotification({
          name,
          email,
          subject,
          message,
          submittedAt,
        }),
        // Also include plain text version as fallback
        text: `
New contact form submission:

Name: ${name || 'Not provided'}
Email: ${email}
Subject: ${subject}
Submitted: ${submittedAt}

Message:
${message}
        `.trim(),
      });

      console.log('✅ Notification email sent successfully');
    } catch (notificationError) {
      console.error('❌ Failed to send notification email:', notificationError);
      // Continue execution - don't fail the whole request if notification fails
    }

    try {
      // Send auto-reply confirmation to user
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Thank you for contacting EHCO',
        react: ContactConfirmation({
          name,
          subject,
          submittedAt,
        }),
        // Also include plain text version as fallback
        text: `
Hi ${name || 'there'},

Thank you for contacting EHCO! We've received your message about "${subject}" and will get back to you within 24 hours.

Submitted: ${submittedAt}

Best regards,
The EHCO Team

---
This is an automated response. Please don't reply to this email.
        `.trim(),
      });

      console.log('✅ Confirmation email sent successfully');
    } catch (confirmationError) {
      console.error('❌ Failed to send confirmation email:', confirmationError);
      // Continue execution - the form submission is still successful
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Your message has been sent successfully!' 
    });

  } catch (error) {
    console.error('❌ Contact form submission error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send message. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
