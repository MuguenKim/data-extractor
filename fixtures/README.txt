This folder contains sample documents for dev tests.

Included:
- invoice.txt — plain text invoice for baseline regex tests
- invoice.csv — CSV of line items for table parsing
- invoice.html — HTML invoice for Readability extractor
- invoice1.png, invoice2.png — scanned invoice images for OCR trials
- invoice3.pdf, invoice4.pdf — PDF invoices for OCR + layout parsing

How to use (end-to-end):
- Upload via UI `/projects/[id]/ingest` or `POST /projects/:id/files`.
- Choose a schema on `/projects/[id]/format` (or click Infer Format).
- Run extraction on `/projects/[id]/extract` for project-wide results.
- Inspect per-file details at `/projects/[id]/results/[fileId]`.

Notes:
- Images/PDFs rely on OCR. In dev-min setups, OCR may be limited; set OCR policy in Settings to exercise the pipeline.
- PII is not masked in this project. Use only non-sensitive samples.

