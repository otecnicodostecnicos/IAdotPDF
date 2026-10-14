import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Play,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Eye,
  Archive,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Check,
  FolderOpen
} from 'lucide-react';
import JSZip from 'jszip';
import { TitleBar } from './components/TitleBar';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { convertFileToPdfa, ConvertedFile } from './utils/pdfaConverter';

interface QueuedItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  stageText: string;
  error?: string;
  convertedData?: {
    bytes: Uint8Array;
    blob: Blob;
    url: string;
    filename: string;
  };
}

export default function App() {
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>('Aguardando seleção de arquivos...');
  const [pdfaStandard, setPdfaStandard] = useState<'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b'>('PDF/A-1b');
  const [autoStart, setAutoStart] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<ConvertedFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format bytes
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Add files to queue
  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: QueuedItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',
      progress: 0,
      stageText: 'Pronto para converter',
    }));

    setQueue((prev) => [...prev, ...newItems]);
    setCurrentStage(`${newItems.length} arquivo(s) adicionado(s) à fila. Clique em Iniciar.`);
  };

  // Auto-start trigger if enabled
  useEffect(() => {
    if (autoStart && !isProcessing && queue.some((item) => item.status === 'pending')) {
      startConversion();
    }
  }, [queue, autoStart, isProcessing]);

  // Main Conversion Orchestrator
  const startConversion = async () => {
    const pendingItems = queue.filter((i) => i.status === 'pending');
    if (pendingItems.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setTotalProgress(0);

    const totalCount = queue.length;

    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      if (item.status === 'completed') continue;

      // Update item to processing
      setQueue((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'processing', progress: 5, stageText: 'Iniciando análise...' }
            : it
        )
      );

      setCurrentStage(`Convertendo "${item.name}" para ${pdfaStandard}...`);

      try {
        const { bytes, filename } = await convertFileToPdfa(
          item.file,
          pdfaStandard,
          (itemProgress, stage) => {
            // Update individual item progress
            setQueue((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, progress: itemProgress, stageText: stage }
                  : it
              )
            );
            // Calculate overall progress
            const overall = Math.round(
              ((index + itemProgress / 100) / totalCount) * 100
            );
            setTotalProgress(Math.min(overall, 99));
            setCurrentStage(`${stage} (${index + 1}/${totalCount})`);
          }
        );

        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'completed',
                  progress: 100,
                  stageText: 'Concluído (Conforme ISO 19005)',
                  convertedData: {
                    bytes,
                    blob,
                    url,
                    filename,
                  },
                }
              : it
          )
        );
      } catch (err: any) {
        console.error(err);
        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'error',
                  progress: 0,
                  stageText: 'Erro na conversão',
                  error: err?.message || 'Falha ao processar arquivo.',
                }
              : it
          )
        );
      }
    }

    setTotalProgress(100);
    setCurrentStage('Todas as conversões foram finalizadas!');
    setIsProcessing(false);
  };

  // Download individual file
  const handleDownloadSingle = (item: QueuedItem) => {
    if (!item.convertedData) return;
    const a = document.createElement('a');
    a.href = item.convertedData.url;
    a.download = item.convertedData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Batch download as ZIP
  const handleDownloadAllZip = async () => {
    const completedItems = queue.filter((i) => i.status === 'completed' && i.convertedData);
    if (completedItems.length === 0) return;

    const zip = new JSZip();
    completedItems.forEach((item) => {
      if (item.convertedData) {
        zip.file(item.convertedData.filename, item.convertedData.bytes);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IAdotPDF_Arquivos_PDFA_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open Preview
  const handleOpenPreview = (item: QueuedItem) => {
    if (!item.convertedData) return;
    setPreviewFile({
      id: item.id,
      name: item.convertedData.filename,
      originalSize: item.size,
      convertedSize: item.convertedData.bytes.length,
      type: 'application/pdf',
      blob: item.convertedData.blob,
      url: item.convertedData.url,
      status: 'completed',
      progress: 100,
      stageText: 'Pronto',
      complianceLevel: pdfaStandard,
    });
  };

  // Remove single item from queue
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => {
      const removed = prev.find((it) => it.id === id);
      if (removed?.convertedData?.url) {
        URL.revokeObjectURL(removed.convertedData.url);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  // Clear all
  const handleClearQueue = () => {
    queue.forEach((it) => {
      if (it.convertedData?.url) {
        URL.revokeObjectURL(it.convertedData.url);
      }
    });
    setQueue([]);
    setTotalProgress(0);
    setCurrentStage('Aguardando seleção de arquivos...');
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Desktop App TitleBar */}
      <TitleBar />

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
        
        {/* Banner / Header Title Area */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0c0c14] via-[#0f111a] to-[#0c0c14] border border-neutral-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-1.5 relative z-10">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-sm shadow-blue-500" />
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                IAdotPDF <span className="text-blue-500 text-lg font-mono">v1.0</span>
              </h2>
            </div>
            <p className="text-sm text-neutral-400 max-w-xl">
              Conversor ultrarrápido para o padrão <strong className="text-neutral-200">ISO 19005 (PDF/A)</strong> de preservação digital de documentos a longo prazo.
            </p>
          </div>

          {/* Quick Stats or Conformance Selector */}
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <div className="bg-[#14141c] border border-neutral-800 rounded-lg p-2.5 flex items-center space-x-3 text-xs">
              <SlidersHorizontal className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Padrão Arquivístico</div>
                <select
                  value={pdfaStandard}
                  onChange={(e) => setPdfaStandard(e.target.value as any)}
                  disabled={isProcessing}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-2"
                >
                  <option value="PDF/A-1b" className="bg-[#14141c] text-white">PDF/A-1b (ISO 19005-1 Padrão)</option>
                  <option value="PDF/A-2b" className="bg-[#14141c] text-white">PDF/A-2b (ISO 19005-2 Moderno)</option>
                  <option value="PDF/A-3b" className="bg-[#14141c] text-white">PDF/A-3b (ISO 19005-3 Anexos)</option>
                </select>
              </div>
            </div>

            <div className="bg-[#14141c] border border-neutral-800 rounded-lg p-2.5 flex items-center space-x-3 text-xs">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] text-neutral-400 uppercase font-semibold">Modo de Execução</div>
                <div className="text-emerald-400 font-medium">100% Local no PC</div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Drop Zone & Main Action Buttons */}
        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all flex flex-col items-center justify-center text-center ${
            isDragging
              ? 'border-blue-500 bg-blue-950/20 scale-[1.005]'
              : 'border-neutral-800/90 hover:border-blue-500/50 bg-[#0a0a0e]/90'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleAddFiles(e.target.files)}
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.log,.csv,.json,.md,.html"
          />

          <div className="w-16 h-16 rounded-2xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-950/50 mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
            Arraste seus arquivos aqui ou use o botão abaixo
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mb-6">
            Suporta <strong className="text-neutral-300">PDFs comuns</strong>, imagens (<strong className="text-neutral-300">PNG, JPG, WebP</strong>), e documentos de texto (<strong className="text-neutral-300">TXT, CSV, MD</strong>).
          </p>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            {/* Blue File Selector Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all cursor-pointer border border-blue-400/30"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Selecionar Arquivo</span>
            </button>

            {/* Blue Start Button */}
            <button
              type="button"
              onClick={startConversion}
              disabled={isProcessing || pendingCount === 0}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 font-semibold text-sm px-7 py-3 rounded-xl shadow-lg transition-all cursor-pointer ${
                isProcessing || pendingCount === 0
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
                  : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-600/40 border border-blue-400/40 hover:scale-[1.02]'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isProcessing ? 'Convertendo...' : 'Iniciar Conversão'}</span>
            </button>
          </div>

          {/* Quick options */}
          <div className="mt-4 flex items-center space-x-2 text-xs text-neutral-400">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
              />
              <span>Converter automaticamente assim que os arquivos forem selecionados</span>
            </label>
          </div>
        </section>

        {/* 4. Barra de Progresso em Destaque */}
        {(queue.length > 0 || isProcessing) && (
          <section className="bg-[#0e0e14] border border-neutral-800/90 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Progresso da Conversão
                </span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-300 font-mono text-[11px]">{currentStage}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-blue-400 text-sm">
                  {totalProgress}%
                </span>
              </div>
            </div>

            {/* Glowing Blue Progress Bar */}
            <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800 p-0.5 relative">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-sm shadow-blue-500 relative"
                style={{ width: `${totalProgress}%` }}
              >
                {/* Subtle animated shimmer */}
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {/* Status Footer */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
              <div className="flex items-center space-x-4">
                <span>Total: <strong className="text-neutral-200">{queue.length}</strong></span>
                <span>Pendentes: <strong className="text-amber-400">{pendingCount}</strong></span>
                <span>Convertidos: <strong className="text-emerald-400">{completedCount}</strong></span>
              </div>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-300 font-semibold cursor-pointer transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Baixar Todos Concluídos (.ZIP)</span>
                </button>
              )}
            </div>
          </section>
        )}

        {/* 5. Queued / Converted Files List */}
        {queue.length > 0 && (
          <section className="bg-[#0e0e14] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-[#12121a] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">Lista de Arquivos ({queue.length})</h3>
              </div>
              <div className="flex items-center space-x-3">
                {completedCount > 1 && (
                  <button
                    onClick={handleDownloadAllZip}
                    className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Todos (.ZIP)</span>
                  </button>
                )}
                <button
                  onClick={handleClearQueue}
                  disabled={isProcessing}
                  className="text-neutral-400 hover:text-red-400 text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                  title="Limpar todos os arquivos da lista"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Fila</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-neutral-800/60 max-h-[420px] overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-neutral-900/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* File Info */}
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-white font-medium truncate text-sm flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.status === 'completed' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                            {pdfaStandard}
                          </span>
                        )}
                      </div>
                      <div className="text-neutral-400 text-[11px] flex items-center space-x-2">
                        <span>Original: {formatSize(item.size)}</span>
                        {item.convertedData && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-300">
                              PDF/A: {formatSize(item.convertedData.bytes.length)}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-neutral-400 font-mono">{item.stageText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                    {/* Status Badge */}
                    {item.status === 'pending' && (
                      <span className="px-2 py-1 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 text-[11px]">
                        Na fila
                      </span>
                    )}

                    {item.status === 'processing' && (
                      <div className="flex items-center space-x-2 text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2.5 py-1 rounded">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span className="font-mono text-[11px]">{item.progress}%</span>
                      </div>
                    )}

                    {item.status === 'completed' && (
                      <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pronto</span>
                      </span>
                    )}

                    {item.status === 'error' && (
                      <span className="flex items-center space-x-1 text-rose-400 bg-rose-950/60 border border-rose-800/50 px-2 py-1 rounded text-[11px]" title={item.error}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Falhou</span>
                      </span>
                    )}

                    {/* Preview Button */}
                    {item.status === 'completed' && (
                      <button
                        onClick={() => handleOpenPreview(item)}
                        className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                        title="Visualizar PDF/A gerado"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}

                    {/* Blue Download Button */}
                    {item.status === 'completed' && (
                      <button
                        onClick={() => handleDownloadSingle(item)}
                        className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                        title="Baixar arquivo PDF/A"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>
                    )}

                    {/* Delete Item */}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={item.status === 'processing'}
                      className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800/60 rounded transition-colors cursor-pointer disabled:opacity-40"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. Information & ISO 19005 Guarantee Card */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-[#0b0b0f] border border-neutral-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Conformidade Arquivística</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Injeção estrita de dicionário XMP Schema, metadados <code className="text-neutral-300">pdfaid:conformance</code> e perfil de cor de saída sRGB IEC61966.
            </p>
          </div>

          <div className="bg-[#0b0b0f] border border-neutral-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs">
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>Processamento no Computador</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              O motor de conversão executa diretamente no processador da sua máquina sem enviar documentos confidenciais para servidores externos.
            </p>
          </div>

          <div className="bg-[#0b0b0f] border border-neutral-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Exportação em Lote & ZIP</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Converta múltiplos arquivos simultaneamente e baixe todos os documentos em PDF/A de uma só vez em um pacote compactado.
            </p>
          </div>
        </section>
      </main>

      {/* 7. Footer / Barra Final da Página com Direitos Autorais */}
      <footer className="w-full bg-[#08080a] border-t border-neutral-800/90 py-4 px-6 text-xs text-neutral-400">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          {/* Brand & ISO */}
          <div className="flex items-center space-x-2 text-neutral-300">
            <span className="font-bold text-white tracking-wide">IAdotPDF</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">Motor Arquivístico ISO 19005 (PDF/A)</span>
          </div>

          {/* Direitos Autorais & Créditos Solicitados */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11px]">
            <span className="text-neutral-500">
              © {new Date().getFullYear()} Todos os direitos reservados.
            </span>
            <div className="flex items-center space-x-1.5 bg-[#12121a] px-2.5 py-1 rounded-md border border-neutral-800">
              <span className="text-neutral-400">Desenvolvimento:</span>
              <strong className="text-blue-400 font-semibold">AI Studio</strong>
            </div>
            <div className="flex items-center space-x-1.5 bg-[#12121a] px-2.5 py-1 rounded-md border border-neutral-800">
              <span className="text-neutral-400">Idealização:</span>
              <strong className="text-neutral-200 font-semibold">Zebra Technologies</strong>
            </div>
          </div>
        </div>
      </footer>

      {/* 8. Modals */}
      <PdfPreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={(file) => {
          const a = document.createElement('a');
          a.href = file.url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
      />
    </div>
  );
}
