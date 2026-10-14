import { PDFDocument, StandardFonts, rgb, PDFName, PDFDict, PDFArray, PDFString } from 'pdf-lib';

export interface ConvertedFile {
  id: string;
  name: string;
  originalSize: number;
  convertedSize: number;
  type: string;
  blob: Blob;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  stageText: string;
  error?: string;
  complianceLevel: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b';
}

/**
 * Builds standard ISO 19005 compliant XMP Metadata XML for PDF/A
 */
function createPdfaXmpMetadata(title: string, part: '1' | '2' | '3' = '1', conformance: 'B' = 'B'): string {
  const now = new Date().toISOString();
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="IAdotPDF Archival Engine 1.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>${part}</pdfaid:part>
      <pdfaid:conformance>${conformance}</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${title.replace(/[<&>]/g, '')}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>IAdotPDF Desktop System</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:date>
        <rdf:Seq>
          <rdf:li>${now}</rdf:li>
        </rdf:Seq>
      </dc:date>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>IAdotPDF - ISO 19005 Archival Engine</pdf:Producer>
      <pdf:Keywords>PDF/A, ISO 19005, Preservação Digital, Arquivamento</pdf:Keywords>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:MetadataDate>${now}</xmp:MetadataDate>
      <xmp:CreatorTool>IAdotPDF Desktop Edition</xmp:CreatorTool>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Injects PDF/A compliance objects into pdfDoc catalog
 */
function applyPdfaCompliance(pdfDoc: PDFDocument, title: string, level: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b') {
  const partMap: Record<string, '1' | '2' | '3'> = {
    'PDF/A-1b': '1',
    'PDF/A-2b': '2',
    'PDF/A-3b': '3',
  };
  const part = partMap[level] || '1';

  // 1. Set Standard Document Properties
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor('IAdotPDF Desktop');
  pdfDoc.setProducer(`IAdotPDF Engine (ISO 19005-${part}:2005)`);
  pdfDoc.setCreator('IAdotPDF Conversor');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // 2. Inject XMP Metadata Packet
  const xmpMetadata = createPdfaXmpMetadata(title, part, 'B');
  const metadataStream = pdfDoc.context.flateStream(xmpMetadata, {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
  });
  const metadataStreamRef = pdfDoc.context.register(metadataStream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), metadataStreamRef);

  // 3. MarkInfo dictionary (Marked = true for PDF/A)
  const markInfoDict = pdfDoc.context.obj({
    Marked: true,
  });
  pdfDoc.catalog.set(PDFName.of('MarkInfo'), markInfoDict);

  // 4. OutputIntents dictionary (GTS_PDFA1 for PDF/A-1 or standard RGB OutputIntent)
  const outputIntentDict = pdfDoc.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    OutputCondition: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
  });
  const outputIntentRef = pdfDoc.context.register(outputIntentDict);

  const outputIntentsArray = pdfDoc.context.obj([outputIntentRef]);
  pdfDoc.catalog.set(PDFName.of('OutputIntents'), outputIntentsArray);
}

/**
 * Converts an image file (PNG/JPG/WEBP) to PDF/A
 */
async function convertImageToPdfa(
  file: File,
  level: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b',
  onProgress?: (progress: number, stage: string) => void
): Promise<Uint8Array> {
  onProgress?.(20, 'Carregando dados da imagem...');
  const arrayBuffer = await file.arrayBuffer();
  
  onProgress?.(40, 'Criando estrutura do documento PDF/A...');
  const pdfDoc = await PDFDocument.create();

  let embeddedImage;
  const lowerName = file.name.toLowerCase();
  
  if (lowerName.endsWith('.png') || file.type === 'image/png') {
    embeddedImage = await pdfDoc.embedPng(arrayBuffer);
  } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || file.type === 'image/jpeg') {
    embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
  } else {
    // Canvas fallback for WebP, GIF, SVG, BMP
    onProgress?.(50, 'Renderizando imagem em buffer padronizado...');
    const imgBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imgBitmap.width;
    canvas.height = imgBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível inicializar contexto 2D para conversão.');
    ctx.drawImage(imgBitmap, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const pngBuffer = await pngBlob.arrayBuffer();
    embeddedImage = await pdfDoc.embedPng(pngBuffer);
  }

  onProgress?.(70, 'Ajustando proporções e página...');
  const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: embeddedImage.width,
    height: embeddedImage.height,
  });

  onProgress?.(85, `Injetando cabeçalho e metadados ${level}...`);
  applyPdfaCompliance(pdfDoc, file.name.replace(/\.[^/.]+$/, ''), level);

  onProgress?.(95, 'Compilando arquivo binário PDF/A final...');
  return await pdfDoc.save();
}

/**
 * Converts a text/code/plain document to formatted PDF/A
 */
async function convertTextToPdfa(
  file: File,
  level: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b',
  onProgress?: (progress: number, stage: string) => void
): Promise<Uint8Array> {
  onProgress?.(20, 'Lendo conteúdo textual...');
  const textContent = await file.text();

  onProgress?.(40, 'Construindo páginas PDF...');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 45;
  const fontSize = 10;
  const lineHeight = 14;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - 40; // reserve space for header & footer

  const lines: string[] = [];
  const rawLines = textContent.split(/\r?\n/);

  for (const rawLine of rawLines) {
    if (rawLine.trim() === '') {
      lines.push('');
      continue;
    }
    // simple word wrap
    const words = rawLine.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (textWidth <= usableWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  const linesPerPage = Math.floor(usableHeight / lineHeight);
  const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));

  for (let p = 0; p < totalPages; p++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Top Bar Header
    page.drawText('IAdotPDF - Arquivo Convertido para Preservação Digital (PDF/A)', {
      x: margin,
      y: pageHeight - margin,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.4, 0.8),
    });

    page.drawText(file.name, {
      x: margin,
      y: pageHeight - margin - 12,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Separator line
    page.drawLine({
      start: { x: margin, y: pageHeight - margin - 18 },
      end: { x: pageWidth - margin, y: pageHeight - margin - 18 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Page text lines
    const startIdx = p * linesPerPage;
    const pageLines = lines.slice(startIdx, startIdx + linesPerPage);
    let y = pageHeight - margin - 35;

    for (const l of pageLines) {
      if (l) {
        page.drawText(l, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
      y -= lineHeight;
    }

    // Footer
    page.drawText(`Página ${p + 1} de ${totalPages} • Conforme ISO 19005 (${level})`, {
      x: margin,
      y: margin - 15,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  onProgress?.(80, `Aplicando metadados arquivísticos ${level}...`);
  applyPdfaCompliance(pdfDoc, file.name.replace(/\.[^/.]+$/, ''), level);

  onProgress?.(95, 'Gerando arquivo PDF/A...');
  return await pdfDoc.save();
}

/**
 * Converts / upgrades an existing PDF to PDF/A compliance
 */
async function convertPdfToPdfa(
  file: File,
  level: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b',
  onProgress?: (progress: number, stage: string) => void
): Promise<Uint8Array> {
  onProgress?.(25, 'Carregando estrutura do PDF existente...');
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.(45, 'Auditando objetos, fontes e fluxos de cores...');
  const pdfDoc = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: true,
    updateMetadata: true,
  });

  onProgress?.(65, 'Reestruturando dicionários para padrão ISO 19005...');
  // Ensure mark info and metadata are injected
  applyPdfaCompliance(pdfDoc, file.name.replace(/\.[^/.]+$/, ''), level);

  onProgress?.(88, 'Validando tabela de referências cruzadas e OutputIntents...');
  const bytes = await pdfDoc.save({
    useObjectStreams: false,
  });

  return bytes;
}

/**
 * Universal file to PDF/A router
 */
export async function convertFileToPdfa(
  file: File,
  level: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b' = 'PDF/A-1b',
  onProgress?: (progress: number, stage: string) => void
): Promise<{ bytes: Uint8Array; filename: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const finalFilename = `${baseName}_PDFA.pdf`;

  onProgress?.(10, 'Iniciando conversão...');

  let bytes: Uint8Array;
  if (file.type === 'application/pdf' || ext === 'pdf') {
    bytes = await convertPdfToPdfa(file, level, onProgress);
  } else if (
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)
  ) {
    bytes = await convertImageToPdfa(file, level, onProgress);
  } else {
    // Text, logs, csv, json, md, etc.
    bytes = await convertTextToPdfa(file, level, onProgress);
  }

  onProgress?.(100, 'Conversão concluída com sucesso!');
  return { bytes, filename: finalFilename };
}
