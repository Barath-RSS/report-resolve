import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, FileText, CheckCircle2, Clock, 
  Search, Filter, MapPin, ExternalLink, Bell,
  ChevronRight, AlertCircle, Loader2, Send, Eye
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  status: string;
  is_anonymous: boolean;
  time_of_incident: string | null;
  official_response: string | null;
}

interface Notification {
  id: string;
  report: Report;
  read: boolean;
  timestamp: Date;
}

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

  const { signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();

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
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch reports.',
        variant: 'destructive',
      });
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

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
          r.sub_category.toLowerCase().includes(term)
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

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    investigating: reports.filter((r) => r.status === 'investigating').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  };

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
            <h1 className="text-xl font-bold text-foreground">Command Center</h1>
          </div>
          <div className="flex items-center gap-3">
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
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
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
              placeholder="Search reports..."
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

              {/* Location */}
              {selectedReport.lat && selectedReport.lng && (
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => openGoogleMaps(selectedReport.lat!, selectedReport.lng!)}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    View on Google Maps
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {/* Update Status */}
              <div className="border-t border-border pt-6 space-y-4">
                <h3 className="font-semibold text-foreground">Update Report</h3>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
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
                    placeholder="Add a response for the student..."
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
