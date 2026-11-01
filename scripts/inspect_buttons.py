import re
from pathlib import Path

files = [
    Path('frontend/src/App.tsx'),
    Path('frontend/src/features/home/HomePage.tsx'),
    Path('frontend/src/features/analysis/AnalysisPage.tsx'),
    Path('frontend/src/features/results/ResultsPage.tsx'),
    Path('frontend/src/features/history/HistoryPage.tsx'),
    Path('frontend/src/features/about/AboutPage.tsx')
]

for fpath in files:
    if not fpath.exists():
        continue
    text = fpath.read_text(encoding='utf-8')
    print(f"\n==========================================")
    print(f"FILE: {fpath}")
    print(f"==========================================")
    
    # 1. Check all <button> elements
    button_matches = list(re.finditer(r'<button\b([^>]*)>(.*?)</button>', text, re.DOTALL))
    print(f"Total <button> elements: {len(button_matches)}")
    for i, m in enumerate(button_matches):
        attrs = m.group(1).strip()
        body = re.sub(r'\s+', ' ', m.group(2)).strip()
        body_clean = re.sub(r'<[^>]+>', '', body).strip()
        
        # Check onClick
        has_onclick = 'onClick=' in attrs
        disabled = 'disabled=' in attrs
        
        # Extract onClick value approximately
        oc_m = re.search(r'onClick=\{([^}]+)\}', attrs)
        oc_snippet = oc_m.group(1).strip() if oc_m else "N/A"
        
        print(f"  [{i+1}] Label: '{body_clean[:35]}' | Disabled: {disabled} | OnClick: {oc_snippet[:45]}")

    # 2. Check all <div onClick=...> interactive action cards/elements
    div_matches = list(re.finditer(r'<div\b([^>]*onClick=\{([^}]+)\}[^>]*)>', text))
    print(f"Total clickable <div> cards: {len(div_matches)}")
    for j, dm in enumerate(div_matches):
        attrs = dm.group(1)
        oc_val = dm.group(2).strip()
        # Find next 100 characters inside div
        start_idx = dm.end()
        inner_preview = re.sub(r'\s+', ' ', text[start_idx:start_idx+150]).strip()
        inner_text = re.sub(r'<[^>]+>', '', inner_preview).strip()
        print(f"  [div-{j+1}] Card: '{inner_text[:35]}' | OnClick: {oc_val[:45]}")

