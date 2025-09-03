import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import { notificationStyles as styles } from './email-styles';

interface ReportNotificationProps {
  figureId: string;
  figureName: string;
  figureNameKr: string;
  mainCategory: string;
  subcategory: string;
  eventTitle: string;
  eventSummary: string;
  reportType: string;
  description: string;
  contactEmail?: string;
  submittedByUserId?: string;
  submittedAt: string;
}

export default function ReportNotification({ 
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
  submittedAt
}: ReportNotificationProps) {
  const formatReportType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getPriority = (type: string) => {
    const highPriorityTypes = ['inappropriate_content', 'spam', 'incorrect_information'];
    if (highPriorityTypes.includes(type)) {
      return '🔴 High';
    } else if (type === 'missing_information') {
      return '🟡 Medium';
    }
    return '🟢 Normal';
  };

  return (
    <Html>
      <Head />
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.headerTitle}>🚨 New Content Report</Text>
            <Text style={styles.headerSubtitle}>EHCO Content Management</Text>
          </Section>

          {/* Main Content */}
          <Section style={styles.content}>
            <Text style={{...styles.paragraph, textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#2d3748'}}>
              Content Issue Report Submitted
            </Text>
            
            {/* Figure Information */}
            <Section style={styles.senderSection}>
              <Text style={styles.sectionTitle}>👤 Reported Figure</Text>
              <Text style={styles.infoRow}><strong>Name:</strong> {figureName}</Text>
              <Text style={styles.infoRow}><strong>Korean Name:</strong> {figureNameKr}</Text>
              <Text style={styles.infoRow}><strong>Figure ID:</strong> {figureId}</Text>
              <Text style={styles.infoRow}><strong>Category:</strong> {mainCategory} → {subcategory}</Text>
            </Section>

            {/* Event Information */}
            <Section style={styles.senderSection}>
              <Text style={styles.sectionTitle}>📅 Reported Event</Text>
              <Text style={styles.infoRow}><strong>Title:</strong> {eventTitle}</Text>
              <Text style={styles.infoRow}><strong>Summary:</strong> {eventSummary}</Text>
            </Section>

            <Hr style={styles.separator} />

            {/* Report Details */}
            <Section style={styles.messageSection}>
              <Text style={styles.sectionTitle}>🏷️ Report Details</Text>
              <Text style={styles.infoRow}><strong>Issue Type:</strong> {formatReportType(reportType)}</Text>
              <Text style={styles.infoRow}><strong>Submitted:</strong> {submittedAt}</Text>
              <Text style={styles.infoRow}><strong>Priority:</strong> {getPriority(reportType)}</Text>
            </Section>

            {/* Description */}
            <Section style={styles.messageSection}>
              <Text style={styles.sectionTitle}>📝 Issue Description</Text>
              <Section style={styles.messageBox}>
                <Text style={styles.messageText}>{description}</Text>
              </Section>
            </Section>

            {/* Reporter Information */}
            <Section style={styles.senderSection}>
              <Text style={styles.sectionTitle}>📧 Reporter Information</Text>
              <Text style={styles.infoRow}>
                <strong>Contact Email:</strong> {contactEmail || 'Not provided'}
              </Text>
              <Text style={styles.infoRow}>
                <strong>User Status:</strong> {submittedByUserId ? 'Registered User' : 'Anonymous'}
              </Text>
              {submittedByUserId && (
                <Text style={styles.infoRow}>
                  <strong>User ID:</strong> {submittedByUserId}
                </Text>
              )}
            </Section>

            {/* Action Items */}
            <Section style={styles.actionSection}>
              <Text style={styles.sectionTitle}>🎯 Next Steps</Text>
              <Text style={styles.actionText}>• Review the reported content for accuracy</Text>
              <Text style={styles.actionText}>• Verify the issue described by the reporter</Text>
              <Text style={styles.actionText}>• Take appropriate action (update, remove, or dismiss)</Text>
              {contactEmail && (
                <Text style={styles.actionText}>• Reply to reporter at: {contactEmail}</Text>
              )}
              <Text style={styles.actionText}>• Expected resolution time: Within 48 hours</Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This notification was automatically generated from the EHCO content reporting system.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
