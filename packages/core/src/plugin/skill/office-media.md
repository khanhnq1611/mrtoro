---
name: office-media
description: Extract and read uploaded files (images via OCR, PDFs, Office documents) from session storage, create and edit .docx/.xlsx/.pptx with officecli, and generate images (matplotlib charts, graphviz diagrams, HTML to PNG screenshots). Use when the user uploads or mentions images, screenshots, photos, PDF, Word, Excel, PowerPoint files, asks to read, extract, OCR, convert, fill templates, build decks/spreadsheets/reports, generate charts or diagrams, or when an image/PDF attachment cannot be viewed directly because the model lacks image/pdf input.
---

# office-media

Toolkit for documents and images on this machine. Covers three jobs:

1. **Extract** — read content from user-uploaded files (images, PDFs, Office files) that the model cannot view directly
2. **Office files** — create, inspect, and modify .docx/.xlsx/.pptx with `officecli`
3. **Generate images** — charts, diagrams, rendered HTML→PNG, and image manipulation

## Why

The active model may have **no image or pdf input** (`model.capabilities.input`). When the user attaches an image or PDF to a chat message, the provider transform replaces it with `ERROR: Cannot read "<filename>" (this model does not support ... input)`. **The original file is still stored in the session database** — recover it with the recipe below and process it locally. Never tell the user a file is unreadable before trying this skill.

## Tool inventory (installed on this machine)

| Tool | Path / install | Use |
|------|----------------|-----|
| `officecli` 1.0.160 | `~/.local/bin/officecli` (add `~/.local/bin` to PATH) | Office documents (.docx/.xlsx/.pptx) |
| `pdftotext`, `pdftoppm`, `pdfinfo` | poppler, system | PDF text + page rendering |
| `python3` + `rapidocr_onnxruntime` | pip --user | OCR (works on screenshots, photos, scanned pages) |
| `python3` + `matplotlib`, `PIL`, `openpyxl`, `python-docx`, `python-pptx`, `pypdf`, `fpdf2` | pip --user | charts, image ops, office fallbacks, PDF build/merge |
| `dot` | graphviz, system | diagrams |
| headless chromium | `~/.cache/ms-playwright/chromium_headless_shell-1217/chrome-linux/headless_shell` | HTML → PNG screenshots |

## 1. Recover an uploaded attachment (data URL → file)

Attachments sent from the web app are stored as parts with data URLs in the agent SQLite DB. The DB lives under the agent's data dir, e.g. `~/.local/share/<app>/agent/mrtoro/mrtoro.db` (glob `~/.local/share/*/agent/mrtoro/mrtoro.db` if unsure; older sessions may be in `mrtoro-local.db`).

```bash
DB=~/.local/share/<app>/agent/mrtoro/mrtoro.db   # pick the one matching your session
SID=<current session id>                         # visible in the web UI URL: .../session/ses_xxx

# list file attachments of the session (type, mime, filename, size)
sqlite3 "$DB" "SELECT json_extract(data,'$.type'), json_extract(data,'$.mime'),
  json_extract(data,'$.filename'), length(data) FROM part
  WHERE session_id='$SID' AND json_extract(data,'$.type')='file'"

# decode one to disk (strip the data:...;base64, prefix, then base64 -d)
sqlite3 "$DB" "SELECT json_extract(data,'$.url') FROM part
  WHERE session_id='$SID' AND json_extract(data,'$.filename')='<name>'" \
  | sed 's|^data:[^;]*;base64,||' | base64 -d > "<name>"
```

Verify with `file <name>` before further processing. If the user references a file by path (e.g. `@path` or a local file), skip this step — the path is directly readable.

## 2. Extract content

### Image → text (OCR)

```bash
python3 - <<'EOF'
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
result, _ = ocr("<image.png>")          # accepts png/jpg/webp/bmp
for line in result or []:
    print(line[1])                       # text, in reading order-ish
EOF
```

Good with UI screenshots, documents, signs. Handwriting is unreliable. For photos of scenes (no text), say so — OCR cannot describe visuals.

### PDF → text

```bash
pdftotext -layout file.pdf -        # text layer (fast, try FIRST)
pdfinfo file.pdf                    # page count, metadata
```

If `pdftotext` output is empty or garbage, the PDF is scanned → render pages then OCR:

```bash
pdftoppm -png -r 150 file.pdf page          # page-1.png, page-2.png, ...
for p in page-*.png; do
  echo "== $p"; python3 -c "from rapidocr_onnxruntime import RapidOCR; r,_=RapidOCR()('$p'); print('\n'.join(l[1] for l in r or []))"
done
```

For many pages, OCR a sample first (e.g. 3 pages) to confirm it's worth processing.

### Office files → text / structure

```bash
officecli view report.docx text          # plain text
officecli view deck.pptx outline         # structure
officecli view data.xlsx stats           # dimensions
officecli get report.docx /body --depth 2 --json
```

Python fallbacks when officecli is unavailable:

```bash
python3 -c "import docx; print('\n'.join(p.text for p in docx.Document('t.docx').paragraphs))"
python3 -c "import openpyxl,sys; ws=openpyxl.load_workbook('t.xlsx').active; print('\n'.join(','.join(str(c.value) for c in r) for r in ws.iter_rows(values_only=True)))"
python3 -c "from pptx import Presentation; [print(s.shapes.title.text if s.shapes.title else '', *[(sh.text) for sh in s.shapes if sh.has_text_frame], sep='\n') for s in Presentation('t.pptx').slides]"
```

## 3. Office files with officecli

**Strategy: L1 (read) → L2 (DOM edit) → L3 (raw XML). Always prefer higher layers. Add `--json` for structured output.**

**When unsure about property names, value formats, or syntax, ALWAYS run help instead of guessing** — one help query beats guess-fail-retry loops:

```bash
officecli help                          # all commands + global options
officecli help docx paragraph           # full schema for an element
officecli help xlsx chart               # chart properties
officecli help pptx shape
```

### Quick start

```bash
# Word
officecli create report.docx
officecli add report.docx /body --type paragraph --prop text="Executive Summary" --prop style=Heading1
officecli add report.docx /body --type paragraph --prop text="Revenue up 25% YoY."

# Excel
officecli set data.xlsx /Sheet1/A1 --prop value="Name" --prop bold=true

# PowerPoint
officecli add deck.pptx / --type slide --prop title="Q4 Report"
officecli add deck.pptx '/slide[1]' --type shape --prop text="Key result" --prop x=2cm --prop y=5cm --prop size=24
```

### Core commands

```bash
officecli view <file> outline|stats|issues|text|html|screenshot   # inspect
officecli get <file> '/body/p[3]' --depth 2 --json                # read a node
officecli query <file> 'shape[fill=FF0000]'                       # CSS-like search
officecli set <file> <path> --prop key=value                      # modify
officecli set <file> / --find draft --replace final               # whole-doc replace
officecli add <file> <parent> --type table --prop rows=2 --prop cols=2
officecli remove|move|swap <file> <path> ...
officecli batch data.xlsx --input ops.json --json                 # multi-op, atomic
officecli raw <file> /document                                    # L3 raw XML
officecli validate <file>                                         # check after edits
```

Paths are **1-based** XPath-style (`/body/p[3]`); quote them in the shell (brackets glob). Prefer stable IDs (`shape[@id=N]`, `p[@paraId=X]`) over positional indices for multi-step edits.

### Find & replace / template fill

```bash
officecli set template.docx / --find '{{customer}}' --replace "Acme Inc." --json
```

`--find` matches across run boundaries; no match returns `"matched": 0` — do NOT retry the same pair, report it. Tracked changes: `--prop revision.author=...` on docx replace.

### Charts, images, diagrams inside documents

```bash
officecli add data.xlsx /Sheet1 --type chart --prop type=bar --prop ...   # see: officecli help xlsx chart
officecli add deck.pptx '/slide[1]' --type picture --prop src=chart.png
officecli add report.docx /body --type diagram --prop spec='graph TD; A-->B'  # mermaid
```

### Performance & correctness

- Long edit sessions: `officecli open <file>` … `officecli close <file>` (resident mode; flush before any non-officecli program reads the file).
- After modifications: `officecli validate <file>` and/or `officecli view <file> issues`.
- Specialized document types (pitch decks, financial models, dashboards, academic papers): `officecli load_skill <name>` prints extra rules — load the most specific match, one per artifact.

### Pitfalls

| Pitfall | Fix |
|---------|-----|
| Guessing property names | `officecli help <fmt> <element>` |
| Unquoted `/p[3]` paths | Always quote — shells glob brackets |
| `shape[1]` in PPT is the title | Content shapes start at `shape[2]+` |
| `$` or `\n` inside `--prop text` | Use single quotes; `\\n` for newline |
| File open in PowerPoint/WPS | Close it first |
| Add-on missing | Check `officecli --version`; install: `curl -fsSL https://d.officecli.ai/install.sh \| bash` |

## 4. Generate images

### Charts (matplotlib)

```bash
python3 - <<'EOF'
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(6, 3.5), dpi=150)
ax.bar(["Q1", "Q2", "Q3", "Q4"], [111, 222, 333, 444], color="#4472C4")
ax.set_title("Doanh thu theo quý")     # Vietnamese renders fine
fig.tight_layout()
fig.savefig("chart.png")
EOF
```

### Diagrams (graphviz)

```bash
dot -Tpng flow.dot -o flow.png        # echo 'digraph{a->b}' > flow.dot
```

For mermaid, prefer embedding directly into pptx/docx via `officecli add --type diagram`.

### HTML → PNG (rich layouts, tables, styled cards)

```bash
CHROME=~/.cache/ms-playwright/chromium_headless_shell-1217/chrome-linux/headless_shell
"$CHROME" --headless --disable-gpu --screenshot=out.png --window-size=1200,800 file:///abs/path/page.html
```

Useful for report-style images, styled tables, mockups. Inline all CSS; no external fetches.

### Image manipulation (PIL)

Resize/crop/convert, watermark, paste logos, annotate: `PIL.Image`, `ImageDraw`, `ImageFont` (system fonts: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, covers Vietnamese).

### PDF creation

```bash
python3 - <<'EOF'
from fpdf import FPDF
pdf = FPDF(); pdf.add_page()
pdf.add_font("dv", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")     # required for Vietnamese
pdf.add_font("dv", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
pdf.set_font("dv", "B", 16); pdf.cell(text="Hóa đơn tháng 10"); pdf.ln(12)
pdf.set_font("dv", "", 12); pdf.multi_cell(w=0, text="Tổng tiền: 1.234.567 đ")
pdf.output("out.pdf")
EOF
```

Core fonts (Helvetica) are latin-1 only — **always register DejaVu for Vietnamese text**. Merge/split/watermark PDFs with `pypdf`.

## Guardrails

- Never overwrite the user's input file; write outputs beside it (`<name>.edited.<ext>`) or in a temp dir, and say where.
- Run `pdftotext` before OCR — never OCR a PDF that has a text layer.
- OCR results: report as-is with a caveat about OCR errors; don't fabricate content OCR didn't produce.
- If extraction yields nothing (empty text, 0 OCR lines), say so plainly — don't loop retries.
- Quote all paths with spaces; large payloads → write spec to a temp file rather than long inline JSON.
- Clean up temp render dirs (`page-*.png`) when done.
