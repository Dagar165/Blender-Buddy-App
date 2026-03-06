import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import { CheckCircle, Coins, Target } from "lucide-react";

const TEST_QUESTS = [
  {
    id: "q1",
    title: "Model an Apple",
    description: "Use the subdivision surface modifier to make a cute low-poly apple.",
    xpReward: 50,
    goldReward: 20,
  },
  {
    id: "q2",
    title: "Learn Extrude",
    description: "Press 'E' to extrude a face on the default cube.",
    xpReward: 100,
    goldReward: 50,
  },
  {
    id: "q3",
    title: "Add a Material",
    description: "Make your cube look like a shiny piece of plastic.",
    xpReward: 75,
    goldReward: 30,
  }
];

export default function QuestsPage() {
  const { completedQuests, completeQuest } = useGameState();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-slate-50"
    >
      <TopBar />
      
      <div className="px-6 pb-24 overflow-y-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-800">Daily Quests</h1>
            <p className="text-slate-500 text-sm font-medium">Complete to level up!</p>
          </div>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {TEST_QUESTS.map((quest) => {
            const isCompleted = completedQuests.includes(quest.id);
            
            return (
              <motion.div 
                key={quest.id} 
                variants={item}
                className={`p-5 rounded-3xl border-2 transition-all ${
                  isCompleted 
                    ? "bg-white border-green-100 opacity-60" 
                    : "bg-white border-transparent shadow-lg shadow-slate-200/50 hover:border-primary/20"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-display font-bold text-lg text-slate-800">
                    {quest.title}
                  </h3>
                  {isCompleted && <CheckCircle className="text-green-500 w-6 h-6" />}
                </div>
                
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  {quest.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1 bg-blue-50 text-primary px-3 py-1 rounded-xl text-xs font-bold">
                      +{quest.xpReward} XP
                    </span>
                    <span className="flex items-center gap-1 bg-yellow-50 text-yellow-600 px-3 py-1 rounded-xl text-xs font-bold">
                      +{quest.goldReward} <Coins className="w-3 h-3" />
                    </span>
                  </div>
                  
                  <button
                    onClick={() => !isCompleted && completeQuest(quest.id, quest.xpReward, quest.goldReward)}
                    disabled={isCompleted}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                      isCompleted 
                        ? "bg-slate-100 text-slate-400"
                        : "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30 hover:shadow-lg"
                    }`}
                  >
                    {isCompleted ? "Done" : "Complete"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
