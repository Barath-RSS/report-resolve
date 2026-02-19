import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, CheckCircle2, Clock, Camera, Loader2,
  AlertCircle, Image as ImageIcon, ChevronRight, Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Report {
  id: string;
  created_at: string;
  category: string;
  sub_category: string;
  description: string;
  landmark: string | null;
  status: string;
  image_url: string | null;
  completion_image_url: string | null;
  official_response: string | null;
  is_anonymous: boolean;
  user_id: string;
}

export default function StaffDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [uploadingCompletion, setUploadingCompletion] = useState(false);
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'investigating' | 'all'>('all');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();

    // Real-time subscription for report updates
    const channel = supabase
      .channel('staff-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopCamera();
    };
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const filteredReports = reports.filter(r => {
    if (activeFilter === 'all') return r.status !== 'resolved';
    return r.status === activeFilter;
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  };

  const startCamera = async () => {
    try {
      setCapturingPhoto(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error) {
      setCapturingPhoto(false);
      toast({ title: 'Camera Error', description: 'Could not access camera.', variant: 'destructive' });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `completion-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCapturedImage(file);
          setCapturedPreview(canvas.toDataURL('image/jpeg'));
          stopCamera();
          setCapturingPhoto(false);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCapturingPhoto(false);
  };

  const handleMarkResolved = async () => {
    if (!selectedReport || !capturedImage) {
      toast({ title: 'Photo Required', description: 'Please capture a completion photo first.', variant: 'destructive' });
      return;
    }

    setUploadingCompletion(true);
    try {
      // Upload completion photo
      const fileName = `completion-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('issue-images')
        .upload(fileName, capturedImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('issue-images').getPublicUrl(fileName);
      const completionImageUrl = urlData.publicUrl;

      // Update report: resolved + completion image
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'resolved',
          completion_image_url: completionImageUrl,
          official_response: selectedReport.official_response || 'Work completed by service staff.',
        })
        .eq('id', selectedReport.id);

      if (updateError) throw updateError;

      toast({ title: '✅ Report Resolved!', description: 'Completion photo uploaded. Student will be notified.' });
      setCapturedImage(null);
      setCapturedPreview(null);
      setSelectedReport(null);
      fetchReports();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update report.', variant: 'destructive' });
    } finally {
      setUploadingCompletion(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'investigating': return 'bg-primary/10 text-primary border-primary/20';
      case 'resolved': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'investigating': return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'resolved': return <CheckCircle2 className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  return (
    <PageTransition className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Campus Connect</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Service Staff Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-muted/50' },
            { label: 'Pending', value: stats.pending, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'In Progress', value: stats.investigating, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Resolved', value: stats.resolved, color: 'text-success', bg: 'bg-success/10' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border border-border ${stat.bg} p-5`}
            >
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'investigating'] as const).map(f => (
            <Button
              key={f}
              variant={activeFilter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(f)}
              className="capitalize"
            >
              {f === 'all' ? 'Active Reports' : f === 'investigating' ? 'In Progress' : 'Pending'}
            </Button>
          ))}
        </div>

        {/* Reports list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-20 border border-border rounded-xl">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
            <h3 className="text-lg font-medium text-foreground">All Clear!</h3>
            <p className="text-muted-foreground mt-1">No active reports to handle.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredReports.map((report, index) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground capitalize">
                          {report.sub_category.replace(/_/g, ' ')}
                        </span>
                        <Badge className={getStatusColor(report.status)}>
                          {getStatusIcon(report.status)}
                          <span className="ml-1 capitalize">{report.status}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize mt-0.5">{report.category.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-foreground mt-2 line-clamp-2">{report.description}</p>
                      {report.landmark && (
                        <p className="text-xs text-muted-foreground mt-1">📍 {report.landmark}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(report.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedReport(report);
                        setCapturedImage(null);
                        setCapturedPreview(null);
                        setCapturingPhoto(false);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Handle
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Report Detail Sheet */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => {
        if (!open) {
          setSelectedReport(null);
          setCapturedImage(null);
          setCapturedPreview(null);
          stopCamera();
        }
      }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {selectedReport?.sub_category.replace(/_/g, ' ')}
            </SheetTitle>
            <SheetDescription>
              Reported {selectedReport && new Date(selectedReport.created_at).toLocaleString()}
            </SheetDescription>
          </SheetHeader>

          {selectedReport && (
            <div className="mt-6 space-y-5">
              {/* Report photo (issue) */}
              {selectedReport.image_url && (
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Issue Photo</Label>
                  <div className="mt-2 rounded-xl overflow-hidden border border-border">
                    <img src={selectedReport.image_url} alt="Issue" className="w-full h-44 object-cover" />
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Description</Label>
                <p className="mt-1 text-foreground text-sm">{selectedReport.description}</p>
              </div>

              {/* Landmark */}
              {selectedReport.landmark && (
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Location</Label>
                  <p className="mt-1 text-foreground text-sm">📍 {selectedReport.landmark}</p>
                </div>
              )}

              {/* Category */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Category</Label>
                  <p className="mt-1 text-foreground text-sm capitalize">{selectedReport.category}</p>
                </div>
                <div className="flex-1">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Status</Label>
                  <Badge className={`mt-1 ${getStatusColor(selectedReport.status)}`}>
                    {getStatusIcon(selectedReport.status)}
                    <span className="ml-1 capitalize">{selectedReport.status}</span>
                  </Badge>
                </div>
              </div>

              {/* Already resolved with completion pic */}
              {selectedReport.completion_image_url && (
                <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <p className="font-medium text-success">Work Completed</p>
                  </div>
                  <img
                    src={selectedReport.completion_image_url}
                    alt="Completion"
                    className="w-full h-40 object-cover rounded-lg border border-success/20"
                  />
                </div>
              )}

              {/* Camera / Completion Section */}
              {selectedReport.status !== 'resolved' && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <p className="font-medium text-foreground text-sm">Upload Completion Photo</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Capture a photo after finishing the work. This will notify the student that the issue is resolved.
                  </p>

                  <canvas ref={canvasRef} className="hidden" />

                  {capturingPhoto ? (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-56 object-cover" />
                      <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={stopCamera}>Cancel</Button>
                        <AnimatedButton onClick={capturePhoto} className="gradient-primary text-primary-foreground">
                          <Camera className="w-4 h-4 mr-2" />
                          Capture
                        </AnimatedButton>
                      </div>
                    </div>
                  ) : capturedPreview ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden border-2 border-success/40">
                        <img src={capturedPreview} alt="Captured" className="w-full h-44 object-cover" />
                        <div className="absolute top-2 right-2 bg-success rounded-full p-1">
                          <CheckCircle2 className="w-4 h-4 text-success-foreground" />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => { setCapturedImage(null); setCapturedPreview(null); startCamera(); }}>
                        <Camera className="w-4 h-4 mr-2" />
                        Retake Photo
                      </Button>
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={startCamera}
                      className="w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
                    >
                      <Camera className="w-10 h-10" />
                      <span className="text-sm">Tap to capture completion photo</span>
                    </motion.button>
                  )}

                  <AnimatedButton
                    onClick={handleMarkResolved}
                    disabled={!capturedImage || uploadingCompletion}
                    className="w-full gradient-primary text-primary-foreground h-12"
                  >
                    {uploadingCompletion ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Mark as Resolved & Notify Student
                      </>
                    )}
                  </AnimatedButton>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}
