#!/usr/bin/env python3
"""Builds the single-file app (index.html) from the modules in src/.

    python3 build.py

No dependencies — only the Python 3 standard library.
"""
import subprocess, sys, pathlib

root = pathlib.Path(__file__).parent
src = root / "src"

# 1) regenerate the Bangla dictionary (src/i18n-bn.js) from the .txt sources
subprocess.run([sys.executable, "gen_i18n.py"], cwd=src, check=True)

# 2) concatenate everything into one self-contained HTML file
order = ["core.js", "tools.js", "text-lib.js", "text-tools-a.js", "text-tools-b.js",
         "stages.js", "settings.js", "i18n-bn.js", "ui-text.js", "ui.js"]
head = (src / "head.html").read_text(encoding="utf8")
js = "\n".join((src / f).read_text(encoding="utf8") for f in order)
assert "</script>" not in js, "a JS file contains a literal </script> — escape it as <\\/script>"
(root / "index.html").write_text(head + "<script>\n" + js + "\n</script>\n</body>\n</html>\n", encoding="utf8")
print(f"built index.html ({len(head) + len(js):,} bytes)")
