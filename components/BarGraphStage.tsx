import React, { useRef, useState, useEffect } from 'react';
import { Block, GameState } from '../types';
import { ArrowUp, ArrowDown, X } from 'lucide-react';

interface BarGraphStageProps {
  blocks: Block[];
  userLineHeight: number; // Corresponds to fulcrumPosition
  setUserLineHeight: (h: number) => void;
  onBlockChange: (id: string, newVal: number) => void;
  gameState: GameState;
  average: number;
  onDeleteBlock?: (id: string) => void;
  isDeleteMode?: boolean;
  onBlockDragEnd?: (id: string, finalPos: number) => void;
  onLineDragEnd?: (finalPos: number) => void;
}

export const BarGraphStage: React.FC<BarGraphStageProps> = ({
  blocks,
  userLineHeight,
  setUserLineHeight,
  onBlockChange,
  gameState,
  average,
  onDeleteBlock,
  isDeleteMode,
  onBlockDragEnd,
  onLineDragEnd
}) => {
  const [draggingBarId, setDraggingBarId] = useState<string | null>(null);
  const [isDraggingLine, setIsDraggingLine] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for tracking values for logging
  const lastBlockValRef = useRef<number | null>(null);
  const lastLineValRef = useRef<number | null>(null);

  const MAX_VAL = 10;
  
  // Interaction Handlers
  const handleBarMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    if (isDeleteMode) {
        if (onDeleteBlock) onDeleteBlock(id);
        return;
    }

    setDraggingBarId(id);
  };

  const handleLineMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingLine(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      // Calculate height ratio (0 at bottom, 1 at top)
      // Y grows downwards in Client coords, so we invert
      const relativeY = rect.bottom - e.clientY;
      const heightRatio = Math.max(0, Math.min(1, relativeY / rect.height));
      const value = Math.max(1, Math.min(MAX_VAL, Math.round(heightRatio * MAX_VAL)));
      
      if (draggingBarId) {
          lastBlockValRef.current = value;
          onBlockChange(draggingBarId, value);
      }
      
      if (isDraggingLine) {
          // Allow float for line? Let's keep one decimal for smooth feel like fulcrum
          const rawVal = Math.max(1, Math.min(MAX_VAL, (relativeY / rect.height) * MAX_VAL));
          const rounded = Math.round(rawVal * 10) / 10;
          lastLineValRef.current = rounded;
          setUserLineHeight(rounded);
      }
    };

    const handleMouseUp = () => {
      if (draggingBarId && onBlockDragEnd) {
          if (lastBlockValRef.current !== null) {
              onBlockDragEnd(draggingBarId, lastBlockValRef.current);
          }
      }
      if (isDraggingLine && onLineDragEnd) {
          if (lastLineValRef.current !== null) {
              onLineDragEnd(lastLineValRef.current);
          }
      }
        
      setDraggingBarId(null);
      setIsDraggingLine(false);
      lastBlockValRef.current = null;
      lastLineValRef.current = null;
    };

    if (draggingBarId || isDraggingLine) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBarId, isDraggingLine, onBlockChange, setUserLineHeight, onBlockDragEnd, onLineDragEnd]);

  // Feedback Logic
  // diff > 0 means Average > UserLine (Average is higher than user guess) -> User needs to move UP
  const diff = average - userLineHeight;
  const isBalanced = Math.abs(diff) < 0.05;
  
  let message = "평균선을 움직여보세요";
  let statusColor = "text-slate-600 bg-white";
  
  if (gameState === GameState.CHECKING) {
      if (isBalanced) {
          message = "정확해요! 완벽한 평균입니다! 🎉";
          statusColor = "text-green-700 bg-green-100 border-green-300";
      } else if (diff > 0) {
          // Actual average is higher
          message = "평균선이 실제 평균보다 낮아요! (올려보세요 ⬆️)";
          statusColor = "text-orange-700 bg-orange-100 border-orange-300";
      } else {
          // Actual average is lower
          message = "평균선이 실제 평균보다 높아요! (내려보세요 ⬇️)";
          statusColor = "text-blue-700 bg-blue-100 border-blue-300";
      }
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-end px-8 pb-8 pt-20 relative select-none ${isDeleteMode ? 'cursor-context-menu' : ''}`}>
       
       {/* Feedback Overlay */}
       {gameState === GameState.CHECKING && (
           <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-bounce-short w-full text-center pointer-events-none">
                <div className={`inline-block px-6 py-3 rounded-2xl font-bold text-lg shadow-lg border-2 ${statusColor} transition-colors duration-300`}>
                    {message}
                </div>
           </div>
       )}

       {/* Graph Container */}
       <div ref={containerRef} className="relative w-full max-w-4xl h-[400px] border-b-4 border-slate-300 border-l-4">
           
           {/* Grid Lines */}
           {Array.from({ length: 10 }).map((_, i) => {
               const val = i + 1;
               return (
                   <div key={val} className="absolute w-full border-t border-slate-100 flex items-center" style={{ bottom: `${(val / MAX_VAL) * 100}%` }}>
                       <span className="absolute -left-8 text-xs text-slate-400 font-bold">{val}</span>
                   </div>
               )
           })}

           {/* Bars Area */}
           <div className="absolute inset-0 flex items-end justify-around px-8">
               {blocks.map((block) => (
                   <div key={block.id} className="h-full flex flex-col justify-end group w-16 relative">
                        {/* The Bar */}
                        <div 
                            onMouseDown={(e) => handleBarMouseDown(e, block.id)}
                            className={`
                                w-full rounded-t-lg shadow-md transition-all relative overflow-hidden flex justify-center pt-2
                                ${block.color} 
                                ${draggingBarId === block.id ? 'brightness-110 scale-[1.02]' : ''}
                                ${isDeleteMode 
                                    ? 'cursor-pointer hover:bg-red-500 hover:brightness-90 ring-2 ring-transparent hover:ring-red-400 animate-pulse-slow' 
                                    : 'cursor-ns-resize hover:brightness-105'
                                }
                            `}
                            style={{ 
                                height: `${(block.position / MAX_VAL) * 100}%`,
                                transition: draggingBarId === block.id ? 'none' : 'height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        >
                            {isDeleteMode ? (
                                <X className="text-white drop-shadow-md z-20" size={24} strokeWidth={3} />
                            ) : (
                                <div className="absolute top-2 w-full text-center text-white font-bold opacity-80 text-lg pointer-events-none">
                                    {block.position}
                                </div>
                            )}
                            
                            {/* Shine */}
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
                        </div>

                        {/* Ghost/Target Hint when Checking? */}
                        {gameState === GameState.CHECKING && (
                            <div 
                                className="absolute w-full border-t-2 border-dashed border-slate-400 opacity-30 transition-all duration-500 pointer-events-none"
                                style={{ bottom: `${(average / MAX_VAL) * 100}%`, left: 0 }}
                            >
                            </div>
                        )}
                   </div>
               ))}
           </div>

           {/* Actual Average Line (Only show when checking) */}
           {gameState === GameState.CHECKING && (
                <div 
                    className="absolute left-0 w-full z-10 pointer-events-none flex items-center justify-end pr-2 transition-all duration-700"
                    style={{ 
                        bottom: `${(average / MAX_VAL) * 100}%`,
                        transform: 'translateY(50%)' // Center the line on the value
                    }}
                >   
                    {/* The Line Itself */}
                    <div className="absolute inset-x-0 h-[4px] bg-green-500/80 shadow-sm"></div>
                    
                    <span className="relative z-10 text-green-700 font-bold text-xs bg-green-100 border border-green-200 px-2 py-1 rounded mb-6 mr-10 shadow-sm">
                        실제 평균: {parseFloat(average.toFixed(2))}
                    </span>
                </div>
           )}

           {/* User Estimate Line (Draggable) */}
           <div 
                onMouseDown={handleLineMouseDown}
                className={`
                    absolute left-0 w-full h-6 cursor-ns-resize z-20 group
                    flex items-center justify-center
                    ${isDeleteMode ? 'pointer-events-none opacity-50' : ''}
                `}
                style={{ 
                    bottom: `${(userLineHeight / MAX_VAL) * 100}%`,
                    transform: 'translateY(50%)', // Center the draggable area on the value
                    transition: isDraggingLine ? 'none' : 'bottom 0.2s ease-out'
                }}
           >    
                {/* Visual Line */}
                <div className={`w-full h-1.5 bg-blue-600 shadow-lg group-hover:bg-blue-500 transition-colors rounded-full ${isDraggingLine ? 'bg-blue-500' : ''}`}></div>
                
                {/* Drag Handle Left */}
                <div className="absolute -left-4 w-10 h-10 bg-blue-600 border-2 border-white rounded-full text-white flex items-center justify-center text-sm font-bold shadow-lg hover:scale-110 transition-transform">
                    {userLineHeight}
                </div>
                
                 {/* Drag Handle Right */}
                 <div className="absolute -right-4 bg-blue-600 border-2 border-white rounded-full text-white px-3 py-1.5 flex items-center justify-center text-xs font-bold shadow-lg hover:scale-105 transition-transform min-w-[80px]">
                    <span>평균선</span>
                    {/* Direction Hints during check */}
                    {gameState === GameState.CHECKING && !isBalanced && (
                        <div className="ml-1 animate-pulse">
                            {diff > 0 ? <ArrowUp size={14} strokeWidth={3} /> : <ArrowDown size={14} strokeWidth={3} />}
                        </div>
                    )}
                </div>
           </div>

       </div>
    </div>
  );
};