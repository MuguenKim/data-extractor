import fetch from 'node-fetch';

export type ClientOptions = { baseUrl: string; apiKey?: string };

export class ExtractorClient {
  constructor(private opts: ClientOptions) {}

  private headers() {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.apiKey) h['authorization'] = `Bearer ${this.opts.apiKey}`;
    return h;
  }

  async health() {
    const r = await fetch(`${this.opts.baseUrl}/health`);
    return r.json();
  }

  async createOrUpdateWorkflow(body: any) {
    const r = await fetch(`${this.opts.baseUrl}/workflows`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  }

  async inferSchema(body: any) {
    const r = await fetch(`${this.opts.baseUrl}/infer_schema`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  }

  async extract(params: Record<string, string>, body: any) {
    const q = new URLSearchParams(params).toString();
    const r = await fetch(`${this.opts.baseUrl}/extract?${q}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  }

  async job(id: string) {
    const r = await fetch(`${this.opts.baseUrl}/jobs/${id}`);
    return r.json();
  }

  async validate(body: any) {
    const r = await fetch(`${this.opts.baseUrl}/validate`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return r.json();
  }
}

