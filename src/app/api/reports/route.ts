// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase-admin';
import ReportNotification from '@/emails/report-notification';
import ReportConfirmation from '@/emails/report-confirmation';

const resend = new Resend(process.env.RESEND_API_KEY);

// Replace with your actual email addresses
const FROM_EMAIL = 'noreply@ehco.ai';    // Your sending address
const ADMIN_EMAIL = 'info@ehco.ai';      // Where you want to receive report notifications

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      figureId,
      figureName,
      figureNameKr,
      mainCategory,
      subcategory,
      eventGroupIndex,
      eventTitle,
      eventSummary,
      reportType,
      description,
      contactEmail,
      timestamp,
      submittedByUserId
    } = body;

    // Validate required fields
    if (!figureId || !figureName || !mainCategory || !subcategory || 
        typeof eventGroupIndex !== 'number' || !eventTitle || 
        !reportType || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate report type
    const validReportTypes = [
      'incorrect_information',
      'missing_information', 
      'duplicate_content',
      'inappropriate_content',
      'spam',
      'other'
    ];

    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      );
    }

    // Validate description length
    if (description.length > 1000) {
      return NextResponse.json(
        { error: 'Description too long' },
        { status: 400 }
      );
    }

    // Get client IP for tracking (optional, for spam prevention)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 
               request.headers.get('x-real-ip') || 
               'unknown';

    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Create the report document
    const reportData = {
      // Event information
      figureId,
      figureName,
      figureNameKr,
      mainCategory,
      subcategory,
      eventGroupIndex,
      eventTitle,
      eventSummary,
      
      // Report details
      reportType,
      description,
      contactEmail: contactEmail || null,
      
      // User information
      submittedByUserId: submittedByUserId || null,
      
      // Metadata
      submittedAt: new Date(), // Use regular Date for Admin SDK
      submittedTimestamp: timestamp,
      submitterIp: ip,
      status: 'pending', // pending, reviewed, resolved, dismissed
      
      // For admin review
      reviewedAt: null,
      reviewedBy: null,
      adminNotes: null,
      resolution: null
    };

    // Save to Firestore using Admin SDK
    const docRef = await adminDb.collection('reports').add(reportData);

    console.log('Report submitted successfully:', docRef.id);

    // Send email notifications
    try {
      // Send notification email to admin
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `New Content Report: ${reportType.replace('_', ' ')} - ${figureName}`,
        react: ReportNotification({
          figureId,
          figureName,
          figureNameKr,
          mainCategory,
          subcategory,
          eventTitle,
          eventSummary,
          reportType,
          description,
          contactEmail,
          submittedByUserId,
          submittedAt,
        }),
        // Plain text fallback
        text: `
New content report submitted:

Figure: ${figureName} (${figureNameKr})
Event: ${eventTitle}
Issue Type: ${reportType.replace('_', ' ')}
Submitted: ${submittedAt}

Description:
${description}

Reporter: ${contactEmail || 'Anonymous'}
${submittedByUserId ? `User ID: ${submittedByUserId}` : 'Not logged in'}

Review this report at your admin dashboard.
        `.trim(),
      });

      console.log('Admin notification email sent successfully');
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Continue - don't fail the whole request if notification fails
    }

    // Send confirmation email to user (if they provided an email)
    if (contactEmail) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: contactEmail,
          subject: 'Report Received - Thank you for helping improve EHCO',
          react: ReportConfirmation({
            figureName,
            eventTitle,
            reportType,
            submittedAt,
            contactEmail,
          }),
          // Plain text fallback
          text: `
Hi there,

Thank you for submitting a report about content on EHCO. We've received your report and our team will review it within 48 hours.

Report Details:
- Figure: ${figureName}
- Event: ${eventTitle}  
- Issue Type: ${reportType.replace('_', ' ')}
- Submitted: ${submittedAt}

If we need additional information, we'll reach out to you at this email address.

Best regards,
The EHCO Team

---
This is an automated response. Please don't reply to this email.
          `.trim(),
        });

        console.log('User confirmation email sent successfully');
      } catch (confirmationError) {
        console.error('Failed to send user confirmation email:', confirmationError);
        // Continue - don't fail the whole request if confirmation fails
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        reportId: docRef.id,
        message: 'Report submitted successfully' 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error submitting report:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to submit report. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to retrieve reports (for admin use)
export async function GET(request: NextRequest) {
  // This could be used for admin dashboard to view reports
  // For now, return a simple message
  return NextResponse.json(
    { message: 'Reports endpoint is active' },
    { status: 200 }
  );
}
