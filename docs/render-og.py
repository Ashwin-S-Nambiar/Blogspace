import argparse
from html import escape
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
import yaml
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--version", type=int, default=1)
version = parser.parse_args().version
root = Path(__file__).resolve().parent.parent
template = (root / "docs/og-article.html").read_text()
cards = {}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    for post in sorted((root / "src/content/posts").glob("*/index.mdx")):
        data = yaml.safe_load(post.read_text().split("---", 2)[1])
        if data.get("draft"):
            continue
        image = data.get("hero", {}).get("image") or data.get("thumb")
        if not image:
            continue
        image = (post.parent / image).resolve()
        description = data["dek"]
        if len(description) > 120:
            description = description[:117].rsplit(" ", 1)[0].rstrip(".,;") + "…"
        label = data.get("kind", "build log")
        if data.get("project", {}).get("name"):
            label += " · " + data["project"]["name"]
        html = template
        for key, value in {"title": data["title"], "description": description, "label": label, "image": image.as_uri()}.items():
            html = html.replace("{{" + key + "}}", escape(value, quote=True))
        with NamedTemporaryFile(mode="w", suffix=".html", dir=root / "docs") as source:
            source.write(html)
            source.flush()
            page.goto(Path(source.name).as_uri(), wait_until="networkidle")
            page.evaluate("document.fonts.ready")
            page.evaluate("Promise.all([...document.images].map(image => image.decode()))")
            for selector in [".copy", ".visual"]:
                bounds = page.locator(selector).bounding_box()
                if bounds["y"] < 32 or bounds["y"] + bounds["height"] > 598:
                    raise RuntimeError(f"Article card needs more space: {post.parent.name}")
            output = root / "public/og/posts" / (post.parent.name + ".jpg")
            output.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(output), type="jpeg", quality=92)
            cards[post.parent.name] = f"/og/posts/{post.parent.name}.jpg?v={version}"
            print(f"Rendered {post.parent.name}")
    browser.close()

(root / "src/lib/og-cards.json").write_text(json.dumps(cards, indent=2) + "\n")
