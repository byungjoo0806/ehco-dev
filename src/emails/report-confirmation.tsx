import { Html, Head, Body, Container, Section, Text, Button, Hr, Img } from '@react-email/components';
import { emailStyles as styles } from './email-styles';

interface ReportConfirmationProps {
  figureName: string;
  eventTitle: string;
  reportType: string;
  submittedAt: string;
  contactEmail: string;
}

export default function ReportConfirmation({
  figureName,
  eventTitle,
  reportType,
  submittedAt,
  contactEmail
}: ReportConfirmationProps) {
  const formatReportType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Html>
      <Head />
      <Body style={styles.main}>
        <Container style={styles.container}>
          {/* Header with table-based layout */}
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
            <Text style={styles.headerSubtitle}>Report received - Thank you!</Text>
          </Section>

          {/* Main Content */}
          <Section style={styles.content}>
            <Text style={styles.greeting}>
              Hi there,
            </Text>

            <Text style={styles.paragraph}>
              {/* Corrected unescaped entity */}
              We&apos;ve successfully received your report about content on EHCO and truly appreciate
              you taking the time to help us maintain the accuracy and quality of our platform.
            </Text>

            <Text style={styles.paragraph}>
              {/* Corrected unescaped entity */}
              Our content moderation team will carefully review your report and take appropriate
              action within <strong>48 hours</strong>. We&apos;re committed to ensuring EHCO provides
              reliable and accurate information.
            </Text>

            {/* Information Box */}
            <Section style={styles.infoBox}>
              <Text style={styles.infoTitle}>📋 Your Report Details</Text>
              <Text style={styles.infoText}>Figure: {figureName}</Text>
              <Text style={styles.infoText}>Event: {eventTitle}</Text>
              <Text style={styles.infoText}>Issue Type: {formatReportType(reportType)}</Text>
              <Text style={styles.infoText}>Submitted: {submittedAt}</Text>
              <Text style={styles.infoText}>Status: Under Review</Text>
            </Section>

            <Text style={styles.paragraph}>
              {/* Corrected unescaped entity */}
              If we need additional information to investigate your report, we&apos;ll reach out to
              you at <strong>{contactEmail}</strong>.
            </Text>

            <Text style={styles.paragraph}>
              Continue exploring EHCO to discover more about your favorite public figures and
              stay updated with accurate, verified information.
            </Text>

            <Section style={styles.buttonSection}>
              <Button href="https://ehco.ai" style={styles.button}>
                Continue Browsing
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
              If you have additional concerns, please submit another report through our website.
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