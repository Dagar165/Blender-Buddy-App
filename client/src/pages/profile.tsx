import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import { User, Trophy, Package, RotateCcw, PenSquare } from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const { username, level, xp, gold, inventory, setUsername, resetGame } = useGameState();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(username);

  const handleSaveName = () => {
    if (editName.trim()) {
      setUsername(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-slate-50"
    >
      <TopBar />
      
      <div className="px-6 pb-24 overflow-y-auto">
        <div className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-0" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-primary to-blue-300 rounded-full flex items-center justify-center text-white shadow-md border-4 border-white">
              <User className="w-10 h-10" />
            </div>
            
            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-100 border-none rounded-lg px-3 py-1 w-full text-slate-800 font-bold focus:ring-2 focus:ring-primary outline-none"
                    autoFocus
                    onBlur={handleSaveName}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-display font-bold text-slate-800 truncate">
                    {username}
                  </h2>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-400 hover:text-primary transition-colors bg-slate-50 rounded-full"
                  >
                    <PenSquare className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md text-xs">Level {level}</span>
                <span className="text-slate-500 text-sm font-medium">{xp} Total XP</span>
              </div>
            </div>
          </div>
        </div>

        <h3 className="font-display font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
          <Package className="text-secondary" /> My Inventory
        </h3>
        
        {inventory.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center mb-8">
            <p className="text-slate-500 font-medium">Your inventory is empty.<br/>Visit the shop to buy cool gear!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-8">
            {inventory.map((item, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-primary">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-700 text-sm">{item}</span>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={() => {
            if (window.confirm("Are you sure you want to reset all your progress?")) {
              resetGame();
            }
          }}
          className="w-full py-4 flex items-center justify-center gap-2 text-red-500 font-bold bg-red-50 hover:bg-red-100 rounded-2xl transition-colors"
        >
          <RotateCcw className="w-5 h-5" /> Reset Game Progress
        </button>
      </div>
    </motion.div>
  );
}
