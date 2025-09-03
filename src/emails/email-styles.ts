// Email template styles - organized by component
// Note: These must be inline styles for email compatibility

export const emailStyles = {
  // Layout styles
  main: {
    backgroundColor: '#f6f6f6',
    fontFamily: 'Arial, sans-serif',
  },
  
  container: {
    margin: '0 auto',
    padding: '20px',
    maxWidth: '600px',
  },

  // Header styles
  header: {
    // backgroundColor: '#d10041', // EHCO key-color
    padding: '40px 20px',
    textAlign: 'center' as const,
    borderRadius: '12px 12px 0 0',
  },

  // Removed headerContent flexbox - now using table-based layout in template

  logo: {
    verticalAlign: 'middle' as const,
    // filter: 'brightness(0) invert(1)',
  },

  headerTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#d10041',
    margin: '0',
    letterSpacing: '2px',
  },

  headerSubtitle: {
    fontSize: '18px',
    color: '#d10041',
    margin: '0',
    opacity: '0.9',
  },

  // Content styles
  content: {
    backgroundColor: '#ffffff',
    padding: '40px 30px',
    borderRadius: '0 0 12px 12px',
  },

  greeting: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333333',
    margin: '0 0 20px 0',
  },

  paragraph: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#555555',
    margin: '0 0 20px 0',
  },

  // Info box styles
  infoBox: {
    backgroundColor: '#fff5f7', // Light tint of key-color
    border: '2px solid #f8c2cc',
    borderRadius: '8px',
    padding: '20px',
    margin: '30px 0',
  },

  infoTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#d10041', // EHCO key-color
    margin: '0 0 15px 0',
  },

  infoText: {
    fontSize: '14px',
    color: '#666666',
    margin: '5px 0',
  },

  // Button styles
  buttonSection: {
    textAlign: 'center' as const,
    margin: '30px 0',
  },

  button: {
    backgroundColor: '#d10041', // EHCO key-color
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    padding: '12px 30px',
    borderRadius: '25px',
    display: 'inline-block',
  },

  // Separator
  separator: {
    border: 'none',
    borderTop: '1px solid #e9ecef',
    margin: '30px 0',
  },

  // Footer styles
  footer: {
    textAlign: 'center' as const,
    padding: '20px 0',
  },

  footerText: {
    fontSize: '14px',
    color: '#888888',
    margin: '5px 0',
  },

  footerCopyright: {
    fontSize: '12px',
    color: '#aaaaaa',
    margin: '20px 0 0 0',
  },
};

// Notification email specific styles
export const notificationStyles = {
  ...emailStyles,
  
  // Override header for notification emails
  header: {
    backgroundColor: '#1a202c',
    padding: '30px 20px',
    textAlign: 'center' as const,
    borderRadius: '8px 8px 0 0',
  },

  headerTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffffff',
    margin: '0 0 8px 0',
  },

  headerSubtitle: {
    fontSize: '16px',
    color: '#cbd5e0',
    margin: '0',
  },

  // Notification specific sections
  senderSection: {
    backgroundColor: '#f7fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '20px',
    margin: '0 0 25px 0',
  },

  messageSection: {
    margin: '25px 0',
  },

  messageBox: {
    backgroundColor: '#f7fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '20px',
  },

  messageText: {
    fontSize: '14px',
    color: '#2d3748',
    lineHeight: '1.6',
    margin: '0',
    whiteSpace: 'pre-wrap' as const,
  },

  actionSection: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '6px',
    padding: '20px',
    margin: '25px 0 0 0',
  },

  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2d3748',
    margin: '0 0 15px 0',
  },

  infoRow: {
    fontSize: '14px',
    color: '#4a5568',
    margin: '8px 0',
    lineHeight: '1.4',
  },

  actionText: {
    fontSize: '14px',
    color: '#4a5568',
    margin: '8px 0',
  },
};
