import { motion } from 'framer-motion';
import { Shield, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'official') {
        navigate('/command-center');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, role, loading, navigate]);

  return (
    <PageTransition className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.1),transparent_50%)]" />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-primary shadow-glow mb-8"
          >
            <Shield className="w-10 h-10 text-primary-foreground" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6"
          >
            Incident Reporting
            <br />
            <span className="text-primary">Made Simple</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto"
          >
            Report infrastructure issues, personal concerns, and security incidents 
            with automatic location tracking and photo evidence.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/auth">
              <AnimatedButton
                size="lg"
                className="gradient-primary text-primary-foreground px-8 h-14 text-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </AnimatedButton>
            </Link>
            <Link to="/admin">
              <AnimatedButton
                size="lg"
                variant="outline"
                className="px-8 h-14 text-lg"
              >
                Admin Panel
              </AnimatedButton>
            </Link>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {[
              { title: 'Quick Reporting', desc: 'Submit issues in seconds' },
              { title: 'GPS Tracking', desc: 'Automatic location capture' },
              { title: 'Real-time Updates', desc: 'Track your report status' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="p-6 rounded-2xl bg-card/50 border border-border/50"
              >
                <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-6 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Secure • Confidential • Anonymous Reporting Available
          </p>
        </motion.footer>
      </div>
    </PageTransition>
  );
};

export default Index;
