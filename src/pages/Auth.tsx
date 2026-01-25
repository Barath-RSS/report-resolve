import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Shield, Eye, EyeOff, AlertTriangle, Mail, Lock, User, Users, LayoutDashboard, Command, FileText, Hash, GraduationCap, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PageTransition } from '@/components/ui/PageTransition';
import { supabase } from '@/integrations/supabase/client';
import collegeLogo from '@/assets/college-logo.jpg';

const emailSchema = z.string().email('Invalid email format').max(255);
const passwordSchema = z.string().min(8, 'Use a stronger password (minimum 8 characters)').max(128);
const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100);
const registerNoSchema = z.string().min(5, 'Register No must be at least 5 characters').max(20);
const officialEmailSchema = z.string().email('Invalid email format').refine(
  (email) => email.endsWith('@sathyabama.ac.in'),
  { message: 'Officials must use @sathyabama.ac.in email' }
);
const studentEmailSchema = z.string().email('Invalid email format').refine(
  (email) => !email.endsWith('@sathyabama.ac.in'),
  { message: 'Students should use personal email (not @sathyabama.ac.in)' }
);

type UserType = 'student' | 'official';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [userType, setUserType] = useState<UserType>('student');
  const [email, setEmail] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessRequestReason, setAccessRequestReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; registerNo?: string }>({});
  const [officialRequestSubmitted, setOfficialRequestSubmitted] = useState(false);

  const { signIn, signUp, resetPassword, user, role, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !role) return;

    // IMPORTANT: If someone is attempting an official login but their backend role
    // is not official (pending/rejected/etc), we should NOT redirect them into the
    // student dashboard. The submit handler will sign them out + show the correct toast.
    if (role === 'official') {
      navigate('/command-center');
      return;
    }

    if (role === 'student') {
      if (userType === 'student') {
        navigate('/dashboard');
      }
      // else: stay on /auth
    }
  }, [user, role, authLoading, navigate, userType]);

  // Reset form when switching user type or auth mode
  useEffect(() => {
    setEmail('');
    setRegisterNo('');
    setPassword('');
    setFullName('');
    setAccessRequestReason('');
    setErrors({});
  }, [userType, isLogin]);

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
      // Login validation
      if (userType === 'student') {
        const registerNoResult = registerNoSchema.safeParse(registerNo);
        if (!registerNoResult.success) {
          newErrors.registerNo = registerNoResult.error.errors[0].message;
        }
      } else {
        // Official login with email
        const emailResult = officialEmailSchema.safeParse(email);
        if (!emailResult.success) {
          newErrors.email = emailResult.error.errors[0].message;
        }
      }
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    } else {
      // Sign up validation
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.fullName = nameResult.error.errors[0].message;
      }
      
      if (userType === 'student') {
        const emailResult = studentEmailSchema.safeParse(email);
        if (!emailResult.success) {
          newErrors.email = emailResult.error.errors[0].message;
        }
        const registerNoResult = registerNoSchema.safeParse(registerNo);
        if (!registerNoResult.success) {
          newErrors.registerNo = registerNoResult.error.errors[0].message;
        }
      } else {
        // Official sign up
        const emailResult = officialEmailSchema.safeParse(email);
        if (!emailResult.success) {
          newErrors.email = emailResult.error.errors[0].message;
        }
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
        let loginEmail = email;
        
        // For students, look up email by register number (via backend function)
        if (userType === 'student') {
          const { data, error: lookupError } = await supabase.functions.invoke('student-lookup', {
            body: { registerNo: registerNo.trim() },
          });

          if (lookupError) {
            throw new Error('Unable to find your account right now. Please try again.');
          }

          if (!data?.email) {
            throw new Error('Register number not found. Please sign up first.');
          }

          loginEmail = data.email;
        }
        
        const { error } = await signIn(loginEmail, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Invalid credentials. Please check your password.');
          }
          throw error;
        }
        
        // After successful login, check role for official login attempts
        if (userType === 'official') {
          // Give a small delay for auth state to update
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Check the user's actual role
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: isOfficial, error: roleCheckError } = await supabase.rpc('has_role', {
              _user_id: currentUser.id,
              _role: 'official',
            });

            if (roleCheckError) {
              await supabase.auth.signOut();
              throw new Error('Unable to verify official access right now. Please try again.');
            }

            if (!isOfficial) {
              // Check if they have a pending access request
              const { data: accessRequest } = await supabase
                .from('access_requests')
                .select('status')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              // Sign them out immediately to prevent redirect
              await supabase.auth.signOut();
              
              // Throw error based on access request status
              if (accessRequest?.status === 'pending') {
                throw new Error('Your official access request is still pending approval. Please wait for an administrator to approve your request.');
              } else if (accessRequest?.status === 'rejected') {
                throw new Error('Your official access request was rejected. Please contact an administrator.');
              } else if (accessRequest?.status === 'approved') {
                // This can happen if their role update is still propagating or if there are duplicate role rows.
                throw new Error('Your request was approved, but your official role is not active yet. Please try again in a minute.');
              } else {
                throw new Error('You do not have official access. Please request official access first by signing up as an official.');
              }
            }
            
            // User is a valid official - show welcome message
            toast({
              title: 'Welcome back!',
              description: 'Signing you in to Command Center...',
            });
            return; // Let the useEffect handle navigation
          }
        } else {
          // Student login - show welcome message
          toast({
            title: 'Welcome back!',
            description: 'Signing you in...',
          });
        }
      } else {
        // Sign up
        const formattedRegisterNo = userType === 'student' ? registerNo.trim().toUpperCase() : null;

        // Prevent confusing 500s: if student register no already exists, guide them to login
        if (userType === 'student' && formattedRegisterNo) {
          const { data: existing, error: lookupError } = await supabase.functions.invoke('student-lookup', {
            body: { registerNo: formattedRegisterNo },
          });

          if (!lookupError && existing?.email) {
            throw new Error('This register number is already registered. Please sign in instead.');
          }
        }
        
        const { error, data } = await signUp(
          email, 
          password, 
          fullName, 
          formattedRegisterNo || ''
        );
        
        if (error) {
          if (error.message.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw error;
        }
        
        // For officials, create access request and show success message
        if (userType === 'official' && data?.user) {
          const { error: requestError } = await supabase
            .from('access_requests')
            .insert({
              user_id: data.user.id,
              full_name: fullName,
              email: email,
              reason: accessRequestReason || 'Official access request',
              status: 'pending'
            });
          
          if (requestError) {
            console.error('Error creating access request:', requestError);
          }
          
          // Sign out the official since they need approval first
          await supabase.auth.signOut();
          
          // Show the success message instead of redirecting
          setOfficialRequestSubmitted(true);
          return;
        } else {
          toast({
            title: 'Account created!',
            description: 'Welcome to the Campus Issue Reporting System.',
          });
        }
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

  // Show success message for official request
  if (officialRequestSubmitted) {
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
          <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-xl text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-success/10 mb-4"
            >
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-success" />
            </motion.div>
            
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              Request Submitted!
            </h1>
            <p className="text-muted-foreground mb-6">
              Your request for official access has been submitted successfully. 
              An administrator will review and approve your request. 
              You will be able to log in once your access is approved.
            </p>
            
            <AnimatedButton
              onClick={() => {
                setOfficialRequestSubmitted(false);
                setIsLogin(true);
              }}
              className="w-full gradient-primary text-primary-foreground"
            >
              Back to Login
            </AnimatedButton>
          </div>
        </motion.div>
      </PageTransition>
    );
  }

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
        <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-xl">
          {/* Logo & Title */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-primary/20 mb-4 shadow-lg"
            >
              <img 
                src={collegeLogo} 
                alt="Sathyabama Logo" 
                className="w-full h-full object-contain bg-white p-1"
              />
            </motion.div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {isForgotPassword
                ? 'Enter your email to receive a reset link'
                : isLogin
                ? `Sign in as ${userType === 'student' ? 'Student' : 'Official'}`
                : `Register as ${userType === 'student' ? 'Student' : 'Official'}`}
            </p>
          </div>

          {/* User Type Selector (not shown for forgot password) */}
          {!isForgotPassword && (
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setUserType('student')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                  userType === 'student'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm font-medium">Student</span>
              </button>
              <button
                type="button"
                onClick={() => setUserType('official')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                  userType === 'official'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm font-medium">Official</span>
              </button>
            </div>
          )}

          {/* Info Banner based on user type */}
          {!isForgotPassword && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${userType}-${isLogin}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`flex items-center gap-3 p-3 rounded-lg border mb-4 ${
                  userType === 'official' 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted/50 border-border'
                }`}
              >
                {userType === 'official' ? (
                  <>
                    <Command className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Command Center</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isLogin ? 'Login with @sathyabama.ac.in email' : 'Use official email to register'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <LayoutDashboard className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Student Dashboard</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isLogin ? 'Login with your Register No' : 'Use personal email to register'}
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Email Field */}
            {/* Show for: Official login, Official signup, Student signup, Forgot password */}
            {(userType === 'official' || !isLogin || isForgotPassword) && (
              <div className="space-y-2">
                <Label htmlFor="email">
                  {userType === 'official' ? 'Official Email' : 'Email'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={userType === 'official' ? 'name@sathyabama.ac.in' : 'yourname@gmail.com'}
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

            {/* Register No (Students only - login and signup) */}
            {userType === 'student' && !isForgotPassword && (
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

            {/* Reason for Official Signup */}
            {userType === 'official' && !isLogin && !isForgotPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label htmlFor="reason">Department / Role (Optional)</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="reason"
                    placeholder="e.g., Maintenance Department, Faculty - CSE"
                    value={accessRequestReason}
                    onChange={(e) => setAccessRequestReason(e.target.value)}
                    className="pl-10 min-h-[60px]"
                    maxLength={500}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Admin approval required for official access
                </p>
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
                {!errors.password && !isForgotPassword && !isLogin && (
                  <p className="text-xs text-muted-foreground">
                    Tip: Use at least 8 characters (mix letters and numbers).
                  </p>
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
