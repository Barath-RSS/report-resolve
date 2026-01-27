import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Shield, Eye, EyeOff, AlertTriangle, Mail, Lock, User, LayoutDashboard, Command, FileText, Hash, GraduationCap, Briefcase, KeyRound, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
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
type ResetStep = 'email' | 'otp' | 'newPassword' | 'success';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [userType, setUserType] = useState<UserType>('student');
  const [email, setEmail] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessRequestReason, setAccessRequestReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; registerNo?: string; newPassword?: string; confirmPassword?: string }>({});
  const [officialRequestSubmitted, setOfficialRequestSubmitted] = useState(false);

  const { signIn, signUp, user, role, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !role) return;

    if (role === 'official') {
      navigate('/command-center');
      return;
    }

    if (role === 'student') {
      if (userType === 'student') {
        navigate('/dashboard');
      }
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

  // Reset forgot password state when leaving
  useEffect(() => {
    if (!isForgotPassword) {
      setResetStep('email');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isForgotPassword]);

  const detectCapsLock = (e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (isForgotPassword) {
      if (resetStep === 'email') {
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
          newErrors.email = emailResult.error.errors[0].message;
        }
      } else if (resetStep === 'newPassword') {
        const passwordResult = passwordSchema.safeParse(newPassword);
        if (!passwordResult.success) {
          newErrors.newPassword = passwordResult.error.errors[0].message;
        }
        if (newPassword !== confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      }
    } else if (isLogin) {
      if (userType === 'student') {
        const registerNoResult = registerNoSchema.safeParse(registerNo);
        if (!registerNoResult.success) {
          newErrors.registerNo = registerNoResult.error.errors[0].message;
        }
      } else {
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
        const emailResult = officialEmailSchema.safeParse(email);
        if (!emailResult.success) {
          newErrors.email = emailResult.error.errors[0].message;
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email: email.toLowerCase() },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: '📧 Code Sent!',
        description: 'Check your email for the 6-digit verification code.',
      });
      setResetStep('otp');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the complete 6-digit code.',
        variant: 'destructive',
      });
      return;
    }
    setResetStep('newPassword');
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          email: email.toLowerCase(), 
          code: otpCode,
          newPassword: newPassword,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResetStep('success');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isForgotPassword) {
      if (resetStep === 'email') {
        await handleSendOtp();
      } else if (resetStep === 'otp') {
        await handleVerifyOtp();
      } else if (resetStep === 'newPassword') {
        await handleResetPassword();
      }
      return;
    }

    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (isLogin) {
        let loginEmail = email;
        
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
        
        if (userType === 'official') {
          await new Promise(resolve => setTimeout(resolve, 300));
          
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
              const { data: accessRequest } = await supabase
                .from('access_requests')
                .select('status')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              await supabase.auth.signOut();
              
              if (accessRequest?.status === 'pending') {
                throw new Error('Your official access request is still pending approval. Please wait for an administrator to approve your request.');
              } else if (accessRequest?.status === 'rejected') {
                throw new Error('Your official access request was rejected. Please contact an administrator.');
              } else if (accessRequest?.status === 'approved') {
                throw new Error('Your request was approved, but your official role is not active yet. Please try again in a minute.');
              } else {
                throw new Error('You do not have official access. Please request official access first by signing up as an official.');
              }
            }
            
            toast({
              title: '🎉 Welcome back!',
              description: 'Signing you in to Command Center...',
            });
            return;
          }
        } else {
          toast({
            title: '🎉 Welcome back!',
            description: 'Signing you in...',
          });
        }
      } else {
        const formattedRegisterNo = userType === 'student' ? registerNo.trim().toUpperCase() : null;

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
          
          await supabase.auth.signOut();
          setOfficialRequestSubmitted(true);
          return;
        } else {
          toast({
            title: '🎉 Account created!',
            description: 'Welcome to Campus Connect.',
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

  // Password reset success screen
  if (isForgotPassword && resetStep === 'success') {
    return (
      <PageTransition className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-3xl p-8 shadow-2xl text-center border-2 border-success/20">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-success/20 to-success/10 mb-6 shadow-lg"
            >
              <CheckCircle2 className="w-10 h-10 text-success" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Password Reset Complete!
            </h1>
            <p className="text-muted-foreground mb-8">
              Your password has been successfully updated. You can now sign in with your new password.
            </p>
            
            <AnimatedButton
              onClick={() => {
                setIsForgotPassword(false);
                setResetStep('email');
                setEmail('');
                setOtpCode('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              Back to Sign In
            </AnimatedButton>
          </div>
        </motion.div>
      </PageTransition>
    );
  }

  // Show success message for official request
  if (officialRequestSubmitted) {
    return (
      <PageTransition className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="glass-card rounded-3xl p-8 shadow-2xl text-center border-2 border-success/20">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-success/20 to-success/10 mb-6 shadow-lg"
            >
              <Shield className="w-10 h-10 text-success" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Request Submitted!
            </h1>
            <p className="text-muted-foreground mb-8">
              Your request for official access has been submitted successfully. 
              An administrator will review and approve your request. 
              You will be able to log in once your access is approved.
            </p>
            
            <AnimatedButton
              onClick={() => {
                setOfficialRequestSubmitted(false);
                setIsLogin(true);
              }}
              className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              Back to Login
            </AnimatedButton>
          </div>
        </motion.div>
      </PageTransition>
    );
  }

  // Forgot Password Flow
  if (isForgotPassword) {
    return (
      <PageTransition className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="glass-card rounded-3xl p-8 shadow-2xl border border-border/50">
            {/* Back Button */}
            <button
              onClick={() => {
                if (resetStep === 'email') {
                  setIsForgotPassword(false);
                } else if (resetStep === 'otp') {
                  setResetStep('email');
                } else if (resetStep === 'newPassword') {
                  setResetStep('otp');
                }
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm">Back</span>
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-4 shadow-lg"
              >
                {resetStep === 'email' && <Mail className="w-8 h-8 text-primary" />}
                {resetStep === 'otp' && <KeyRound className="w-8 h-8 text-primary" />}
                {resetStep === 'newPassword' && <Lock className="w-8 h-8 text-primary" />}
              </motion.div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {resetStep === 'email' && 'Reset Password'}
                {resetStep === 'otp' && 'Enter Code'}
                {resetStep === 'newPassword' && 'Create New Password'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {resetStep === 'email' && "Enter your email and we'll send you a verification code"}
                {resetStep === 'otp' && 'Enter the 6-digit code sent to your email'}
                {resetStep === 'newPassword' && 'Choose a strong password for your account'}
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {['email', 'otp', 'newPassword'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ 
                      scale: resetStep === step ? 1.1 : 1,
                      backgroundColor: 
                        (resetStep === step || 
                         (resetStep === 'otp' && index === 0) || 
                         (resetStep === 'newPassword' && index <= 1))
                          ? 'hsl(var(--primary))' 
                          : 'hsl(var(--muted))'
                    }}
                    className="w-3 h-3 rounded-full transition-colors"
                  />
                  {index < 2 && (
                    <div className={`w-12 h-0.5 mx-1 transition-colors ${
                      (resetStep === 'otp' && index === 0) || 
                      (resetStep === 'newPassword' && index <= 1)
                        ? 'bg-primary' 
                        : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {resetStep === 'email' && (
                  <motion.div
                    key="email-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="yourname@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-12 h-12 rounded-xl border-2 focus:border-primary transition-colors"
                        />
                      </div>
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {resetStep === 'otp' && (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center space-y-4">
                      <p className="text-sm text-muted-foreground text-center">
                        Code sent to <span className="font-medium text-foreground">{email}</span>
                      </p>
                      <InputOTP
                        maxLength={6}
                        value={otpCode}
                        onChange={(value) => setOtpCode(value)}
                        className="justify-center"
                      >
                        <InputOTPGroup className="gap-2">
                          {[0, 1, 2, 3, 4, 5].map((index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="w-12 h-14 text-xl font-bold rounded-xl border-2 focus:border-primary transition-colors"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="text-sm text-primary hover:underline disabled:opacity-50"
                      >
                        Resend Code
                      </button>
                    </div>
                  </motion.div>
                )}

                {resetStep === 'newPassword' && (
                  <motion.div
                    key="password-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-12 pr-12 h-12 rounded-xl border-2 focus:border-primary transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {errors.newPassword && (
                        <p className="text-sm text-destructive">{errors.newPassword}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-12 h-12 rounded-xl border-2 focus:border-primary transition-colors"
                        />
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Use at least 8 characters with a mix of letters and numbers
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatedButton
                type="submit"
                className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
                disabled={loading || (resetStep === 'otp' && otpCode.length !== 6)}
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                  />
                ) : resetStep === 'email' ? (
                  'Send Verification Code'
                ) : resetStep === 'otp' ? (
                  'Verify Code'
                ) : (
                  'Reset Password'
                )}
              </AnimatedButton>
            </form>
          </div>
        </motion.div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-card rounded-3xl p-8 shadow-2xl border border-border/50">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 mb-4 shadow-xl bg-white"
            >
              <img 
                src={collegeLogo} 
                alt="Sathyabama Logo" 
                className="w-full h-full object-contain p-1"
              />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin
                ? `Sign in as ${userType === 'student' ? 'Student' : 'Official'}`
                : `Register as ${userType === 'student' ? 'Student' : 'Official'}`}
            </p>
          </div>

          {/* User Type Selector */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setUserType('student')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 transition-all duration-200 ${
                userType === 'student'
                  ? 'border-primary bg-primary/10 text-primary shadow-md'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span className="text-sm font-medium">Student</span>
            </button>
            <button
              type="button"
              onClick={() => setUserType('official')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 transition-all duration-200 ${
                userType === 'official'
                  ? 'border-primary bg-primary/10 text-primary shadow-md'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              <span className="text-sm font-medium">Official</span>
            </button>
          </div>

          {/* Info Banner based on user type */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${userType}-${isLogin}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 mb-6 ${
                userType === 'official' 
                  ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30' 
                  : 'bg-gradient-to-r from-muted/50 to-muted/30 border-border'
              }`}
            >
              {userType === 'official' ? (
                <>
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Command className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Command Center</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isLogin ? 'Login with @sathyabama.ac.in email' : 'Use official email to register'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Student Dashboard</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isLogin ? 'Login with your Register No' : 'Use personal email to register'}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name (Sign Up only) */}
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-12 h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </motion.div>
            )}

            {/* Email Field */}
            {(userType === 'official' || !isLogin) && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  {userType === 'official' ? 'Official Email' : 'Email'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={userType === 'official' ? 'name@sathyabama.ac.in' : 'yourname@gmail.com'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-12 rounded-xl border-2 focus:border-primary transition-colors"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
            )}

            {/* Register No (Students only - login and signup) */}
            {userType === 'student' && (
              <div className="space-y-2">
                <Label htmlFor="registerNo" className="text-sm font-medium">Register No</Label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="registerNo"
                    type="text"
                    placeholder="e.g., 41XXXXXXXX"
                    value={registerNo}
                    onChange={(e) => setRegisterNo(e.target.value.toUpperCase())}
                    className="pl-12 h-12 rounded-xl border-2 focus:border-primary transition-colors uppercase"
                  />
                </div>
                {errors.registerNo && (
                  <p className="text-sm text-destructive">{errors.registerNo}</p>
                )}
              </div>
            )}

            {/* Reason for Official Signup */}
            {userType === 'official' && !isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label htmlFor="reason" className="text-sm font-medium">Department / Role (Optional)</Label>
                <div className="relative">
                  <FileText className="absolute left-4 top-3 h-5 w-5 text-muted-foreground" />
                  <Textarea
                    id="reason"
                    placeholder="e.g., Maintenance Department, Faculty - CSE"
                    value={accessRequestReason}
                    onChange={(e) => setAccessRequestReason(e.target.value)}
                    className="pl-12 min-h-[70px] rounded-xl border-2 focus:border-primary transition-colors"
                    maxLength={500}
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Admin approval required for official access
                </p>
              </motion.div>
            )}

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={detectCapsLock}
                  onKeyUp={detectCapsLock}
                  className="pl-12 pr-12 h-12 rounded-xl border-2 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
              {!errors.password && !isLogin && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Use at least 8 characters with a mix of letters and numbers
                </p>
              )}
              {capsLock && (
                <div className="flex items-center gap-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Caps Lock is on</span>
                </div>
              )}
            </div>

            {/* Forgot Password Link */}
            {isLogin && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <AnimatedButton
              type="submit"
              className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
              disabled={loading}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </AnimatedButton>
          </form>

          {/* Toggle Auth Mode */}
          <div className="mt-8 text-center text-sm">
            <p className="text-muted-foreground">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-semibold"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </PageTransition>
  );
}
