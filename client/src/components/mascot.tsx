import { useState } from "react";
import { motion } from "framer-motion";
import { Ghost } from "lucide-react";

export function Mascot() {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      animate={{ y: [0, -15, 0] }}
      transition={{ 
        repeat: Infinity, 
        duration: 3, 
        ease: "easeInOut" 
      }}
      className="relative flex items-center justify-center w-48 h-48 mx-auto"
    >
      <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
      
      {!imgError ? (
        <img 
          src="/ghost-mascot.png" 
          alt="3D Buddy Mascot" 
          className="relative z-10 w-full h-full object-contain drop-shadow-xl"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="relative z-10 w-full h-full bg-gradient-to-tr from-primary to-blue-300 rounded-3xl flex flex-col items-center justify-center text-white shadow-xl shadow-primary/30 border-4 border-white transform rotate-3">
          <Ghost className="w-20 h-20 mb-2 drop-shadow-md" strokeWidth={1.5} />
          <span className="font-display font-bold text-xl drop-shadow-md">Маскот</span>
        </div>
      )}
      
      {/* Cute little floating sparkles */}
      <motion.div 
        animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
        className="absolute top-0 right-4 w-3 h-3 bg-yellow-400 rounded-full"
      />
      <motion.div 
        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
        transition={{ repeat: Infinity, duration: 2.5, delay: 1 }}
        className="absolute bottom-8 left-0 w-2 h-2 bg-secondary rounded-full"
      />
    </motion.div>
  );
}
