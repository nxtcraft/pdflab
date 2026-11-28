// Generates "Compress PDF to <size>" pages under /pdflab/compress/<size>/.
// Page budgets were measured with the browser JPEG encoder the tool uses (canvas toDataURL),
// on a dense A4 page: ~55 KB at the tool's lowest setting (scale 1.0, quality 0.2),
// ~90-105 KB readable (scale 1.0, q 0.5), ~160-250 KB sharp (scale 1.5, q 0.5).
// Run: node pdfcraft/tools/gen-compress-sizes.mjs  (then the section-bar build adds the PDF & Docs bar + breadcrumb)
import fs from 'fs'; import path from 'path';
const ROOT = process.env.HOME + '/vscode-code';
const SITE = 'https://nxtcraft.github.io';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MIN = 55, READ = 100, SHARP = 200; // KB per dense A4 page

const SIZES = [
  { kb: 100, label: '100 KB', use: 'single-page documents such as an ID proof, a certificate or a one-page form' },
  { kb: 200, label: '200 KB', use: 'one or two pages, such as a marksheet, a caste or income certificate, or an address proof' },
  { kb: 300, label: '300 KB', use: 'two to three pages, such as a certificate with an attachment' },
  { kb: 500, label: '500 KB', use: 'short documents of three to five pages' },
  { kb: 1024, label: '1 MB', use: 'multi-page documents such as a bank statement, an agreement or a resume with a portfolio' },
  { kb: 2048, label: '2 MB', use: 'longer documents of 10 to 20 pages, such as a project report or a set of scanned documents' },
];
const slug = s => s.label.toLowerCase().replace(' ', '');
const fit = (kb, per) => Math.max(0, Math.floor(kb / per));

const CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f8fafc;--card:#fff;--text:#1e293b;--muted:#64748b;--body:#374151;--line:#e2e8f0;--soft:#f1f5f9;--accent:#dc2626;--hl:#fee2e2;--good:#16a34a}
[data-theme="dark"]{--bg:#0f172a;--card:#1e293b;--text:#e2e8f0;--muted:#94a3b8;--body:#cbd5e1;--line:#334155;--soft:#1e293b;--hl:#450a0a;--good:#4ade80}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7}
.top{background:var(--accent);color:#fff;padding:.75rem 1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap}.brand{font-weight:800;text-decoration:none;color:#fff}.nav-links a{color:rgba(255,255,255,.9);font-size:.85rem;text-decoration:none;margin-left:1rem}
main{max-width:820px;margin:0 auto;padding:1.5rem 16px 2rem}.breadcrumb{font-size:.8rem;color:var(--muted);margin-bottom:1.25rem}.breadcrumb a{color:var(--muted);text-decoration:none}
h1{font-size:1.65rem;font-weight:800;margin-bottom:.5rem;line-height:1.3}.sub{color:var(--muted);margin-bottom:1.5rem}h2{font-size:1.2rem;font-weight:700;margin:2rem 0 .75rem}
p{margin-bottom:1rem;color:var(--body)}ul,ol{padding-left:1.4rem;margin-bottom:1rem}li{margin-bottom:.4rem;color:var(--body)}a{color:var(--accent)}
.tw{overflow-x:auto;margin-bottom:1.25rem}table{width:100%;border-collapse:collapse;font-size:.9rem;background:var(--card)}th,td{padding:.55rem .7rem;border:1px solid var(--line);text-align:left}th{background:var(--soft);font-weight:700}td.n,th.n{text-align:right}
tr.me td{background:var(--hl);font-weight:700}.highlight{background:var(--hl);border-left:3px solid var(--accent);padding:.75rem 1rem;border-radius:0 8px 8px 0;margin-bottom:1rem}
.cta{background:var(--accent);border-radius:12px;padding:1.25rem;text-align:center;margin:1.5rem 0}.cta p{color:#fff;margin-bottom:.6rem}.btn{display:inline-block;background:#fff;color:#b91c1c;padding:.65rem 1.5rem;border-radius:8px;font-weight:700;text-decoration:none}
.chips{display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:1rem}.chips a{padding:.3rem .8rem;border-radius:20px;background:var(--card);border:1px solid var(--line);color:var(--body);font-size:.84rem;font-weight:600;text-decoration:none}.chips a.cur{background:var(--accent);color:#fff;border-color:var(--accent)}
.faq-item{border-bottom:1px solid var(--line);padding:.9rem 0}.faq-q{font-weight:700;margin-bottom:.3rem}.note{font-size:.85rem;color:var(--muted)}
footer{text-align:center;padding:2rem 16px;color:var(--muted);font-size:.8rem;border-top:1px solid var(--line);margin-top:2.5rem}`;

function page({ url, title, desc, h1, sub, body, faqs, crumbs }) {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: h1, step: [
      { '@type': 'HowToStep', name: 'Open the compressor', text: 'Open PDFLab Compress PDF with the target size already set.' },
      { '@type': 'HowToStep', name: 'Add your PDF', text: 'Choose or drop your PDF. It stays on your device.' },
      { '@type': 'HowToStep', name: 'Compress and download', text: 'Press Compress, check the final size shown, then download.' }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ].map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<script>!function(){try{var t=localStorage.getItem('nc_theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)}catch(e){}}()</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-R9EW10BJGW"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-R9EW10BJGW');</script>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article"><meta property="og:url" content="${SITE}${url}"><meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
${ld}
<style>${CSS}</style>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9027849237070207" crossorigin="anonymous"></script>
</head>
<body>
<div class="top"><a class="brand" href="/pdflab/">PDFLab</a><div class="nav-links"><a href="/pdflab/compress/">Compress PDF</a><a href="/pdf-tools/">All PDF &amp; doc tools</a></div></div>
<main>
<div class="breadcrumb">${crumbs.map(([n, u], i) => i < crumbs.length - 1 ? `<a href="${u}">${esc(n)}</a>` : esc(n)).join(' › ')}</div>
<h1>${h1}</h1>
<p class="sub">${sub}</p>
${body}
<h2>Frequently Asked Questions</h2>
${faqs.map(([q, a]) => `<div class="faq-item"><div class="faq-q">${esc(q)}</div><p>${esc(a)}</p></div>`).join('\n')}
</main>
<footer><p>© 2026 <a href="/">NxtCraft</a> — Free Online Tools. Files are processed in your browser and never uploaded. <a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/contact/">Contact</a></p></footer>
<script src="/assets/nc-theme.js" defer></script>
</body></html>
`;
}

let n = 0;
SIZES.forEach((S, i) => {
  const url = `/pdflab/compress/${slug(S)}/`;
  const target = S.kb >= 1024 ? `target=${S.kb / 1024}&unit=mb` : `target=${S.kb}&unit=kb`;
  const chips = SIZES.map(x => x === S ? `<a class="cur">${x.label}</a>` : `<a href="/pdflab/compress/${slug(x)}/">${x.label}</a>`).join('');
  const rows = [['Sharp (easy to read small print)', fit(S.kb, SHARP)], ['Readable (normal text is clear)', fit(S.kb, READ)], ['Smallest the tool can make', fit(S.kb, MIN)]]
    .map(([q, p]) => ({ cells: [q, p === 0 ? 'Not possible for a dense page' : `about ${p} page${p > 1 ? 's' : ''}`] }));
  const tbl = `<div class="tw"><table><tr><th>Quality</th><th>Dense A4 pages that fit in ${S.label}</th></tr>${rows.map(r => `<tr><td>${r.cells[0]}</td><td>${r.cells[1]}</td></tr>`).join('')}</table></div>`;
  const tooBig = fit(S.kb, MIN);
  const body = `
<div class="chips">${chips}</div>
<div class="cta"><p>Target size is already set to ${S.label}. Your file stays on your device.</p><a class="btn" href="/pdflab/compress/?${target}">Compress PDF to ${S.label} →</a></div>

<h2>How to Compress a PDF to ${S.label}</h2>
<ol>
<li>Open <a href="/pdflab/compress/?${target}">Compress PDF</a>. The <strong>Target Size</strong> tab opens with ${S.label} filled in.</li>
<li>Choose your PDF or drop it on the page. Nothing is uploaded; the work happens in your browser.</li>
<li>Press <strong>Compress</strong>. The tool tries quality levels until the file fits under ${S.label}, keeping the sharpest one that fits.</li>
<li>Check the final size shown, then download. Open the file once to make sure every page is readable before you upload it.</li>
</ol>
<p>A ${S.label} limit suits ${S.use}.</p>

<h2>How Many Pages Fit in ${S.label}?</h2>
${tbl}
<p class="note">Measured on a full page of dense text. Pages with more white space, such as most forms and certificates, take less room, so more of them fit. Colour photos and dark scans take more.</p>
${tooBig <= 1 ? `<div class="highlight">If your PDF has more than ${Math.max(1, tooBig)} page${tooBig > 1 ? 's' : ''} and must fit in ${S.label}, upload only the pages that are asked for: <a href="/pdflab/split/">split the PDF</a> or <a href="/pdflab/delete-pages/">delete the extra pages</a> first.</div>` : ''}

<h2>If the PDF Won't Go Under ${S.label}</h2>
<ul>
<li><strong>Remove pages you don't need.</strong> Blank pages, instructions and duplicate copies all add size. <a href="/pdflab/delete-pages/">Delete pages →</a></li>
<li><strong>Split it.</strong> Many portals accept several smaller files. <a href="/pdflab/split/">Split PDF →</a></li>
<li><strong>Rescan in black and white</strong> at 150 DPI instead of colour at 300 DPI. A colour phone photo of a page can be 2–5 MB; a black-and-white scan of the same page is a fraction of that.</li>
<li><strong>Making a PDF from photos?</strong> Compress the images first with <a href="/imglab/compress/">ImgLab</a>, then combine them with <a href="/pdflab/img-to-pdf/">Image to PDF</a>.</li>
</ul>

<h2>What Changes When You Compress</h2>
<p>To reach a fixed size, PDFLab turns each page into a compressed image. The pages look the same, but the text inside can no longer be selected or searched. That is fine for uploading proofs and certificates. If you need searchable text, keep the original as well. Password-protected PDFs must be unlocked first with <a href="/pdflab/unlock/">Unlock PDF</a>.</p>
<p>See also: <a href="/pdflab/guides/compress-pdf-to-100kb-200kb-1mb/">guide to compressing PDFs for upload limits</a> · <a href="/pdflab/merge/">merge PDFs</a> · <a href="/imglab/exam/">resize exam photo and signature</a>.</p>`;
  const faqs = [
    [`How do I compress a PDF to ${S.label} for free?`, `Open PDFLab Compress PDF, choose Target Size, enter ${S.label}, add your PDF and press Compress. It is free, needs no signup, and the file never leaves your device.`],
    [`How many pages can a ${S.label} PDF have?`, `About ${fit(S.kb, READ) || 'less than 1'} dense A4 page${fit(S.kb, READ) === 1 ? '' : 's'} at readable quality, or up to ${fit(S.kb, MIN) || 'less than 1'} at the lowest quality. Pages with more white space fit more.`],
    [`Will compressing to ${S.label} reduce quality?`, `Only as much as needed. The tool picks the highest quality that still fits under ${S.label}. Small print can blur at very low sizes, so open the file and check it before uploading.`],
    ['Is it safe to compress Aadhaar, PAN or bank statements here?', 'Yes. PDFLab runs entirely in your browser; your PDF is not uploaded to any server.'],
  ];
  const html = page({ url, title: `Compress PDF to ${S.label} Online Free — No Upload | PDFLab`,
    desc: `Reduce a PDF to under ${S.label} in your browser. Free, no signup, no upload. See how many pages fit in ${S.label} and what to do if it won't go smaller.`,
    h1: `Compress PDF to ${S.label}`, sub: `Make any PDF smaller than ${S.label} for an upload limit, free and without uploading the file.`,
    body, faqs, crumbs: [['Home', '/'], ['PDFLab', '/pdflab/'], ['Compress PDF', '/pdflab/compress/'], [`To ${S.label}`, url]] });
  const f = path.join(ROOT, 'pdfcraft', 'compress', slug(S), 'index.html');
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); n++;
});
console.log('pages written', n);
