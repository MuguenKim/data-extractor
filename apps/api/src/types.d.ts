declare module 'express';
declare module 'cors';
declare module 'helmet';
declare module 'morgan';
declare module 'uuid';

// Temporary shim to satisfy TS until @core declarations are complete
declare module '@core' {
  export const invoiceSchemaV1: any;
  export function extract_with_langextract(args: any): Promise<any>;
  export type WorkflowConfig = any;
  export type WorkflowSchema = any;
  export type ResultEnvelope = any;
  export function ingestBufferAsync(buf: Buffer, opts?: any): Promise<any>;
  export function ingestBuffer(buf: Buffer, opts?: any): any;
  export function ingestFromText(text: string, opts?: any): any;
  export function ingestHTMLString(html: string, opts?: any): any;
  export function getLogger(service?: string, opts?: any): any;
  export function evaluateRules(data: any, rules: any[]): any;
}
