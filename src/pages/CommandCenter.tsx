import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, FileText, CheckCircle2, Clock, 
  Search, Filter, MapPin, ExternalLink, Bell,
  ChevronRight, AlertCircle, Loader2, Send, Eye,
  UserCheck, UserX, Users, Download, Trash2, 
  PieChart as PieChartIcon, Database, HardDrive
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { StatsSkeleton, TableSkeleton } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AccessRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  reason: string | null;
  status: string;
  created_at: string;
}

interface Report {
  id: string;
  created_at: string;
  user_id: string;
  category: string;
  sub_category: string;
  description: string;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  landmark: string | null;
  status: string;
  is_anonymous: boolean;
  time_of_incident: string | null;
  official_response: string | null;
  // Submitter info (fetched via join)
  submitter_name?: string | null;
  submitter_register_no?: string | null;
}

interface Notification {
  id: string;
  report: Report;
  read: boolean;
  timestamp: Date;
}

const CHART_COLORS = {
  pending: 'hsl(var(--warning))',
  investigating: 'hsl(var(--primary))',
  resolved: 'hsl(var(--success))',
};

export default function CommandCenter() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newStatus, setNewStatus] = useState('');
  const [officialResponse, setOfficialResponse] = useState('');
  const [updating, setUpdating] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [clearingStorage, setClearingStorage] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ used: number; fileCount: number } | null>(null);

  const { signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
    fetchAccessRequests();
    checkStorageUsage();

    // Subscribe to real-time updates for new reports
    const channel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reports'
        },
        (payload) => {
          const newReport = payload.new as Report;
          console.log('New report received:', newReport);
          
          // Add to reports list
          setReports(prev => [newReport, ...prev]);
          
          // Add notification
          const notification: Notification = {
            id: newReport.id,
            report: newReport,
            read: false,
            timestamp: new Date()
          };
          setNotifications(prev => [notification, ...prev]);
          
          // Show toast notification
          toast({
            title: '🚨 New Report Submitted',
            description: `${newReport.sub_category.replace('_', ' ')} - ${newReport.description.substring(0, 50)}...`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, categoryFilter, statusFilter]);

  const fetchReports = async () => {
    // Fetch reports first
    const { data: reportsData, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      setReports([]);
      setLoading(false);
      return;
    }

    // Fetch all profiles to map user_id to profile info
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name, register_no');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Create a map of user_id to profile for quick lookup
    const profilesMap = new Map<string, { full_name: string | null; register_no: string | null }>();
    (profilesData || []).forEach((p) => {
      profilesMap.set(p.user_id, { full_name: p.full_name, register_no: p.register_no });
    });

    // Map reports with submitter info
    const mappedReports = (reportsData || []).map((r) => {
      const profile = profilesMap.get(r.user_id);
      return {
        ...r,
        submitter_name: profile?.full_name || null,
        submitter_register_no: profile?.register_no || null,
      };
    });

    setReports(mappedReports);
    setLoading(false);
  };

  const fetchAccessRequests = async () => {
    setLoadingRequests(true);
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching access requests:', error);
    } else {
      setAccessRequests(data || []);
    }
    setLoadingRequests(false);
  };

  const handleAccessRequest = async (requestId: string, userId: string, action: 'approved' | 'rejected') => {
    setProcessingRequest(requestId);
    
    try {
      // Update the access request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({ 
          status: action,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // If approved, update user role to official
      if (action === 'approved') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'official' })
          .eq('user_id', userId);

        if (roleError) throw roleError;
      }

      toast({
        title: action === 'approved' ? 'Request Approved' : 'Request Rejected',
        description: action === 'approved' 
          ? 'The user now has official access.' 
          : 'The access request has been rejected.',
      });

      fetchAccessRequests();
    } catch (error) {
      console.error('Error processing request:', error);
      toast({
        title: 'Error',
        description: 'Failed to process the request.',
        variant: 'destructive',
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const pendingRequests = accessRequests.filter(r => r.status === 'pending');
  const processedRequests = accessRequests.filter(r => r.status !== 'pending');

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const filterReports = () => {
    let filtered = [...reports];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.description.toLowerCase().includes(term) ||
          r.sub_category.toLowerCase().includes(term) ||
          r.landmark?.toLowerCase().includes(term) ||
          r.submitter_name?.toLowerCase().includes(term) ||
          r.submitter_register_no?.toLowerCase().includes(term)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => r.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    setFilteredReports(filtered);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport || !newStatus) return;

    setUpdating(true);

    const { error } = await supabase
      .from('reports')
      .update({
        status: newStatus,
        official_response: officialResponse.trim() || null,
      })
      .eq('id', selectedReport.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update report.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Report Updated',
        description: 'The report status has been updated successfully.',
      });
      fetchReports();
      setSelectedReport(null);
      setNewStatus('');
      setOfficialResponse('');
    }

    setUpdating(false);
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };


  // Check storage usage
  const checkStorageUsage = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('issue-images')
        .list('', { limit: 1000 });
      
      if (error) {
        console.error('Error checking storage:', error);
        return;
      }
      
      // Calculate approximate size (metadata doesn't include exact size, so estimate)
      const fileCount = files?.length || 0;
      const estimatedSize = fileCount * 500; // Estimate ~500KB average per image
      
      setStorageInfo({ used: estimatedSize, fileCount });
      
      // Show warning if storage is getting full (e.g., > 50 files as a rough threshold)
      if (fileCount > 50) {
        toast({
          title: '⚠️ Storage Alert',
          description: `Cloud storage has ${fileCount} files. Consider clearing old reports to free up space.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Storage check error:', error);
    }
  };

  // Export reports to PDF with embedded images
  const exportToPdf = async () => {
    setExportingPdf(true);
    try {
      if (reports.length === 0) {
        toast({
          title: 'No Reports',
          description: 'There are no reports to export.',
          variant: 'destructive',
        });
        setExportingPdf(false);
        return;
      }

      toast({
        title: 'Preparing Export',
        description: 'Generating PDF report with images...',
      });

      // Create PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(20);
      doc.text('Campus Connect - Incident Reports', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Total Reports: ${reports.length}`, pageWidth / 2, 34, { align: 'center' });
      
      let yPosition = 45;
      
      for (let i = 0; i < reports.length; i++) {
        const report = reports[i];
        
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Report header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Report #${i + 1}: ${report.sub_category.replace(/_/g, ' ')}`, 14, yPosition);
        yPosition += 7;
        
        // Report details
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const details = [
          `Date: ${new Date(report.created_at).toLocaleString()}`,
          `Category: ${report.category} / ${report.sub_category.replace(/_/g, ' ')}`,
          `Status: ${report.status.toUpperCase()}`,
          `Location: ${report.landmark || 'Not specified'}`,
          `Submitter: ${(report.is_anonymous && report.category === 'personal') ? 'Anonymous' : (report.submitter_name || 'Unknown')}`,
          `Register No: ${(report.is_anonymous && report.category === 'personal') ? 'N/A' : (report.submitter_register_no || 'N/A')}`,
        ];
        
        details.forEach(detail => {
          doc.text(detail, 14, yPosition);
          yPosition += 5;
        });
        
        // Description (with word wrap)
        const descLines = doc.splitTextToSize(`Description: ${report.description}`, pageWidth - 28);
        doc.text(descLines, 14, yPosition);
        yPosition += descLines.length * 5;
        
        if (report.official_response) {
          const responseLines = doc.splitTextToSize(`Official Response: ${report.official_response}`, pageWidth - 28);
          doc.text(responseLines, 14, yPosition);
          yPosition += responseLines.length * 5;
        }
        
        // Add image if available
        if (report.image_url) {
          try {
            // Fetch image and convert to base64
            const response = await fetch(report.image_url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            
            // Check if we need a new page for image
            if (yPosition > 200) {
              doc.addPage();
              yPosition = 20;
            }
            
            // Add image to PDF
            doc.addImage(base64, 'JPEG', 14, yPosition, 80, 60);
            yPosition += 65;
          } catch (imgError) {
            console.error('Failed to load image:', imgError);
            doc.text(`[Image unavailable: ${report.image_url}]`, 14, yPosition);
            yPosition += 5;
          }
        }
        
        yPosition += 10; // Space between reports
        
        // Draw separator line
        if (i < reports.length - 1) {
          doc.setDrawColor(200);
          doc.line(14, yPosition - 5, pageWidth - 14, yPosition - 5);
        }
      }
      
      // Save the PDF
      doc.save(`campus_connect_reports_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: 'Export Successful',
        description: `${reports.length} reports have been exported to PDF with images.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export reports.',
        variant: 'destructive',
      });
    }
    setExportingPdf(false);
  };

  // Clear cloud storage and delete all reports
  const clearCloudStorage = async () => {
    setClearingStorage(true);
    try {
      // List all files in the root of the bucket (files are stored at root level)
      const { data: files, error: listError } = await supabase.storage
        .from('issue-images')
        .list('', { limit: 1000 });

      if (listError) {
        console.error('List error:', listError);
        throw listError;
      }

      console.log('Files found:', files);

      // Filter out folders and get only files
      const fileNames = (files || [])
        .filter(file => file.name && !file.id?.includes('/'))
        .map(file => file.name);

      console.log('File names to delete:', fileNames);

      // Delete all files from storage
      if (fileNames.length > 0) {
        const { error: deleteStorageError } = await supabase.storage
          .from('issue-images')
          .remove(fileNames);

        if (deleteStorageError) {
          console.error('Delete storage error:', deleteStorageError);
          throw deleteStorageError;
        }
      }

      // Delete all reports from the database
      const { error: deleteReportsError } = await supabase
        .from('reports')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq with impossible ID)

      if (deleteReportsError) {
        console.error('Delete reports error:', deleteReportsError);
        throw deleteReportsError;
      }

      // Refresh reports list and storage info
      setReports([]);
      setFilteredReports([]);
      setStorageInfo({ used: 0, fileCount: 0 });

      toast({
        title: 'All Reports & Storage Cleared',
        description: `Successfully cleared ${fileNames.length} files and all reports from the database.`,
      });
    } catch (error) {
      console.error('Clear storage error:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear storage and reports. Check console for details.',
        variant: 'destructive',
      });
    }
    setClearingStorage(false);
  };

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    investigating: reports.filter((r) => r.status === 'investigating').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  };

  // Pie chart data
  const pieChartData = [
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Investigating', value: stats.investigating, color: '#7c1d3e' },
    { name: 'Resolved', value: stats.resolved, color: '#22c55e' },
  ].filter(item => item.value > 0);

  // Category distribution data
  const categoryData = [
    { name: 'Infrastructure', value: reports.filter(r => r.category === 'infrastructure').length, color: '#3b82f6' },
    { name: 'Personal', value: reports.filter(r => r.category === 'personal').length, color: '#ef4444' },
    { name: 'Security', value: reports.filter(r => r.category === 'security').length, color: '#8b5cf6' },
  ].filter(item => item.value > 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'investigating':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'resolved':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'investigating':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'resolved':
        return <CheckCircle2 className="w-3 h-3" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  return (
    <PageTransition className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Campus Connect</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                  <div className="flex gap-2">
                    {notifications.length > 0 && (
                      <>
                        <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                          Mark all read
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearNotifications}>
                          Clear
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => {
                          setSelectedReport(notification.report);
                          setNewStatus(notification.report.status);
                          setOfficialResponse(notification.report.official_response || '');
                          setNotifications(prev =>
                            prev.map(n =>
                              n.id === notification.id ? { ...n, read: true } : n
                            )
                          );
                          setNotificationOpen(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-4 h-4 text-warning" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize">
                              {notification.report.sub_category.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {notification.report.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Tabs for Reports, Analytics, and Official Requests */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2">
              <PieChartIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-1 sm:gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Requests</span>
              {pendingRequests.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-8 mt-6">
            {/* Storage Info Banner */}
            {storageInfo && storageInfo.fileCount > 0 && (
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                storageInfo.fileCount > 50 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <HardDrive className={`w-5 h-5 ${storageInfo.fileCount > 50 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Cloud Storage: {storageInfo.fileCount} files
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {storageInfo.fileCount > 50 ? 'Consider clearing old reports to free up space' : 'Storage usage is normal'}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={exportToPdf}
                disabled={exportingPdf || reports.length === 0}
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export PDF
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Database className="w-4 h-4 mr-2" />
                    Clear Reports
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Reports & Storage?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all reports from the database AND all images from cloud storage. 
                      <span className="block mt-2 font-medium text-warning">
                        Would you like to download the reports first?
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button variant="outline" onClick={exportToPdf} disabled={exportingPdf}>
                      {exportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Download First
                    </Button>
                    <AlertDialogAction
                      onClick={clearCloudStorage}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={clearingStorage}
                    >
                      {clearingStorage ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Stats Bento Grid */}
            {loading ? (
              <StatsSkeleton />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Reports</p>
                      <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Investigating</p>
                      <p className="text-2xl font-bold text-foreground">{stats.investigating}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resolved</p>
                      <p className="text-2xl font-bold text-foreground">{stats.resolved}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports, names, register no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reports Table */}
            {loading ? (
              <TableSkeleton rows={5} />
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-16 border border-border rounded-xl">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Reports Found</h3>
                <p className="text-muted-foreground mt-1">
                  {reports.length === 0
                    ? 'No incident reports have been submitted yet.'
                    : 'No reports match your current filters.'}
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Submitted By</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Issue</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((report, index) => (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-t border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4 text-sm text-foreground">
                            {new Date(report.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            {/* Hide submitter info for anonymous personal issues */}
                            {report.is_anonymous && report.category === 'personal' ? (
                              <div className="text-sm text-muted-foreground italic">
                                Anonymous
                              </div>
                            ) : (
                              <div className="max-w-[150px]">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {report.submitter_name || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {report.submitter_register_no || '-'}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-foreground capitalize">
                              {report.category}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="max-w-xs">
                              <p className="text-sm font-medium text-foreground capitalize">
                                {report.sub_category.replace('_', ' ')}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {report.description}
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusColor(report.status)}>
                              {getStatusIcon(report.status)}
                              <span className="ml-1 capitalize">{report.status}</span>
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setNewStatus(report.status);
                                setOfficialResponse(report.official_response || '');
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6 mt-6">
            {/* Summary Stats - First on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4 sm:p-6"
            >
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">Summary</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 sm:p-4 rounded-lg bg-warning/10">
                  <p className="text-2xl sm:text-3xl font-bold text-warning">{stats.pending}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-3 sm:p-4 rounded-lg bg-primary/10">
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{stats.investigating}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Investigating</p>
                </div>
                <div className="text-center p-3 sm:p-4 rounded-lg bg-success/10">
                  <p className="text-2xl sm:text-3xl font-bold text-success">{stats.resolved}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
              {stats.total > 0 && (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg bg-muted/30">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Resolution Rate: <span className="font-semibold text-foreground">
                      {((stats.resolved / stats.total) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
              )}
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              {/* Status Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-border bg-card p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Status Distribution
                </h3>
                {pieChartData.length === 0 ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center text-muted-foreground text-sm">
                    No data available
                  </div>
                ) : (
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [value, 'Reports']}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px' }}
                          formatter={(value, entry) => {
                            const item = pieChartData.find(d => d.name === value);
                            return `${value}: ${item?.value || 0}`;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>

              {/* Category Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-border bg-card p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Category Distribution
                </h3>
                {categoryData.length === 0 ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center text-muted-foreground text-sm">
                    No data available
                  </div>
                ) : (
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [value, 'Reports']}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px' }}
                          formatter={(value, entry) => {
                            const item = categoryData.find(d => d.name === value);
                            return `${value}: ${item?.value || 0}`;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            </div>
          </TabsContent>

          {/* Official Requests Tab */}
          <TabsContent value="requests" className="space-y-6 mt-6">
            {/* Pending Requests */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Pending Requests ({pendingRequests.length})
              </h2>
              
              {loadingRequests ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-12 border border-border rounded-xl">
                  <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 border border-border rounded-xl bg-card"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{request.full_name}</p>
                          <p className="text-sm text-muted-foreground">{request.email}</p>
                          {request.reason && (
                            <p className="text-sm text-muted-foreground mt-1 italic">
                              "{request.reason}"
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested: {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/20 hover:bg-destructive/10"
                            onClick={() => handleAccessRequest(request.id, request.user_id, 'rejected')}
                            disabled={processingRequest === request.id}
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserX className="w-4 h-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-success text-success-foreground hover:bg-success/90"
                            onClick={() => handleAccessRequest(request.id, request.user_id, 'approved')}
                            disabled={processingRequest === request.id}
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Processed Requests */}
            {processedRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Processed Requests ({processedRequests.length})
                </h2>
                <div className="space-y-2">
                  {processedRequests.slice(0, 10).map((request) => (
                    <div
                      key={request.id}
                      className="p-3 border border-border rounded-lg bg-muted/30 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.full_name}</p>
                        <p className="text-xs text-muted-foreground">{request.email}</p>
                      </div>
                      <Badge className={request.status === 'approved' 
                        ? 'bg-success/10 text-success border-success/20' 
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                      }>
                        {request.status === 'approved' ? (
                          <UserCheck className="w-3 h-3 mr-1" />
                        ) : (
                          <UserX className="w-3 h-3 mr-1" />
                        )}
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Report Detail Sheet */}
      <Sheet open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {selectedReport?.sub_category.replace('_', ' ')}
            </SheetTitle>
            <SheetDescription>
              Reported on {selectedReport && new Date(selectedReport.created_at).toLocaleString()}
            </SheetDescription>
          </SheetHeader>

          {selectedReport && (
            <div className="mt-6 space-y-6">
              {/* Image */}
              {selectedReport.image_url && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img
                    src={selectedReport.image_url}
                    alt="Issue"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1 text-foreground">{selectedReport.description}</p>
              </div>

              {/* Submitter Info - hide for anonymous personal issues */}
              {!(selectedReport.is_anonymous && selectedReport.category === 'personal') && (
                <div>
                  <Label className="text-muted-foreground">Submitted By</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted/50">
                    <p className="text-foreground font-medium">
                      {selectedReport.submitter_name || 'Unknown'}
                    </p>
                    {selectedReport.submitter_register_no && (
                      <p className="text-sm text-muted-foreground">
                        Reg. No: {selectedReport.submitter_register_no}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Category */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="mt-1 text-foreground capitalize">{selectedReport.category}</p>
                </div>
                <div className="flex-1">
                  <Label className="text-muted-foreground">Anonymous</Label>
                  <p className="mt-1 text-foreground">
                    {selectedReport.is_anonymous ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Time of Incident */}
              {selectedReport.time_of_incident && (
                <div>
                  <Label className="text-muted-foreground">Time of Incident</Label>
                  <p className="mt-1 text-foreground">
                    {new Date(selectedReport.time_of_incident).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Location / Landmark */}
              {selectedReport.landmark && (
                <div>
                  <Label className="text-muted-foreground">Location / Landmark</Label>
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-foreground">{selectedReport.landmark}</p>
                  </div>
                </div>
              )}

              {/* Legacy GPS Location (for old reports) */}
              {selectedReport.lat && selectedReport.lng && (
                <div>
                  <Label className="text-muted-foreground">GPS Coordinates</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => openGoogleMaps(selectedReport.lat!, selectedReport.lng!)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on Google Maps
                  </Button>
                </div>
              )}

              {/* Update Status */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label>Update Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Official Response</Label>
                  <Textarea
                    placeholder="Enter your response..."
                    value={officialResponse}
                    onChange={(e) => setOfficialResponse(e.target.value)}
                    rows={3}
                  />
                </div>

                <AnimatedButton
                  onClick={handleUpdateReport}
                  disabled={updating}
                  className="w-full gradient-primary text-primary-foreground"
                >
                  {updating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Update Report
                    </>
                  )}
                </AnimatedButton>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}
