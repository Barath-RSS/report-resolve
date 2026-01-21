import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, Utensils, Trash2, Zap, Droplet, 
  Users, ShieldAlert, Clock, Camera, MapPin,
  Send, ChevronRight, FileText, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { CardSkeleton } from '@/components/ui/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

import { Building2 } from 'lucide-react';

import { MoreHorizontal } from 'lucide-react';

const categories = {
  infrastructure: [
    { id: 'drainage', label: 'Drainage', icon: Droplets },
    { id: 'food_hygiene', label: 'Food/Hygiene', icon: Utensils },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'electrical', label: 'Electrical', icon: Zap },
    { id: 'water', label: 'Water', icon: Droplet },
    { id: 'classroom', label: 'Classroom', icon: Building2 },
    { id: 'others', label: 'Others', icon: MoreHorizontal },
  ],
  personal: [
    { id: 'harassment', label: 'Harassment', icon: Users },
    { id: 'bullying', label: 'Bullying', icon: ShieldAlert },
  ],
  security: [
    { id: 'theft', label: 'Theft', icon: ShieldAlert },
    { id: 'lost_item', label: 'Lost Item', icon: FileText },
  ],
};

interface Report {
  id: string;
  created_at: string;
  category: string;
  sub_category: string;
  description: string;
  status: string;
  is_anonymous: boolean;
  official_response?: string;
}

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('infrastructure');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [timeOfIncident, setTimeOfIncident] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [landmark, setLandmark] = useState('');
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showMyReports, setShowMyReports] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchReports = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data || []);
    }
    setLoadingReports(false);
  };

  const startCamera = async () => {
    try {
      setCapturingPhoto(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      streamRef.current = stream;
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCapturingPhoto(false);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast({
        title: 'Error',
        description: 'Camera not ready. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is ready
    if (video.readyState < 2) {
      toast({
        title: 'Please wait',
        description: 'Camera is still loading...',
      });
      return;
    }
    
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image as blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setImageFile(file);
          setImagePreview(canvas.toDataURL('image/jpeg'));
          
          // Stop the camera
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          setCapturingPhoto(false);
          
          toast({
            title: 'Photo Captured',
            description: 'Please enter the landmark/location details below.',
          });
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const cancelCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCapturingPhoto(false);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('issue-images')
      .upload(fileName, file);
    
    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }
    
    const { data } = supabase.storage
      .from('issue-images')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a category and provide a description.',
        variant: 'destructive',
      });
      return;
    }

    if (!imageFile) {
      toast({
        title: 'Photo Required',
        description: 'Please capture a photo of the issue.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase.from('reports').insert({
        user_id: user?.id,
        category: activeTab,
        sub_category: selectedCategory,
        description: description.trim(),
        image_url: imageUrl,
        landmark: landmark.trim() || null,
        is_anonymous: activeTab === 'personal' ? isAnonymous : false,
        time_of_incident: activeTab === 'security' && timeOfIncident ? new Date(timeOfIncident).toISOString() : null,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Report Submitted!',
        description: 'Your incident has been reported successfully.',
      });

      // Reset form
      setSelectedCategory('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setTimeOfIncident('');
      setLandmark('');
      fetchReports();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit report.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
      <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Incident Reporter</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showMyReports ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowMyReports(!showMyReports)}
              className="relative"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">My Reports</span>
              {reports.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground text-primary text-xs font-medium">
                  {reports.length}
                </span>
              )}
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {showMyReports ? (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Reports</h2>
                <Button variant="ghost" onClick={() => setShowMyReports(false)}>
                  <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                  Back to Report
                </Button>
              </div>

              {loadingReports ? (
                <div className="grid gap-4">
                  {[1, 2, 3].map((i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground">No Reports Yet</h3>
                  <p className="text-muted-foreground mt-1">
                    Submit your first incident report to see it here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {reports.map((report) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border bg-card p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground capitalize">
                              {report.sub_category.replace('_', ' ')}
                            </span>
                            {report.is_anonymous && (
                              <Badge variant="outline" className="text-xs">
                                <EyeOff className="w-3 h-3 mr-1" />
                                Anonymous
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {report.category.replace('_', ' ')}
                          </p>
                        </div>
                        <Badge className={getStatusColor(report.status)}>
                          {getStatusIcon(report.status)}
                          <span className="ml-1 capitalize">{report.status}</span>
                        </Badge>
                      </div>
                      <p className="mt-3 text-foreground">{report.description}</p>
                      {report.official_response && (
                        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <p className="text-sm font-medium text-primary">Official Response:</p>
                          <p className="text-sm text-foreground mt-1">{report.official_response}</p>
                        </div>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        Reported on {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground">Report an Incident</h2>
                <p className="text-muted-foreground mt-2">
                  Select a category and provide details about the issue
                </p>
              </div>

              {/* Category Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto min-h-[3rem] p-1">
                  <TabsTrigger value="infrastructure" className="text-xs sm:text-sm px-2 py-2 leading-tight">
                    <span className="hidden sm:inline">Public </span>Infrastructure
                  </TabsTrigger>
                  <TabsTrigger value="personal" className="text-xs sm:text-sm px-2 py-2 leading-tight">
                    Personal<span className="hidden sm:inline"> Issues</span>
                  </TabsTrigger>
                  <TabsTrigger value="security" className="text-xs sm:text-sm px-2 py-2 leading-tight">
                    <span className="hidden sm:inline">Theft &</span> Security
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="infrastructure" className="mt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {categories.infrastructure.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <motion.button
                          key={cat.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            selectedCategory === cat.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${
                            selectedCategory === cat.id ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                          <span className={`text-sm font-medium ${
                            selectedCategory === cat.id ? 'text-primary' : 'text-foreground'
                          }`}>
                            {cat.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="personal" className="mt-6 space-y-6">
                  <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                      <div>
                        <p className="font-medium text-warning">Confidential Reporting</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Personal issues like harassment and bullying are handled with strict confidentiality.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      {isAnonymous ? <EyeOff className="w-5 h-5 text-primary" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
                      <div>
                        <Label htmlFor="anonymous" className="font-medium">Report Anonymously</Label>
                        <p className="text-sm text-muted-foreground">Your identity will be hidden</p>
                      </div>
                    </div>
                    <Switch
                      id="anonymous"
                      checked={isAnonymous}
                      onCheckedChange={setIsAnonymous}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {categories.personal.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <motion.button
                          key={cat.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            selectedCategory === cat.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${
                            selectedCategory === cat.id ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                          <span className={`text-sm font-medium ${
                            selectedCategory === cat.id ? 'text-primary' : 'text-foreground'
                          }`}>
                            {cat.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="security" className="mt-6 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {categories.security.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <motion.button
                          key={cat.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            selectedCategory === cat.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${
                            selectedCategory === cat.id ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                          <span className={`text-sm font-medium ${
                            selectedCategory === cat.id ? 'text-primary' : 'text-foreground'
                          }`}>
                            {cat.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Time of Incident</Label>
                    <Input
                      id="time"
                      type="datetime-local"
                      value={timeOfIncident}
                      onChange={(e) => setTimeOfIncident(e.target.value)}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide details about the incident..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Photo Capture */}
              <div className="space-y-3">
                <Label>Photo Evidence</Label>
                <canvas ref={canvasRef} className="hidden" />
                
                {capturingPhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-64 object-cover"
                    />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={cancelCamera}
                      >
                        Cancel
                      </Button>
                      <AnimatedButton
                        onClick={capturePhoto}
                        className="gradient-primary text-primary-foreground"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Capture
                      </AnimatedButton>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img
                      src={imagePreview}
                      alt="Captured"
                      className="w-full h-48 object-cover"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute bottom-3 right-3"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setLandmark('');
                        startCamera();
                      }}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={startCamera}
                    className="w-full h-40 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-3"
                  >
                    <Camera className="w-10 h-10 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Tap to open camera
                    </span>
                  </motion.button>
                )}
              </div>

              {/* Landmark Input */}
              <div className="space-y-2">
                <Label htmlFor="landmark">Location / Landmark</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="landmark"
                    type="text"
                    placeholder="e.g., Block A, Room 302, Near Main Library..."
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the specific location or nearest landmark where the issue occurred
                </p>
              </div>

              {/* Submit Button */}
              <AnimatedButton
                onClick={handleSubmit}
                disabled={loading || !selectedCategory || !description.trim()}
                className="w-full gradient-primary text-primary-foreground h-12"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Submit Report
                  </>
                )}
              </AnimatedButton>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  );
}
