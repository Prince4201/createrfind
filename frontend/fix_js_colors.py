import os
import glob

# Files to process
files_to_process = [
    "src/components/Chart.js",
    "src/app/page.module.css",
    "src/app/login/login.module.css",
    "src/app/LandingPage.js",
    "src/app/dashboard/page.js",
    "src/styles/globals.css"
]

replacements = {
    "'124,106,255'": "'255,140,66'",
    "'224,64,251'": "'255,60,56'",
    "'56,189,248'": "'255,184,108'",
    "#7C6AFF": "#FF8C42",
    "#38BDF8": "#FFB86C",
    "rgba(124,106,255": "rgba(255,140,66",
    "rgba(224,64,251": "rgba(255,60,56"
}

for file_path in files_to_process:
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        for old, new in replacements.items():
            content = content.replace(old, new)
            
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

print("JS and CSS files updated successfully.")
