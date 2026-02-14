declare module 'pdf-parse' {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: any;
    version: string;
    text: string;
  }

  interface PDFParseOptions {
    pagerender?: (pageData: any) => Promise<string>;
    max?: number;
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;
  export = pdfParse;
}