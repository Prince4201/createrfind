import os

file_path = "src/app/landing.module.css"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace pill buttons with squarcles
content = content.replace("border-radius:9999px", "border-radius:12px")
content = content.replace("border-radius:999px", "border-radius:12px")

# Replace circular avatars with squarcles
content = content.replace(".floatingAvatar{position:absolute;width:60px;height:60px;border-radius:50%", ".floatingAvatar{position:absolute;width:60px;height:60px;border-radius:18px")
content = content.replace(".floatBadge1,.floatBadge2{position:absolute;padding:6px 14px;border-radius:999px", ".floatBadge1,.floatBadge2{position:absolute;padding:6px 14px;border-radius:8px")
content = content.replace(".heroBadge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:999px", ".heroBadge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:8px")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("UI Shapes updated successfully in landing.module.css")
