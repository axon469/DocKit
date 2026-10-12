# Contributing to DocKit

Thanks for helping! DocKit is a single-file, dependency-free web app, so contributing is simple.

## Setup

```bash
git clone https://github.com/axon469/DocKit.git
cd DocKit
python3 build.py              # builds index.html from src/
python3 -m http.server 8080   # open http://localhost:8080
```

## Guidelines

- Edit files in **`src/`**, never `index.html` directly — run `python3 build.py` and commit both.
- Keep everything **client-side**. No tool may upload a user's file or text anywhere.
- Prefer lossless PDF edits (pdf-lib) over re-rendering pages as images; if re-rendering is unavoidable, tell the user in the tool's options.
- New text tools should be pure functions (no DOM) so they can be tested in Node.
- New user-visible strings need a Bangla line in `src/bn*.txt` (`English ¦ বাংলা`). If you can't translate, leave it — the English text is shown as a fallback.
- Check your change on a phone-width screen (about 360–412 px) and in both light and dark themes.

## Reporting bugs

Open an issue with the tool name, what you expected, what happened, and your browser/device. Please do **not** attach private documents.
