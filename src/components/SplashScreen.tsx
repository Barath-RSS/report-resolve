import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import collegeLogo from '@/assets/college-logo.jpg';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center gap-6"
          >
            {/* Logo */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-40 h-40 md:w-52 md:h-52 rounded-full overflow-hidden shadow-2xl border-4 border-primary/20"
            >
              <img 
                src={collegeLogo} 
                alt="Sathyabama Institute of Science and Technology" 
                className="w-full h-full object-contain bg-white p-2"
              />
            </motion.div>

            {/* College Name */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center space-y-2"
            >
              <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-wide">
                SATHYABAMA
              </h1>
              <p className="text-sm md:text-base text-foreground font-medium">
                Institute of Science and Technology
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                (Deemed to be University)
              </p>
            </motion.div>

            {/* Motto */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-sm font-semibold text-primary tracking-widest uppercase"
            >
              Justice • Peace • Revolution
            </motion.p>

            {/* Loading Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-4"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-primary"
                    animate={{ 
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.15
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* App Name at bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute bottom-8 text-center"
          >
            <p className="text-xs text-muted-foreground">
              Campus Issue Reporting System
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
