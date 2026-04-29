import os

file_path = "src/app/landing.module.css"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace gradients
content = content.replace("linear-gradient(135deg,#7C6AFF,#38BDF8)", "linear-gradient(135deg,#FF8C42,#FF3C38)")
content = content.replace("linear-gradient(135deg,#E040FB,#7C6AFF)", "linear-gradient(135deg,#FF8C42,#FF3C38)")
content = content.replace("linear-gradient(135deg,#E040FB,#7C6AFF,#38BDF8)", "linear-gradient(135deg,#FF8C42,#FF3C38,#FFB86C)")
content = content.replace("linear-gradient(135deg,#E040FB,#7C6AFF 50%,#38BDF8)", "linear-gradient(135deg,#FF8C42,#FF3C38 50%,#FFB86C)")

# Replace solid/rgba colors for shadows and glows
content = content.replace("rgba(124,106,255,", "rgba(255,140,66,")
content = content.replace("rgba(224,64,251,", "rgba(255,60,56,")
content = content.replace("rgba(56,189,248,", "rgba(255,184,108,")
content = content.replace("rgba(200,180,255,", "rgba(255,200,150,")

# Replace hex colors
content = content.replace("#A599FF", "#FFA970")
content = content.replace("#E040FB", "#FF8C42")
content = content.replace("#7C6AFF", "#FF3C38")
content = content.replace("#38BDF8", "#FFB86C")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Colors updated successfully in landing.module.css")
