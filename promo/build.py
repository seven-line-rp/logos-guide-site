# Собирает promo/logos-promo.html: данные плана, шрифт Onest и фото вшиваются внутрь файла.
import base64, json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
b64 = lambda p: base64.b64encode(pathlib.Path(p).read_bytes()).decode()
font = root / 'node_modules/@fontsource-variable/onest/files'
img = {k: 'data:image/webp;base64,' + b64(root / f'public/rooms/{f}.webp') for k, f in
       {'canteen': 'canteen', 'library': 'library', 'auditorium': 'auditorium', 'room213': 'room-213', 'cloakroom': 'cloakroom', 'classroom': 'classroom'}.items()}
html = (root / 'promo/template.html').read_text()
html = (html.replace('__FONT_CYR__', b64(font / 'onest-cyrillic-wght-normal.woff2'))
            .replace('__FONT_LAT__', b64(font / 'onest-latin-wght-normal.woff2'))
            .replace('__DATA__', pathlib.Path((sys.argv[1] if len(sys.argv) > 1 else str(root / "promo/plan.json"))).read_text())
            .replace('__IMG__', json.dumps(img)))
(root / 'promo/logos-promo.html').write_text(html)
print(len(html) // 1024, 'KB')
