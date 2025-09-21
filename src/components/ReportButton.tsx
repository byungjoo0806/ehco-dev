// src/components/ReportButton.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Flag, X, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createPortal } from 'react-dom';

// 1. Defined a specific type for the eventGroup object
interface EventGroupData {
  event_title?: string;
  event_summary?: string;
}

interface ReportButtonProps {
  figureId: string;
  figureName: string;
  figureNameKr: string;
  mainCategory: string;
  subcategory: string;
  eventGroupIndex: number;
  eventGroup: EventGroupData; // 2. Used the specific type instead of 'any'
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Report Modal Component
const ReportModal: React.FC<{
  onClose: () => void;
  onSubmit: (reportData: {
    reportType: string;
    description: string;
    contactEmail?: string;
  }) => void;
  isSubmitting: boolean;
  figureName: string;
  eventTitle: string;
  userEmail?: string | null; // Allow null as well
  isLoggedIn: boolean; // Add login status prop
}> = ({ onClose, onSubmit, isSubmitting, figureName, eventTitle, userEmail, isLoggedIn }) => {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const reportTypes = [
    { value: 'incorrect_information', label: 'Incorrect Information' },
    { value: 'missing_information', label: 'Missing Information' },
    { value: 'duplicate_content', label: 'Duplicate Content' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportType || !description.trim()) return;

    onSubmit({
      reportType,
      description: description.trim(),
      contactEmail: contactEmail.trim() || undefined
    });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-end sm:items-center justify-center p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Report Issue</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Figure:</span> {figureName}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Event:</span> {eventTitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What type of issue are you reporting? *
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
              disabled={isSubmitting}
            >
              <option value="">Select an issue type</option>
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please describe the issue in detail *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide specific details about the issue you found..."
              className="w-full h-[10vh] p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={4}
              required
              disabled={isSubmitting}
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {description.length}/1000 characters
            </div>
          </div>

          <div>
            {isLoggedIn ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-1 bg-white transform rotate-45 origin-bottom"></div>
                    <div className="w-1 h-3 bg-white transform -rotate-45 origin-bottom -ml-1"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Follow-up notifications</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {/* 3. Escaped apostrophe */}
                      If we need additional information about your report, we&apos;ll send an email to{' '}
                      <span className="font-medium">{userEmail || 'your registered email'}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email (Optional)
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={isSubmitting}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {/* 4. Escaped apostrophe */}
                  Leave your email if you&apos;d like us to follow up with you
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reportType || !description.trim()}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Success Modal Component
const SuccessModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-1 bg-white transform rotate-45 origin-bottom"></div>
            <div className="w-1 h-3 bg-white transform -rotate-45 origin-bottom -ml-1"></div>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Report Submitted</h3>
        <p className="text-gray-600 mb-6">
          {/* 5. Escaped apostrophe */}
          Thank you for your feedback! We&apos;ll review your report and take appropriate action.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

export default function ReportButton({
  figureId,
  figureName,
  figureNameKr,
  mainCategory,
  subcategory,
  eventGroupIndex,
  eventGroup,
  size = 'md',
  className = ''
}: ReportButtonProps) {
  const { user } = useAuth(); // Add auth context
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (showReportModal) {
      // Save current scroll position
      const currentScroll = window.scrollY;
      setScrollPosition(currentScroll);

      // Prevent body scroll while maintaining position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${currentScroll}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
    } else {
      // Restore body styles first
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';

      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    }

    return () => {
      // Cleanup
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
    };
  }, [showReportModal]);

  // Also add this cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (scrollPosition > 0) {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition);
        });
      }
    };
  }, []);

  // Size variants
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowReportModal(true);
  };

  const handleSubmitReport = async (reportData: {
    reportType: string;
    description: string;
    contactEmail?: string;
  }) => {
    setIsSubmitting(true);

    try {
      // Use user's email if logged in, otherwise use the provided contact email
      const finalContactEmail = user?.email || reportData.contactEmail;

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          figureId,
          figureName,
          figureNameKr,
          mainCategory,
          subcategory,
          eventGroupIndex,
          eventTitle: eventGroup.event_title,
          eventSummary: eventGroup.event_summary,
          reportType: reportData.reportType,
          description: reportData.description,
          contactEmail: finalContactEmail,
          timestamp: new Date().toISOString(),
          submittedByUserId: user?.uid || null, // Add user ID if logged in
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      setShowReportModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error submitting report:', error);
      // You might want to show an error toast here
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleReportClick}
        className={`
          ${sizeClasses[size]}
          rounded-full hover:bg-red-50 transition-colors z-0
          ${className}
        `}
        title="Report an issue with this event"
      >
        <Flag
          size={iconSizes[size]}
          className="text-gray-400 hover:text-red-500 transition-colors"
        />
      </button>

      {/* Report Modal */}
      {showReportModal && createPortal(
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSubmit={handleSubmitReport}
          isSubmitting={isSubmitting}
          figureName={figureName}
          eventTitle={eventGroup.event_title || 'N/A'}
          userEmail={user?.email}
          isLoggedIn={!!user}
        />,
        document.body
      )}

      {showSuccessModal && createPortal(
        <SuccessModal
          onClose={() => setShowSuccessModal(false)}
        />,
        document.body
      )}
    </>
  );
}