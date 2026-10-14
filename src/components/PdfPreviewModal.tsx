import React from 'react';
import { X, Download, ShieldCheck, ExternalLink } from 'lucide-react';
import { ConvertedFile } from '../utils/pdfaConverter';

interface PdfPreviewModalProps {
  file: ConvertedFile | null;
  onClose: () => void;
  onDownload: (file: ConvertedFile) => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ file, onClose, onDownload }) => {
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#0c0c10] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-[#121217]">
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800/60 shrink-0">
              {file.complianceLevel}
            </span>
            <div className="truncate">
              <h3 className="text-white font-medium text-sm truncate">{file.name}</h3>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Metadados ISO 19005 & Perfil de Cor sRGB incorporados
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onDownload(file)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar</span>
            </button>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 bg-neutral-950 relative">
          <iframe
            src={`${file.url}#toolbar=1&navpanes=0`}
            title={`Pré-visualização de ${file.name}`}
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </div>
  );
};
