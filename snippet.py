import pathlib
text = pathlib.Path('src/app/defensive/Defensive_Dashboard.jsx').read_text(encoding='utf-8', errors='replace').splitlines()
for i,line in enumerate(text[270:320],271):
    print(f"{i}:{line}")
