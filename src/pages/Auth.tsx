import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Shield, Eye, EyeOff, AlertTriangle, Mail, Lock, User, Users, LayoutDashboard, Command, FileText, Hash } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PageTransition } from '@/components/ui/PageTransition';
import { supabase } from '@/integrations/supabase/client';
import collegeLogo from '@/assets/college-logo.jpg';

const emailSchema = z.string().email('Invalid email format').max(255);
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(128);
const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100);
const registerNoSchema = z.string().min(5, 'Register No must be at least 5 characters').max(20);

type SelectedRole = 'student' | 'official';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<SelectedRole>('student');
  const [requestOfficialAccess, setRequestOfficialAccess] = useState(false);
  const [accessRequestReason, setAccessRequestReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; registerNo?: string }>({});

  const { signIn, signUp, resetPassword, user, role, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && role) {
      if (role !== selectedRole) {
        toast({
          title: 'Access Denied',
          description: `You don't have ${selectedRole === 'official' ? 'Official' : 'Student'} access. Redirecting to your dashboard.`,
          variant: 'destructive',
        });
      }
      if (role === 'official') {
        navigate('/command-center');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, role, authLoading, navigate, selectedRole, toast]);

  const detectCapsLock = (e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (isForgotPassword) {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
    } else if (isLogin) {
      // Login uses register no
      const registerNoResult = registerNoSchema.safeParse(registerNo);
      if (!registerNoResult.success) {
        newErrors.registerNo = registerNoResult.error.errors[0].message;
      }
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    } else {
      // Sign up requires all fields
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.fullName = nameResult.error.errors[0].message;
      }
      const registerNoResult = registerNoSchema.safeParse(registerNo);
      if (!registerNoResult.success) {
        newErrors.registerNo = registerNoResult.error.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast({
          title: 'Check your email',
          description: 'We sent you a password reset link.',
        });
        setIsForgotPassword(false);
      } else if (isLogin) {
        // Find email by register no first
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('register_no', registerNo.trim().toUpperCase())
          .maybeSingle();
        
        if (profileError || !profileData?.email) {
          throw new Error('Register number not found. Please check and try again.');
        }
        
        const { error } = await signIn(profileData.email, password);
        if (error) throw error;
        toast({
          title: 'Signing in...',
          description: 'Verifying your credentials.',
        });
      } else {
        const { error, data } = await signUp(email, password, fullName, registerNo.trim().toUpperCase());
        if (error) throw error;
        
        if (requestOfficialAccess && data?.user) {
          const { error: requestError } = await supabase
            .from('access_requests')
            .insert({
              user_id: data.user.id,
              full_name: fullName,
              email: email,
              reason: accessRequestReason || null,
              status: 'pending'
            });
          
          if (requestError) {
            console.error('Error creating access request:', requestError);
          }
        }
        
        toast({
          title: 'Account created!',
          description: requestOfficialAccess 
            ? 'Your official access request has been submitted for review.'
            : 'Welcome to the Campus Issue Reporting System.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-8 shadow-xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 mb-4 shadow-lg"
            >
              <img 
                src={collegeLogo} 
                alt="Sathyabama Logo" 
                className="w-full h-full object-contain bg-white p-1"
              />
            </motion.div>
            <h1 className="text-xl font-bold text-foreground">
              {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isForgotPassword
                ? 'Enter your email to receive a reset link'
                : isLogin
                ? 'Sign in with your Register No'
                : 'Register for campus issue reporting'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection with Dashboard Indicator (Login only) */}
            {isLogin && !isForgotPassword && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="role">Login As</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={selectedRole} onValueChange={(value: SelectedRole) => setSelectedRole(value)}>
                      <SelectTrigger className="pl-10">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="official">Official (Admin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Dashboard Indicator */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedRole}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      selectedRole === 'official' 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    {selectedRole === 'official' ? (
                      <>
                        <Command className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Command Center</p>
                          <p className="text-xs text-muted-foreground">Manage all incident reports</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Student Dashboard</p>
                          <p className="text-xs text-muted-foreground">Submit and track reports</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* Full Name (Sign Up only) */}
            {!isLogin && !isForgotPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </motion.div>
            )}

            {/* Email (Sign Up and Forgot Password only) */}
            {(!isLogin || isForgotPassword) && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@sathyabama.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
            )}

            {/* Register No (Login and Sign Up) */}
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="registerNo">Register No</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="registerNo"
                    type="text"
                    placeholder="e.g., 41XXXXXXXX"
                    value={registerNo}
                    onChange={(e) => setRegisterNo(e.target.value.toUpperCase())}
                    className="pl-10 uppercase"
                  />
                </div>
                {errors.registerNo && (
                  <p className="text-sm text-destructive">{errors.registerNo}</p>
                )}
              </div>
            )}

            {/* Official Access Request (Sign Up only) */}
            {!isLogin && !isForgotPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <Checkbox 
                    id="requestOfficial" 
                    checked={requestOfficialAccess}
                    onCheckedChange={(checked) => setRequestOfficialAccess(checked === true)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="requestOfficial" className="text-sm font-medium cursor-pointer">
                      Request Official/Admin Access
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Submit a request for official access
                    </p>
                  </div>
                </div>
                
                {requestOfficialAccess && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        id="reason"
                        placeholder="Why do you need official access?"
                        value={accessRequestReason}
                        onChange={(e) => setAccessRequestReason(e.target.value)}
                        className="pl-10 min-h-[60px]"
                        maxLength={500}
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Password */}
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={detectCapsLock}
                    onKeyUp={detectCapsLock}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                {capsLock && (
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Caps Lock is on</span>
                  </div>
                )}
              </div>
            )}

            {/* Forgot Password Link */}
            {isLogin && !isForgotPassword && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <AnimatedButton
              type="submit"
              className="w-full gradient-primary text-primary-foreground"
              disabled={loading}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
              ) : isForgotPassword ? (
                'Send Reset Link'
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </AnimatedButton>
          </form>

          {/* Toggle Auth Mode */}
          <div className="mt-6 text-center text-sm">
            {isForgotPassword ? (
              <button
                onClick={() => setIsForgotPassword(false)}
                className="text-primary hover:underline"
              >
                Back to sign in
              </button>
            ) : (
              <p className="text-muted-foreground">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </PageTransition>
  );
}
