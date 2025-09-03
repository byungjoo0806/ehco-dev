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

interface ContactNotificationProps {
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
}

export default function ContactNotification({ 
  name, 
  email, 
  subject, 
  message, 
  submittedAt 
}: ContactNotificationProps) {
  return (
    <Html>
      <Head />
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.headerTitle}>🔔 New Contact Form Submission</Text>
            <Text style={styles.headerSubtitle}>EHCO Contact Form</Text>
          </Section>

          {/* Main Content */}
          <Section style={styles.content}>
            <Text style={{...styles.paragraph, textAlign: 'center', fontSize: '20px', fontWeight: 'bold', color: '#2d3748'}}>
              New message received from your website
            </Text>
            
            {/* Sender Info */}
            <Section style={styles.senderSection}>
              <Text style={styles.sectionTitle}>👤 Sender Information</Text>
              <Text style={styles.infoRow}><strong>Name:</strong> {name || 'Not provided'}</Text>
              <Text style={styles.infoRow}><strong>Email:</strong> {email}</Text>
              <Text style={styles.infoRow}><strong>Subject:</strong> {subject}</Text>
              <Text style={styles.infoRow}><strong>Submitted:</strong> {submittedAt}</Text>
            </Section>

            <Hr style={styles.separator} />

            {/* Message Content */}
            <Section style={styles.messageSection}>
              <Text style={styles.sectionTitle}>💬 Message Content</Text>
              <Section style={styles.messageBox}>
                <Text style={styles.messageText}>{message}</Text>
              </Section>
            </Section>

            {/* Action Items */}
            <Section style={styles.actionSection}>
              <Text style={styles.sectionTitle}>🎯 Next Steps</Text>
              <Text style={styles.actionText}>• Reply to: {email}</Text>
              <Text style={styles.actionText}>• Expected response time: Within 24 hours</Text>
              <Text style={styles.actionText}>• Priority: {getPriority(subject)}</Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This notification was automatically generated from your EHCO contact form.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function getPriority(subject: string): string {
  const highPriorityKeywords = ['bug', 'error', 'urgent', 'problem', 'issue'];
  const lowPriority = subject.toLowerCase();
  
  if (highPriorityKeywords.some(keyword => lowPriority.includes(keyword))) {
    return '🔴 High';
  } else if (subject.toLowerCase().includes('feature')) {
    return '🟡 Medium';
  }
  return '🟢 Normal';
}
