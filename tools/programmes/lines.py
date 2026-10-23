import pdfplumber, sys, json
def lines_of(path, pages=None):
    out = []
    with pdfplumber.open(path) as pdf:
        for pi, page in enumerate(pdf.pages):
            if pages and pi not in pages: continue
            words = page.extract_words(extra_attrs=['fontname', 'size'], keep_blank_chars=False, use_text_flow=False, x_tolerance=3)
            rows = {}
            for w in words:
                key = round(w['top'] / 2.5)
                rows.setdefault(key, []).append(w)
            for k in sorted(rows):
                ws = sorted(rows[k], key=lambda w: w['x0'])
                out.append({'p': pi, 'top': round(ws[0]['top'], 1), 'words': [(w['text'], round(w['x0'], 1), round(w['x1'], 1), w['fontname'].split('+')[-1], round(w['size'], 1)) for w in ws]})
    return out
if __name__ == '__main__':
    L = lines_of(sys.argv[1], set(range(int(sys.argv[2]), int(sys.argv[3]))))
    for l in L:
        f = l['words'][0]
        print(l['p'], l['top'], f[3], f[4], round(f[1]), ' '.join(w[0] for w in l['words'])[:120])
