// src/app/admin/reports/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Flag, Eye, Check, X, Clock } from 'lucide-react';

interface Report {
  id: string;
  figureId: string;
  figureName: string;
  mainCategory: string;
  subcategory: string;
  eventTitle: string;
  reportType: string;
  description: string;
  contactEmail?: string;
  submittedAt: Timestamp;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  submitterIp?: string;
  submittedByUserId?: string; // Add this field
}

const AdminReportsPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Note: This is a basic admin page. In production, you'd want proper admin authentication
  const isAdmin = user?.email === 'info@ehco.ai'; // Replace with your admin email

  useEffect(() => {
    if (!isAdmin) return;

    const fetchReports = async () => {
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, orderBy('submittedAt', 'desc'), limit(100));
        const querySnapshot = await getDocs(q);

        const reportData: Report[] = [];
        querySnapshot.forEach((doc) => {
          reportData.push({ id: doc.id, ...doc.data() } as Report);
        });

        setReports(reportData);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setError('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [isAdmin]);

  const updateReportStatus = async (reportId: string, status: Report['status']) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        status,
        reviewedAt: new Date(),
        reviewedBy: user?.email
      });

      setReports(prev =>
        prev.map(report =>
          report.id === reportId ? { ...report, status } : report
        )
      );
    } catch (err) {
      console.error('Error updating report status:', err);
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    // Check if the timestamp is null, undefined, or doesn't have the toDate method
    if (!timestamp || typeof timestamp.toDate !== 'function') {
      return 'Unknown';
    }
    // If it's a valid Timestamp object, convert it to a standard JavaScript Date
    const date = timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'reviewed': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'resolved': return <Check className="w-4 h-4 text-green-500" />;
      case 'dismissed': return <X className="w-4 h-4 text-red-500" />;
      default: return <Flag className="w-4 h-4 text-gray-500" />;
    }
  };

  const getReportTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please log in to access this page.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Flag className="w-6 h-6 text-red-500" />
              Reports Dashboard
            </h1>
            <p className="text-gray-600 mt-1">{reports.length} total reports</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Figure & Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Report Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.status)}
                        <span className="text-sm capitalize">{report.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{report.figureName}</div>
                        <div className="text-gray-500">{report.eventTitle}</div>
                        <div className="text-xs text-gray-400">
                          {report.mainCategory} → {report.subcategory}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getReportTypeLabel(report.reportType)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {report.description.length > 100
                          ? report.description.substring(0, 100) + '...'
                          : report.description
                        }
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        {report.contactEmail && (
                          <div className="text-xs text-gray-500">
                            Contact: {report.contactEmail}
                          </div>
                        )}
                        <div className="text-xs">
                          {report.submittedByUserId ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Logged-in user
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Anonymous
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(report.submittedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-1">
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateReportStatus(report.id, 'reviewed')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Mark as reviewed"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateReportStatus(report.id, 'resolved')}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as resolved"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateReportStatus(report.id, 'dismissed')}
                              className="text-red-600 hover:text-red-900"
                              title="Dismiss report"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {report.status === 'reviewed' && (
                          <>
                            <button
                              onClick={() => updateReportStatus(report.id, 'resolved')}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as resolved"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateReportStatus(report.id, 'dismissed')}
                              className="text-red-600 hover:text-red-900"
                              title="Dismiss report"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reports.length === 0 && (
            <div className="text-center py-12">
              <Flag className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No reports</h3>
              <p className="mt-1 text-sm text-gray-500">No reports have been submitted yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReportsPage;
