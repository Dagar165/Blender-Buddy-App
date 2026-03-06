import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import { Store, Coins, Crown, Zap, Mouse, Keyboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SHOP_ITEMS = [
  { id: "item1", name: "Magic Hat", cost: 50, icon: Crown, color: "text-purple-500", bg: "bg-purple-100" },
  { id: "item2", name: "Speed Potion", cost: 100, icon: Zap, color: "text-blue-500", bg: "bg-blue-100" },
  { id: "item3", name: "Golden Keyboard", cost: 150, icon: Keyboard, color: "text-yellow-500", bg: "bg-yellow-100" },
  { id: "item4", name: "Pro Mouse", cost: 200, icon: Mouse, color: "text-rose-500", bg: "bg-rose-100" },
];

export default function ShopPage() {
  const { gold, inventory, buyItem } = useGameState();
  const { toast } = useToast();

  const handleBuy = (id: string, cost: number, name: string) => {
    const success = buyItem(id, cost, name);
    if (success) {
      toast({
        title: "Item Purchased! 🎉",
        description: `${name} has been added to your inventory.`,
      });
    } else {
      toast({
        title: "Not enough gold!",
        description: "Complete more quests to earn gold.",
        variant: "destructive",
      });
    }
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
          <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-800">Pet Shop</h1>
            <p className="text-slate-500 text-sm font-medium">Buy cool gear for your mascot!</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SHOP_ITEMS.map((item, i) => {
            const isOwned = inventory.includes(item.name);
            const canAfford = gold >= item.cost;
            const Icon = item.icon;
            
            return (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                key={item.id} 
                className="bg-white p-4 rounded-3xl shadow-md shadow-slate-200/50 flex flex-col items-center text-center border-2 border-transparent hover:border-purple-100 transition-colors"
              >
                <div className={`w-16 h-16 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-8 h-8" />
                </div>
                
                <h3 className="font-bold text-slate-800 text-sm mb-3 h-10 flex items-center">{item.name}</h3>
                
                <button
                  onClick={() => !isOwned && handleBuy(item.id, item.cost, item.name)}
                  disabled={isOwned || (!canAfford && !isOwned)}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    isOwned 
                      ? "bg-slate-100 text-slate-400"
                      : canAfford
                        ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                        : "bg-slate-100 text-slate-400 opacity-70"
                  }`}
                >
                  {isOwned ? (
                    "Owned"
                  ) : (
                    <>
                      {item.cost} <Coins className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
