'use client';

import { useState } from 'react';
import ContactConfirmation from '@/emails/contact-confirmation';
import ContactNotification from '@/emails/contact-notification';
import ReportConfirmation from '@/emails/report-confirmation';
import ReportNotification from '@/emails/report-notification';

// This component lets you preview your email templates during development
// Visit /email-preview in your browser to see how emails will look
export default function EmailPreview() {
  const [activeTemplate, setActiveTemplate] = useState<'confirmation' | 'notification' | 'reportConfirmation' | 'reportNotification'>('confirmation');

  const sampleData = {
    name: 'John Doe',
    email: 'john@example.com',
    subject: 'Feature Request',
    message: 'I would love to see a dark mode feature added to EHCO. It would really help with late-night browsing and make the experience more comfortable for users like me who prefer darker interfaces.',
    submittedAt: new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  const sampleReportData = {
    figureId: 'taylor-swift-001',
    figureName: 'Taylor Swift',
    figureNameKr: '테일러 스위프트',
    mainCategory: 'Entertainment',
    subcategory: 'Music',
    eventTitle: '2023 Grammy Awards Performance',
    eventSummary: 'Taylor Swift won Album of the Year for Midnights at the 65th Annual Grammy Awards',
    reportType: 'incorrect_information',
    description: 'The event summary states she won Album of the Year, but I believe the actual award was for Best Pop Vocal Album. Please verify this information.',
    contactEmail: 'reporter@example.com',
    submittedByUserId: 'user123',
    submittedAt: new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      padding: '20px', 
      backgroundColor: '#f5f5f5', 
      minHeight: '100vh' 
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '30px', 
          color: '#333' 
        }}>
          📧 Email Template Preview
        </h1>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <button 
            onClick={() => setActiveTemplate('confirmation')}
            style={{
              padding: '10px 20px',
              margin: '0 5px 10px 5px',
              backgroundColor: activeTemplate === 'confirmation' ? '#d10041' : '#ddd',
              color: activeTemplate === 'confirmation' ? 'white' : '#333',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Contact Confirmation
          </button>
          <button 
            onClick={() => setActiveTemplate('notification')}
            style={{
              padding: '10px 20px',
              margin: '0 5px 10px 5px',
              backgroundColor: activeTemplate === 'notification' ? '#d10041' : '#ddd',
              color: activeTemplate === 'notification' ? 'white' : '#333',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Contact Notification
          </button>
          <button 
            onClick={() => setActiveTemplate('reportConfirmation')}
            style={{
              padding: '10px 20px',
              margin: '0 5px 10px 5px',
              backgroundColor: activeTemplate === 'reportConfirmation' ? '#d10041' : '#ddd',
              color: activeTemplate === 'reportConfirmation' ? 'white' : '#333',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Report Confirmation
          </button>
          <button 
            onClick={() => setActiveTemplate('reportNotification')}
            style={{
              padding: '10px 20px',
              margin: '0 5px 10px 5px',
              backgroundColor: activeTemplate === 'reportNotification' ? '#d10041' : '#ddd',
              color: activeTemplate === 'reportNotification' ? 'white' : '#333',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Report Notification
          </button>
        </div>

        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {activeTemplate === 'confirmation' ? (
            <ContactConfirmation 
              name={sampleData.name}
              subject={sampleData.subject}
              submittedAt={sampleData.submittedAt}
            />
          ) : activeTemplate === 'notification' ? (
            <ContactNotification 
              name={sampleData.name}
              email={sampleData.email}
              subject={sampleData.subject}
              message={sampleData.message}
              submittedAt={sampleData.submittedAt}
            />
          ) : activeTemplate === 'reportConfirmation' ? (
            <ReportConfirmation 
              figureName={sampleReportData.figureName}
              eventTitle={sampleReportData.eventTitle}
              reportType={sampleReportData.reportType}
              submittedAt={sampleReportData.submittedAt}
              contactEmail={sampleReportData.contactEmail}
            />
          ) : (
            <ReportNotification 
              figureId={sampleReportData.figureId}
              figureName={sampleReportData.figureName}
              figureNameKr={sampleReportData.figureNameKr}
              mainCategory={sampleReportData.mainCategory}
              subcategory={sampleReportData.subcategory}
              eventTitle={sampleReportData.eventTitle}
              eventSummary={sampleReportData.eventSummary}
              reportType={sampleReportData.reportType}
              description={sampleReportData.description}
              contactEmail={sampleReportData.contactEmail}
              submittedByUserId={sampleReportData.submittedByUserId}
              submittedAt={sampleReportData.submittedAt}
            />
          )}
        </div>

        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          backgroundColor: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ color: '#333', marginTop: '0' }}>📝 Sample Data Used:</h3>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '5px',
            fontSize: '14px',
            overflow: 'auto'
          }}>
{JSON.stringify(sampleData, null, 2)}
          </pre>
        </div>

        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fff5f7', 
          borderRadius: '8px',
          border: '1px solid #d10041'
        }}>
          <p style={{ margin: '0', color: '#d10041' }}>
            💡 <strong>Development Tip:</strong> This preview page helps you see how your emails 
            will look without actually sending them. Modify the email templates in 
            <code>/src/emails/</code> and refresh to see changes.
          </p>
        </div>
      </div>
    </div>
  );
}
