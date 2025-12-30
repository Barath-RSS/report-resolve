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

const categories = {
  infrastructure: [
    { id: 'drainage', label: 'Drainage', icon: Droplets },
    { id: 'food_hygiene', label: 'Food/Hygiene', icon: Utensils },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'electrical', label: 'Electrical', icon: Zap },
    { id: 'water', label: 'Water', icon: Droplet },
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
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showMyReports, setShowMyReports] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCapturingPhoto(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      // Get image as blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setImageFile(file);
          setImagePreview(canvas.toDataURL('image/jpeg'));
          
          // Capture GPS coordinates at the moment of photo capture
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                });
                toast({
                  title: 'Photo Captured',
                  description: 'Location coordinates recorded.',
                });
              },
              (error) => {
                console.error('Error getting location:', error);
                toast({
                  title: 'Photo Captured',
                  description: 'Could not get location. Please enable GPS.',
                  variant: 'destructive',
                });
              },
              { enableHighAccuracy: true }
            );
          }
        }
      }, 'image/jpeg', 0.9);
    }

    // Stop the camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCapturingPhoto(false);
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
        lat: location?.lat,
        lng: location?.lng,
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
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Incident Reporter</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMyReports(!showMyReports)}
              className="relative"
            >
              <FileText className="w-4 h-4 mr-2" />
              My Reports
              {reports.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {reports.length}
                </span>
              )}
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
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
                <TabsList className="grid w-full grid-cols-3 h-12">
                  <TabsTrigger value="infrastructure" className="text-sm">
                    Public Infrastructure
                  </TabsTrigger>
                  <TabsTrigger value="personal" className="text-sm">
                    Personal Issues
                  </TabsTrigger>
                  <TabsTrigger value="security" className="text-sm">
                    Theft & Security
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
                        setLocation(null);
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

              {/* Location Status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <MapPin className={`w-4 h-4 ${location ? 'text-success' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">
                  {location
                    ? `Location captured: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                    : 'Waiting for location...'}
                </span>
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
