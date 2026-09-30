import React from 'react';
import { Block } from '../types';
import { X } from 'lucide-react';

interface BlockComponentProps {
  block: Block;
  index: number; // Stacking order
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  isDragging?: boolean;
  isDeleteMode?: boolean;
  isSuggestedMove?: boolean;
  isDraggable?: boolean;
}

export const BlockComponent: React.FC<BlockComponentProps> = ({ 
  block, 
  index, 
  onMouseDown, 
  isDragging, 
  isDeleteMode,
  isSuggestedMove,
  isDraggable = true
}) => {
  // Range 1 to 10
  const leftPercent = ((block.position - 1) / 9) * 100;
  
  // Stacking logic for containers
  // Base 32px (above the ballast tanks), step 32px (container height)
  const bottomPos = 32 + (index * 32);

  return (
    <div 
      onMouseDown={(e) => isDraggable ? onMouseDown(e, block.id) : undefined}
      className={`absolute w-12 h-8 border-2 border-white/20 shadow-md transition-all z-10 flex items-center justify-center overflow-hidden
        ${block.color} 
        ${block.isNew ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-white z-20' : ''}
        ${isDragging ? 'scale-125 ring-4 ring-white/50 z-50 shadow-2xl' : ''}
        ${isSuggestedMove && !isDragging ? 'ring-4 ring-blue-400 animate-pulse' : ''}
        ${isDeleteMode 
            ? 'cursor-pointer hover:scale-110 hover:ring-2 hover:ring-red-400 hover:bg-red-500 animate-pulse-slow' 
            : isDraggable
                ? 'cursor-grab active:cursor-grabbing hover:scale-110 hover:brightness-110' 
                : block.isNew 
                    ? 'cursor-default transition-transform' 
                    : 'cursor-default opacity-80 saturate-50 brightness-75'}
      `}
      style={{
        left: `calc(${leftPercent}% - 24px)`, // Center the 48px width block
        bottom: `${bottomPos}px`, // Stack upwards
        transition: isDragging ? 'none' : 'bottom 0.3s ease-out, left 0.3s ease-out',
        zIndex: 10 + index, // Ensure higher blocks are on top
      }}
    >
      {/* Corrugated metal texture lines */}
      <div className="absolute inset-0 flex justify-evenly opacity-30 pointer-events-none">
        <div className="w-px h-full bg-black"></div>
        <div className="w-px h-full bg-black"></div>
        <div className="w-px h-full bg-black"></div>
        <div className="w-px h-full bg-black"></div>
        <div className="w-px h-full bg-black"></div>
      </div>
      
      {/* Container ID/Label */}
      <div className="text-[10px] font-bold text-white/80 pointer-events-none bg-black/20 px-1 rounded z-10">
        {block.weight}t
      </div>

      {/* Delete Icon Overlay */}
      {isDeleteMode && (
          <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center z-20">
            <X size={16} className="text-white drop-shadow-md" strokeWidth={3} />
          </div>
      )}
    </div>
  );
};