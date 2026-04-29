import os
import glob

# Search in src directory
files_to_process = glob.glob('src/**/*.js', recursive=True) + glob.glob('src/**/*.css', recursive=True)

replacements = {
    "'124,106,255'": "'255,140,66'",
    "'224,64,251'": "'255,60,56'",
    "'56,189,248'": "'255,184,108'",
    "#7C6AFF": "#FF8C42",
    "#38BDF8": "#FFB86C",
    "rgba(124, 106, 255": "rgba(255, 140, 66",
    "rgba(124,106,255": "rgba(255,140,66",
    "rgba(224, 64, 251": "rgba(255, 60, 56",
    "rgba(224,64,251": "rgba(255,60,56",
}

for file_path in files_to_process:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    modified = False
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            modified = True
            
    if modified:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

print("All leftover purple colors updated successfully.")
