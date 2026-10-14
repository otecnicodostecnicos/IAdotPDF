import React from 'react';
import { ShieldCheck, Minus, Square, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  return (
    <header className="w-full bg-[#0a0a0d] border-b border-neutral-800/80 px-4 py-2.5 flex items-center justify-between select-none">
      {/* Left: Brand name & Badge */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shadow-md shadow-blue-600/30 text-white font-bold text-sm tracking-wider">
          IA
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-white font-bold text-lg tracking-tight font-sans">
              IAdotPDF
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-blue-950 text-blue-400 border border-blue-800/60">
              DESKTOP PC
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> ISO 19005 (PDF/A)
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 hidden sm:block">
            Conversor Arquivístico de Alta Fidelidade • 100% Offline e Seguro no PC
          </p>
        </div>
      </div>

      {/* Center/Right actions */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Desktop window simulated controls */}
        <div className="flex items-center space-x-1 pl-2 text-neutral-400">
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center hover:bg-neutral-800 hover:text-white rounded transition-colors text-xs"
            title="Minimizar janela"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center hover:bg-neutral-800 hover:text-white rounded transition-colors text-xs"
            title="Maximizar janela"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center hover:bg-red-600 hover:text-white rounded transition-colors text-xs"
            title="Fechar aplicativo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
