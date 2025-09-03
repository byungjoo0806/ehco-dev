import { Html, Head, Body, Container, Section, Text, Button, Hr, Img } from '@react-email/components';
import { emailStyles as styles } from './email-styles';

interface ContactConfirmationProps {
  name: string;
  subject: string;
  submittedAt: string;
}

export default function ContactConfirmation({
  name,
  subject,
  submittedAt
}: ContactConfirmationProps) {
  return (
    <Html>
      <Head />
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* Header with table-based layout for email client compatibility */}
          <Section style={styles.header}>
            <table style={{
              width: '100%',
              margin: '0 auto 10px auto',
              borderCollapse: 'collapse' as const,
              tableLayout: 'fixed' as const
            }}>
              <tr>
                <td style={{
                  textAlign: 'center' as const,
                  verticalAlign: 'middle' as const,
                  width: '100%'
                }}>
                  <table style={{
                    margin: '0 auto',
                    borderCollapse: 'collapse' as const,
                    display: 'inline-table'
                  }}>
                    <tr>
                      <td style={{
                        verticalAlign: 'middle' as const,
                        paddingRight: '15px',
                        textAlign: 'center' as const
                      }}>
                        {/* Logo placeholder - replace with actual logo when hosted */}
                        <Img
                          src="https://ehco.ai/ehco_logo-120x120.png"
                          width="50"
                          height="50"
                          alt="EHCO Logo"
                          style={{
                            verticalAlign: 'middle',
                          }}
                        />
                      </td>
                      <td style={{
                        verticalAlign: 'middle' as const,
                        textAlign: 'left' as const
                      }}>
                        <Text style={{
                          ...styles.headerTitle,
                          margin: '0',
                          display: 'inline-block',
                          verticalAlign: 'middle'
                        }}>
                          EHCO
                        </Text>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <Text style={styles.headerSubtitle}>Thank you for reaching out!</Text>
          </Section>

          {/* Main Content */}
          <Section style={styles.content}>
            <Text style={styles.greeting}>
              Hi {name || 'there'},
            </Text>

            <Text style={styles.paragraph}>
              {/* Corrected unescaped entities */}
              We&apos;ve successfully received your message about <strong>&quot;{subject}&quot;</strong>
              and truly appreciate you taking the time to contact us.
            </Text>

            <Text style={styles.paragraph}>
              {/* Corrected unescaped entity */}
              Our team will carefully review your message and get back to you within
              <strong> 24 hours</strong>. We&apos;re committed to providing you with the best
              possible response to your inquiry.
            </Text>

            {/* Information Box */}
            <Section style={styles.infoBox}>
              <Text style={styles.infoTitle}>📧 Your Submission Details</Text>
              <Text style={styles.infoText}>Subject: {subject}</Text>
              <Text style={styles.infoText}>Submitted: {submittedAt}</Text>
              <Text style={styles.infoText}>Status: Under Review</Text>
            </Section>

            <Text style={styles.paragraph}>
              In the meantime, feel free to explore more about EHCO and stay updated
              with our latest content.
            </Text>

            <Section style={styles.buttonSection}>
              <Button href="https://ehco.ai" style={styles.button}>
                Visit EHCO
              </Button>
            </Section>
          </Section>

          <Hr style={styles.separator} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {/* Corrected unescaped entity */}
              This is an automated response. Please don&apos;t reply to this email.
            </Text>
            <Text style={styles.footerText}>
              If you have urgent inquiries, please contact us directly through our website.
            </Text>
            <Text style={styles.footerCopyright}>
              © 2025 EHCO. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}