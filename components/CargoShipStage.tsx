import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Block, AppState } from '../types';
import { BlockComponent } from './BlockComponent';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Bot, Droplets, Target } from 'lucide-react';

interface CargoShipStageProps {
  blocks: Block[];
  fulcrumPosition: number;
  setFulcrumPosition: (pos: number) => void;
  onBlockMove?: (id: string, newPos: number) => void;
  onDeleteBlock?: (id: string) => void;
  isDeleteMode?: boolean;
  appState: AppState;
  isHintActive: boolean;
  average: number;
  onBlockDragStart?: (id: string, startPos: number) => void;
  onBlockDragEnd?: (id: string, startPos: number, finalPos: number) => void;
  onFulcrumDragStart?: (startPos: number) => void;
  onFulcrumDragEnd?: (startPos: number, finalPos: number) => void;
}

export const CargoShipStage: React.FC<CargoShipStageProps> = ({
  blocks,
  fulcrumPosition,
  setFulcrumPosition,
  onBlockMove,
  onDeleteBlock,
  isDeleteMode,
  appState,
  isHintActive,
  average,
  onBlockDragStart,
  onBlockDragEnd,
  onFulcrumDragStart,
  onFulcrumDragEnd
}) => {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [isDraggingFulcrum, setIsDraggingFulcrum] = useState(false);
  const shipRef = useRef<HTMLDivElement>(null);
  
  const lastBlockPosRef = useRef<number | null>(null);
  const lastFulcrumPosRef = useRef<number | null>(null);
  const initialBlockPosRef = useRef<number | null>(null);
  const initialFulcrumPosRef = useRef<number | null>(null);

  const MIN_VAL = 1;
  const MAX_VAL = 10;
  const RANGE = MAX_VAL - MIN_VAL;

  const { angle, direction, sinkDepth, leftWeight, rightWeight, isBalanced } = useMemo(() => {
    let left = 0;
    let right = 0;
    
    blocks.forEach(b => {
      if (b.position < fulcrumPosition) left += (fulcrumPosition - b.position);
      if (b.position > fulcrumPosition) right += (b.position - fulcrumPosition);
    });

    const diff = average - fulcrumPosition;
    const balanced = blocks.length === 0 || Math.abs(diff) < 0.01;

    const isLocked = appState === 'LOBBY' || appState === 'PLAYING' || appState === 'LEVEL_CLEAR';

    if (isLocked) return { angle: 0, direction: 'none', sinkDepth: 0, leftWeight: left, rightWeight: right, isBalanced: balanced };
    
    let currentAngle = 0;
    let currentSink = 0;
    let currentDirection = 'none';

    if (balanced) {
      currentDirection = 'balanced';
      currentSink = 10; // slightly sunk due to weight
    } else if (diff > 0) {
      currentAngle = Math.min(30, diff * 10);
      currentDirection = 'right-heavy';
      currentSink = 30; // sinks more when tilted
    } else {
      currentAngle = Math.max(-30, diff * 10);
      currentDirection = 'left-heavy';
      currentSink = 30;
    }
    
    return { angle: currentAngle, direction: currentDirection, sinkDepth: currentSink, leftWeight: left, rightWeight: right, isBalanced: balanced };
  }, [appState, fulcrumPosition, average, blocks]);

  // NAVY AI Logic
  const { navyAction, ghostPosition, blockToMove } = useMemo(() => {
    if (blocks.length === 0 || isBalanced || appState === 'EVALUATING' || appState === 'GAME_OVER') {
        return { navyAction: 'idle', ghostPosition: null, blockToMove: null };
    }

    const sum = blocks.reduce((acc, b) => acc + b.position, 0);
    const targetSum = fulcrumPosition * blocks.length;
    const diff = targetSum - sum; // How much we need to shift the sum

    // Can we move an existing block to balance it?
    let bestMove = null;
    for (const block of blocks) {
        const newPos = block.position + diff;
        if (newPos >= MIN_VAL && newPos <= MAX_VAL && Number.isInteger(newPos)) {
            bestMove = { blockId: block.id, newPos };
            break; // Found a valid move
        }
    }

    if (bestMove) {
        return { navyAction: 'crane', ghostPosition: bestMove.newPos, blockToMove: bestMove.blockId };
    } else {
        // If we can't move an existing block, maybe suggest adding one?
        const requiredPos = Math.round(fulcrumPosition * (blocks.length + 1) - sum);
        if (requiredPos >= MIN_VAL && requiredPos <= MAX_VAL) {
            return { navyAction: 'crane_add', ghostPosition: requiredPos, blockToMove: null };
        }
        return { navyAction: 'ballast', ghostPosition: null, blockToMove: null };
    }
  }, [blocks, fulcrumPosition, isBalanced, appState]);

  const getValueFromClientX = (clientX: number) => {
    if (!shipRef.current) return MIN_VAL;
    const rect = shipRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const rawRatio = relativeX / rect.width;
    const rawVal = MIN_VAL + (rawRatio * RANGE);
    return Math.max(MIN_VAL, Math.min(MAX_VAL, Math.round(rawVal)));
  };

  const handleBlockMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isDeleteMode) {
        if (onDeleteBlock) onDeleteBlock(id);
        return;
    }
    const block = blocks.find(b => b.id === id);
    if (block) {
        initialBlockPosRef.current = block.position;
        if (onBlockDragStart) onBlockDragStart(id, block.position);
    }
    setDraggingBlockId(id);
  };

  const handleFulcrumMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    initialFulcrumPosRef.current = fulcrumPosition;
    if (onFulcrumDragStart) onFulcrumDragStart(fulcrumPosition);
    setIsDraggingFulcrum(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBlockId && onBlockMove) {
        const newVal = getValueFromClientX(e.clientX);
        lastBlockPosRef.current = newVal;
        onBlockMove(draggingBlockId, newVal);
      }
      if (isDraggingFulcrum) {
         if (!shipRef.current) return;
         const rect = shipRef.current.getBoundingClientRect();
         const relativeX = e.clientX - rect.left;
         const rawRatio = relativeX / rect.width;
         const rawVal = MIN_VAL + (rawRatio * RANGE);
         const clamped = Math.max(MIN_VAL, Math.min(MAX_VAL, rawVal));
         // Snap to 0.5 increments
         const rounded = Math.round(clamped * 2) / 2;
         
         lastFulcrumPosRef.current = rounded;
         setFulcrumPosition(rounded);
      }
    };

    const handleMouseUp = () => {
      if (draggingBlockId && onBlockDragEnd && lastBlockPosRef.current !== null && initialBlockPosRef.current !== null) {
          onBlockDragEnd(draggingBlockId, initialBlockPosRef.current, lastBlockPosRef.current);
      }
      if (isDraggingFulcrum && onFulcrumDragEnd && lastFulcrumPosRef.current !== null && initialFulcrumPosRef.current !== null) {
          onFulcrumDragEnd(initialFulcrumPosRef.current, lastFulcrumPosRef.current);
      }
      setDraggingBlockId(null);
      setIsDraggingFulcrum(false);
      lastBlockPosRef.current = null;
      lastFulcrumPosRef.current = null;
      initialBlockPosRef.current = null;
      initialFulcrumPosRef.current = null;
    };

    if (draggingBlockId || isDraggingFulcrum) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBlockId, isDraggingFulcrum, onBlockMove, setFulcrumPosition, onBlockDragEnd, onFulcrumDragEnd]);

  // Calculate ballast water percentage
  const totalWeight = leftWeight + rightWeight || 1;
  const leftBallastPct = (leftWeight / totalWeight) * 100;
  const rightBallastPct = (rightWeight / totalWeight) * 100;

  return (
    <div className={`relative w-full h-full flex flex-col justify-end items-center select-none overflow-hidden bg-sky-100 ${isDeleteMode ? 'cursor-context-menu' : ''}`}>
      
      {/* Ocean Background & Waves */}
      <div className="absolute bottom-0 w-full h-48 bg-blue-500/20 z-0">
        <motion.div 
          animate={{ x: [-100, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute top-0 left-0 w-[200%] h-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTAgMTBRMTIuNSAwIDI1IDEwVDUwIDEwVjIwSDBaIiBmaWxsPSJyZ2JhKDU5LCAxMzAsIDI0NiwgMC40KSIvPjwvc3ZnPg==')] bg-repeat-x"
        />
        <motion.div 
          animate={{ x: [0, -100] }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className="absolute top-4 left-0 w-[200%] h-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSIyMCI+PHBhdGggZD0iTTAgMTBRMTIuNSAwIDI1IDEwVDUwIDEwVjIwSDBaIiBmaWxsPSJyZ2JhKDU5LCAxMzAsIDI0NiwgMC42KSIvPjwvc3ZnPg==')] bg-repeat-x"
        />
      </div>

      {/* Main Interaction Area */}
      <div className="absolute inset-x-0 bottom-24 top-10 flex items-center justify-center z-10">
          <div className="w-full max-w-4xl h-80 relative mx-12">
             
             {/* Visual Feedback Layer */}
             {(appState === 'EVALUATING' || appState === 'GAME_OVER') && direction !== 'balanced' && direction !== 'none' && (
                 <div className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-500">
                     {direction === 'left-heavy' && (
                         <div className="absolute left-[10%] top-0 animate-bounce text-center">
                             <span className="text-5xl font-bold text-red-500 drop-shadow-sm">⚠️</span>
                             <div className="bg-red-100 text-red-600 font-bold px-3 py-1 rounded-full text-sm mt-2 shadow-sm border border-red-200">침수 위험!</div>
                         </div>
                     )}
                     {direction === 'right-heavy' && (
                         <div className="absolute right-[10%] top-0 animate-bounce text-center">
                             <span className="text-5xl font-bold text-red-500 drop-shadow-sm">⚠️</span>
                             <div className="bg-red-100 text-red-600 font-bold px-3 py-1 rounded-full text-sm mt-2 shadow-sm border border-red-200">침수 위험!</div>
                         </div>
                     )}
                     
                     {/* Splash Effect */}
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.5, y: 50 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2], y: [50, 0, -50] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className={`absolute bottom-[-20px] text-6xl ${direction === 'left-heavy' ? 'left-[5%]' : 'right-[5%]'}`}
                     >
                        💦
                     </motion.div>
                 </div>
             )}
             
             {(appState === 'EVALUATING' || appState === 'LEVEL_CLEAR') && direction === 'balanced' && (
                 <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center z-30 animate-bounce-short">
                      <span className="text-6xl">⚓</span>
                      <div className="bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-full text-lg mt-2 shadow-sm border border-emerald-200">안전 운항!</div>
                 </div>
             )}

             {/* The Cargo Ship (Rotation Wrapper) */}
             <motion.div 
                animate={{ 
                  rotate: angle,
                  y: sinkDepth
                }}
                transition={{ type: "spring", stiffness: 50, damping: 10 }}
                className="w-full h-full absolute top-0 left-0"
                style={{ 
                    transformOrigin: `${((fulcrumPosition - MIN_VAL) / RANGE) * 100}% 80%`, 
                }}
             >
                {/* Ship Hull (with overflow-hidden for rounded corners and water) */}
                <div 
                    ref={shipRef}
                    className="absolute left-0 w-full h-24 bg-slate-700 rounded-b-[4rem] shadow-2xl border-b-8 border-slate-900 flex flex-col justify-end overflow-hidden"
                    style={{ top: '60%' }}
                >
                    {/* Waterline indicator */}
                    <div className="absolute top-2 left-0 w-full h-1 bg-red-500/50 border-y border-red-600/50 border-dashed"></div>

                    {/* Ballast Tanks (Visualizing Deviation) */}
                    <div className="w-full h-8 flex border-t-4 border-slate-800 bg-slate-800/50">
                        <div className="flex-1 border-r-2 border-slate-900 relative overflow-hidden">
                            <motion.div 
                                className="absolute bottom-0 left-0 w-full bg-blue-400/80"
                                animate={{ height: `${(appState === 'EVALUATING' || appState === 'GAME_OVER') ? leftBallastPct : 50}%` }}
                                transition={{ duration: 1 }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-white/50 text-xs font-bold">좌현 평형수</span>
                        </div>
                        <div className="flex-1 border-l-2 border-slate-900 relative overflow-hidden">
                            <motion.div 
                                className="absolute bottom-0 left-0 w-full bg-blue-400/80"
                                animate={{ height: `${(appState === 'EVALUATING' || appState === 'GAME_OVER') ? rightBallastPct : 50}%` }}
                                transition={{ duration: 1 }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-white/50 text-xs font-bold">우현 평형수</span>
                        </div>
                    </div>
                </div>

                {/* Ship Deck (Visible Overflow for Blocks) */}
                <div className="absolute left-0 w-full h-24 pointer-events-none" style={{ top: '60%' }}>
                    {/* Numbers/Ticks - Range 1 to 10 */}
                    <div className="absolute top-0 left-0 w-full h-4">
                        {Array.from({ length: MAX_VAL - MIN_VAL + 1 }).map((_, i) => {
                            const val = MIN_VAL + i;
                            const leftPerc = (i / RANGE) * 100;
                            return (
                                <div 
                                    key={val} 
                                    className="absolute top-0 w-0.5 h-full bg-white/20 transform -translate-x-1/2 pointer-events-none"
                                    style={{ left: `${leftPerc}%` }}
                                >
                                    <span className="absolute top-4 left-1/2 -translate-x-1/2 text-sm font-bold text-white/60 font-korean">
                                        {val}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Blocks Container */}
                    <div className="absolute inset-0 pointer-events-auto">
                        {/* Containers (Blocks) */}
                        {blocks.map((block, idx) => {
                             const stackIdx = blocks.filter((b, i) => b.position === block.position && i < idx).length;
                             return (
                                <BlockComponent 
                                    key={block.id} 
                                    block={block} 
                                    index={stackIdx} 
                                    onMouseDown={handleBlockMouseDown}
                                    isDragging={draggingBlockId === block.id}
                                    isDeleteMode={isDeleteMode}
                                    isSuggestedMove={false}
                                    isDraggable={false}
                                />
                             )
                        })}
                    </div>

                    {/* Distance Indicators (Hint Mode) - Curved SVG */}
                    {isHintActive && (
                        <div className="absolute left-0 w-full pointer-events-none z-50" style={{ bottom: 0, height: '400px' }}>
                            <svg viewBox="0 0 1000 400" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                {blocks
                                    .map((block, idx) => {
                                        const distance = Math.abs(block.position - fulcrumPosition);
                                        const stackIdx = blocks.filter((b, i) => b.position === block.position && i < idx).length;
                                        return { block, distance, stackIdx, originalIdx: idx };
                                    })
                                    .filter(item => item.distance > 0)
                                    .sort((a, b) => a.distance - b.distance)
                                    .map((item, sortIdx) => {
                                        const { block, stackIdx } = item;
                                        
                                        const startX = ((block.position - MIN_VAL) / RANGE) * 1000;
                                        const startY = 400 - (32 + stackIdx * 32 + 16);
                                        const endX = ((fulcrumPosition - MIN_VAL) / RANGE) * 1000;
                                        const endY = 400;
                                        
                                        const controlX = (startX + endX) / 2;
                                        const controlY = Math.min(startY, endY) - 60 - (sortIdx * 40);
                                        
                                        return (
                                            <g key={`curve-${block.id}`}>
                                                <path 
                                                    d={`M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`} 
                                                    fill="none" 
                                                    stroke="#818cf8" 
                                                    strokeWidth="3" 
                                                    strokeDasharray="6,6" 
                                                    vectorEffect="non-scaling-stroke" 
                                                    className="drop-shadow-md"
                                                />
                                                <circle cx={startX} cy={startY} r="5" fill="#818cf8" vectorEffect="non-scaling-stroke" className="drop-shadow-md" />
                                                <circle cx={endX} cy={endY} r="5" fill="#818cf8" vectorEffect="non-scaling-stroke" className="drop-shadow-md" />
                                            </g>
                                        );
                                    })}
                            </svg>
                            
                            {/* HTML Labels for Curves */}
                            {blocks
                                .map((block, idx) => {
                                    const distance = Math.abs(block.position - fulcrumPosition);
                                    const stackIdx = blocks.filter((b, i) => b.position === block.position && i < idx).length;
                                    return { block, distance, stackIdx, originalIdx: idx };
                                })
                                .filter(item => item.distance > 0)
                                .sort((a, b) => a.distance - b.distance)
                                .map((item, sortIdx) => {
                                    const { block, distance, stackIdx } = item;
                                    
                                    const startX = ((block.position - MIN_VAL) / RANGE) * 1000;
                                    const startY = 400 - (32 + stackIdx * 32 + 16);
                                    const endX = ((fulcrumPosition - MIN_VAL) / RANGE) * 1000;
                                    const endY = 400;
                                    
                                    const controlX = (startX + endX) / 2;
                                    const controlY = Math.min(startY, endY) - 60 - (sortIdx * 40);
                                    
                                    // Calculate exact midpoint of quadratic bezier curve
                                    const midY = 0.25 * startY + 0.5 * controlY + 0.25 * endY;
                                    
                                    const leftPerc = (controlX / 1000) * 100;
                                    const bottomPx = 400 - midY;
                                    
                                    return (
                                        <div key={`label-${block.id}`} 
                                             className="absolute -translate-x-1/2 translate-y-1/2 text-xs font-bold text-indigo-800 bg-white/90 px-2.5 py-1 rounded-full shadow-md border-2 border-indigo-300 whitespace-nowrap z-50"
                                             style={{ left: `${leftPerc}%`, bottom: `${bottomPx}px` }}>
                                            거리: {distance % 1 === 0 ? distance : distance.toFixed(1)}
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* Golden Anchor (Average Indicator) - Shown only on LEVEL_CLEAR */}
                    {appState === 'LEVEL_CLEAR' && blocks.length > 0 && (
                        <motion.div 
                            className="absolute top-0 w-1 h-32 bg-yellow-500/80 origin-top z-0 flex flex-col items-center pointer-events-none"
                            style={{ left: `${((average - MIN_VAL) / RANGE) * 100}%` }}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 120, opacity: 1 }}
                        >
                            <div className="absolute bottom-[-16px] text-yellow-500 drop-shadow-md">
                                <Anchor size={32} />
                            </div>
                        </motion.div>
                    )}

                    {/* Status Messages Above Ship */}
                    <AnimatePresence>
                        {appState === 'LEVEL_CLEAR' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
                                style={{ bottom: '100%', marginBottom: '4rem' }}
                            >
                                <div className="bg-white/95 backdrop-blur px-8 py-4 rounded-2xl shadow-xl border-2 border-green-400 text-center">
                                    <h2 className="text-3xl font-black text-green-600 mb-1 font-korean">안전 운항!</h2>
                                    <p className="text-green-800 font-bold">정확한 무게 중심을 찾았습니다.</p>
                                </div>
                            </motion.div>
                        )}
                        {appState === 'GAME_OVER' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
                                style={{ bottom: '100%', marginBottom: '4rem' }}
                            >
                                <div className="bg-white/95 backdrop-blur px-8 py-4 rounded-2xl shadow-xl border-2 border-red-400 text-center">
                                    <h2 className="text-3xl font-black text-red-600 mb-1 font-korean">균형 상실!</h2>
                                    <p className="text-red-800 font-bold">화물이 한쪽으로 쏠렸습니다.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
             </motion.div>

             {/* The Buoyancy Center (Fulcrum - Draggable) */}
             <div 
                onMouseDown={handleFulcrumMouseDown}
                className={`absolute transform -translate-x-1/2 z-40 transition-colors duration-200 cursor-ew-resize
                    ${isDraggingFulcrum ? 'scale-110' : 'hover:scale-105'}
                `}
                style={{ 
                    left: `${((fulcrumPosition - MIN_VAL) / RANGE) * 100}%`,
                    top: '60%',
                    marginTop: '96px', // Ship height is 24 (96px)
                    transition: isDraggingFulcrum ? 'none' : 'left 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                }}
             >
                 {/* Buoyancy Shape */}
                <div className="w-16 h-12 bg-sky-400 rounded-t-full border-4 border-sky-500 flex items-center justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute bottom-0 w-full h-1/2 bg-sky-500/50"></div>
                </div>
                
                {/* Fulcrum Label */}
                 <div 
                    className="absolute top-[55px] left-1/2 -translate-x-1/2 bg-sky-100 text-sky-800 px-3 py-1 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap pointer-events-none border border-sky-200"
                 >
                    부력 중심: {fulcrumPosition}
                 </div>
             </div>
             
          </div>
       </div>

    </div>
  );
};