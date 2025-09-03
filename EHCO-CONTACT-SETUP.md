# EHCO Contact Form Setup Guide

## Overview
Your contact form has been upgraded to use **Resend + React Email** for professional email templates and automatic responses. This replaces the previous Formspree integration with a more customizable solution.

## What's New
✅ **Auto-reply emails** - Users get a beautiful confirmation email immediately  
✅ **Notification emails** - You receive styled notifications for new submissions  
✅ **Professional templates** - Branded email designs with your EHCO styling  
✅ **Better error handling** - More robust submission processing  
✅ **Development-friendly** - Easy to customize and extend  

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Get Your Resend API Key
1. Go to [resend.com](https://resend.com) and create a free account
2. Navigate to **API Keys** in your dashboard
3. Create a new API key
4. Copy the key (starts with `re_`)

### 3. Update Environment Variables
Replace `your-resend-api-key-here` in your `.env` file:
```env
RESEND_API_KEY="re_your_actual_api_key_here"
```

### 4. Configure Domain & Email Addresses
Edit `/src/app/api/contact/route.ts`:

```typescript
// Replace these with your actual values
const FROM_EMAIL = 'noreply@yourdomain.com';  // Your sending domain
const TO_EMAIL = 'your-email@example.com';     // Where you want to receive notifications
```

**Important**: For production, you'll need to:
- Add and verify your domain in Resend dashboard
- Update `FROM_EMAIL` to use your verified domain

### 5. Test the Integration

#### Development Testing
1. Start your development server: `npm run dev`
2. Go to `http://localhost:3000/contact-us`
3. Submit a test form

#### What Should Happen
- ✅ User sees success message
- ✅ User receives confirmation email (to their email)
- ✅ You receive notification email (to `TO_EMAIL`)
- ✅ Console shows email sending logs

## Email Templates

### User Confirmation Email
- **Template**: `/src/emails/contact-confirmation.tsx`
- **Features**: Branded header, submission details, call-to-action button
- **Customizable**: Colors, content, branding

### Admin Notification Email  
- **Template**: `/src/emails/contact-notification.tsx`
- **Features**: Complete submission details, priority indicators, action items
- **Includes**: Sender info, message content, timestamps

## Customization Options

### 1. Modify Email Templates
Edit the React components in `/src/emails/` to match your brand:
- Colors and styling
- Logo and branding
- Content and messaging
- Call-to-action buttons

### 2. Add New Email Types
Create new templates for different scenarios:
- Follow-up emails
- Different auto-replies based on subject
- Escalation notifications

### 3. Enhanced Form Processing
Extend `/src/app/api/contact/route.ts` to:
- Save submissions to database
- Integrate with CRM systems
- Add spam filtering
- Include file attachments

## Free Tier Limits
- **Resend Free**: 3,000 emails/month, 100 emails/day
- **Perfect for**: Most small to medium websites
- **Upgrade**: Available when you need higher limits

## Troubleshooting

### Emails Not Sending
1. **Check API Key**: Ensure `RESEND_API_KEY` is correctly set
2. **Verify Domain**: In production, domain must be verified in Resend
3. **Check Logs**: Look at browser console and terminal output
4. **Email Limits**: Check if you've hit free tier limits

### Development Domain Issues
For development, you can use:
```typescript
const FROM_EMAIL = 'onboarding@resend.dev'; // Resend's test domain
```

### Production Checklist
- [ ] Domain verified in Resend dashboard
- [ ] Environment variables set correctly
- [ ] FROM_EMAIL updated to your domain
- [ ] TO_EMAIL set to your actual email
- [ ] Test emails working in production
- [ ] Email templates match your brand

## Advanced Features

### Add Database Storage
```typescript
// In /src/app/api/contact/route.ts, add before sending emails:
import { db } from '@/lib/firebase'; // Your existing Firebase setup

// Store submission in Firestore
const submissionData = {
  name,
  email,
  subject,
  message,
  submittedAt: new Date(),
  status: 'pending',
  ipAddress: request.ip || 'unknown',
};

await db.collection('contact_submissions').add(submissionData);
```

### Conditional Auto-Replies
```typescript
// Different responses based on subject
const getEmailTemplate = (subject: string) => {
  if (subject.includes('Bug Report')) {
    return BugReportConfirmation; // Create this template
  } else if (subject.includes('Feature Request')) {
    return FeatureRequestConfirmation;
  }
  return ContactConfirmation; // Default template
};
```

### Rate Limiting
```typescript
// Add to API route to prevent spam
const submissions = await db
  .collection('contact_submissions')
  .where('email', '==', email)
  .where('submittedAt', '>', new Date(Date.now() - 60 * 60 * 1000)) // Last hour
  .get();

if (submissions.size >= 3) {
  return NextResponse.json(
    { error: 'Too many submissions. Please wait before submitting again.' },
    { status: 429 }
  );
}
```

## Migration Notes

### From Formspree
The new system replaces your Formspree integration:
- **Old**: Form posts to `https://formspree.io/f/xvgrkeae`
- **New**: Form posts to `/api/contact` (your own API)
- **Benefit**: Full control over email templates and processing

### Backward Compatibility
If you want to keep Formspree as backup:
```typescript
// In handleSubmit, add fallback:
try {
  const response = await fetch('/api/contact', { /* ... */ });
  // Handle new system
} catch (error) {
  // Fallback to Formspree
  const fallbackResponse = await fetch('https://formspree.io/f/xvgrkeae', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
}
```

## Support & Maintenance

### Monitoring
- Check Resend dashboard for delivery stats
- Monitor API route logs for errors
- Set up alerts for failed submissions

### Regular Tasks
- Review email templates quarterly
- Update contact information as needed
- Monitor usage against free tier limits
- Test form functionality monthly

## Next Steps

1. **Immediate**: Set up Resend account and test the integration
2. **Short-term**: Customize email templates to match your brand
3. **Medium-term**: Add database storage for submissions
4. **Long-term**: Consider advanced features like CRM integration

---

## Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Get Resend API key from resend.com
# 3. Update .env file with your API key
# 4. Update email addresses in /src/app/api/contact/route.ts
# 5. Test the form
npm run dev
```

Your contact form is now ready with professional auto-reply emails! 🎉
