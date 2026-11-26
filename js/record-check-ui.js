// ─────────────────────────────────────────────────────────────
// 생활기록부 보조 점검 화면
// 표에서 파일을 가져와 모든 점검 항목을 한 번에 점검함
// 파일은 브라우저 안에서만 읽고 저장하지 않음
// ─────────────────────────────────────────────────────────────
let rcFiles = [];        // [{ name, records, isPdf }]
let rcResults = null;    // rcCheckAll 결과
let rcTab = 'all';
let rcQuery = '';
let rcChecking = false;
let rcRunVersion = 0;

function openCheck(btn) {
    document.querySelectorAll('.area-btn').forEach(b => b.classList.remove('active-main'));
    btn.classList.add('active-main');
    ['work-main', 'work-result'].forEach(id => document.getElementById(id).classList.add('hidden-element'));
    document.querySelectorAll('.check-part').forEach(el => el.classList.remove('hidden-element'));
    toggleDrawer(false);
    rcRenderResults();
}

// 화면 아래에 잠깐 뜨는 알림 (type: 'error'면 붉은색)
let toastTimer;
function showToast(text, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ───────── 파일 올리기 ─────────
// 파일은 한 번에 하나만 점검함. 여러 개를 고르면 처음 읽힌 파일 하나만 불러옴.
// 이미 불러온 파일이 있으면 새 파일을 다 읽은 뒤 그 파일로 바꿈 (새 파일을 못 읽으면 지금 파일 그대로)
async function rcAddFiles(list) {
    const before = rcFiles[0];
    let loaded = null;
    for (const file of list) {
        if (loaded) { showToast(`파일은 하나만 불러올 수 있어서 '${loaded.name}'만 불러왔어요.`); break; }
        const isPdf = /\.pdf$/i.test(file.name);
        if (!isPdf && !/\.xlsx?$/i.test(file.name)) { rcLoadFail(file.name, RC_FORM_MSG); continue; }
        try {
            let records;
            if (isPdf) {
                rcLoading('파일을 읽는 중이에요', file.name, 0, 50);
                try {
                    const pages = await rcPdfLines(file);
                    // 반 전체 표 모양 PDF는 엑셀처럼 표로 되살려 읽고, 아니면(학생 한 명씩) 줄 글로 읽음
                    const rows = rcPdfTable(pages);
                    records = rows ? rcParseRows(rows, '', file.name) : [];
                    if (!records.length) records = rcParsePdfLines(pages, file.name);
                    records = await rcFixWraps(records);
                } finally { rcLoading(null); }
            } else {
                const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                records = wb.SheetNames.flatMap(sn => {
                    rcFixRange(wb.Sheets[sn]);
                    return rcParseRows(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }), sn, file.name);
                });
            }
            if (!records.length) {
                rcLoadFail(file.name, RC_FORM_MSG);
                continue;
            }
            loaded = { name: file.name, records, isPdf };
            rcFiles = [loaded];
            rcRunVersion++;
            rcChecking = true;   // 바로 점검을 시작함 (점검 중에는 표에 '결과가 없어요'를 띄우지 않음)
            rcResults = null;
            rcLoading(null);
        } catch (e) {
            rcLoadFail(file.name, `${RC_FORM_MSG}\n${e.message}`);
        }
    }
    rcRenderFiles();
    rcRenderResults();
    if (!loaded) return;
    if (before && list.length === 1) showToast(`'${loaded.name}'(으)로 바꿔 불러왔어요.`);
    rcRun(loaded.isPdf ? rcBarP : 0); // 불러오면 바로 점검 (PDF는 읽기에서 멈춘 자리부터 이어서)
}

// PDF 줄바꿈 자리 띄어쓰기를 사전으로 정함. 사전을 못 쓰면 끝말 짐작대로
async function rcFixWraps(records) {
    const words = rcWrapWords(records);
    let known = null;
    if (words.length) try { known = await rcKnownWords(words); } catch { known = null; }
    return rcResolveWraps(records, known);
}

const RC_NEIS_PATH = "'NEIS → 업무메뉴 → 학교생활기록부'";
const RC_FORM_MSG = RC_NEIS_PATH + "에서\n다운로드 받은 PDF 또는 엑셀 양식을 이용해주세요.";
// 불러오기 실패 창: 어떤 파일인지와 무엇을 올리면 되는지 알려 줌
function rcLoadFail(name, msg) {
    document.getElementById('rc-fail-file').textContent = name;
    // 나이스 메뉴 길은 형광펜으로 칠함 (글은 textContent로만 넣음)
    const [before, ...after] = msg.split(RC_NEIS_PATH), mark = document.createElement('mark');
    mark.textContent = RC_NEIS_PATH;
    document.getElementById('rc-fail-msg').replaceChildren(before, ...(after.length ? [mark, after.join(RC_NEIS_PATH)] : []));
    const dialog = document.getElementById('rc-fail-dialog');
    if (!dialog.open) dialog.showModal();
}

// PDF 도구는 PDF를 처음 올릴 때만 불러옴 (도구만 받아 오고, 파일은 브라우저 안에서만 읽음)
const RC_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let rcPdfReady = null;
function rcLoadPdfJs() {
    rcPdfReady ||= new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = RC_PDFJS + 'pdf.min.js';
        s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = RC_PDFJS + 'pdf.worker.min.js'; ok(); };
        s.onerror = () => { rcPdfReady = null; fail(new Error('PDF 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); };
        document.head.appendChild(s);
    });
    return rcPdfReady;
}

// 나이스 엑셀은 표 범위 정보가 틀려서 아래쪽 줄이 빠지기도 함 → 실제 들어 있는 칸으로 범위를 다시 잡음
function rcFixRange(ws) {
    let s = null, e = null;
    for (const k of Object.keys(ws)) {
        if (k[0] === '!') continue;
        const c = XLSX.utils.decode_cell(k);
        if (!s) { s = { ...c }; e = { ...c }; continue; }
        s.r = Math.min(s.r, c.r); s.c = Math.min(s.c, c.c);
        e.r = Math.max(e.r, c.r); e.c = Math.max(e.c, c.c);
    }
    if (s) ws['!ref'] = XLSX.utils.encode_range({ s, e });
}

// 쪽마다 글 조각을 좌표와 함께 꺼내 줄로 묶음 (rcGroupLines)
async function rcPdfLines(file) {
    await rcLoadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const { items } = await page.getTextContent();
        const vp = page.getViewport({ scale: 1 });
        // pdf.js는 줄 끝 띄어쓰기를 버림 → 그리기 명령 원문에서 낱말 뒤 띄어쓰기를 되찾음
        let raw = '', ops = null;
        try {
            ops = await page.getOperatorList();
            ops.fnArray.forEach((fn, i) => {
                if (fn !== pdfjsLib.OPS.showText && fn !== pdfjsLib.OPS.showSpacedText) return;
                for (const g of ops.argsArray[i][0]) if (g && typeof g === 'object' && g.unicode) raw += g.unicode;
            });
        } catch { raw = ''; }
        let ptr = 0;
        const parts = [];
        for (const it of items) {
            if (!it.str) continue;
            const sp = !it.str.trim();
            let spAfter = null;
            if (!sp && raw) {
                const k = raw.indexOf(it.str, ptr);
                if (k >= 0 && k - ptr < 40) { ptr = k + it.str.length; spAfter = /\s/.test(raw[ptr] || ''); }
            }
            // 화면 기준 좌표로 바꿈: 90° 돌아간 쪽도 가로·세로가 바르게 잡힘
            const t = pdfjsLib.Util.transform(vp.transform, it.transform);
            parts.push({ s: it.str, x: t[4], y: vp.height - t[5], w: it.width || 0, h: Math.hypot(t[2], t[3]) || 10, sp, spAfter });
        }
        const lines = rcGroupLines(parts);
        // 표 칸(네모) 위치: 어느 줄이 어느 학생·영역 칸에 들었는지 정확히 가림 (못 읽으면 글 위치로 짐작)
        try { if (ops) lines.rects = rcPdfRects(ops, pdfjsLib, vp); } catch { /* 짐작으로 읽음 */ }
        pages.push(lines);
    }
    return pages;
}

function rcRemoveFile(i) {
    rcRunVersion++;
    rcChecking = false;
    rcFiles.splice(i, 1);
    rcResults = null;
    rcLoading(null);
    rcRenderFiles();
    rcRenderResults();
}

// 파일 닫기: 점검 결과도 사라지므로 먼저 물어봄
let rcClosing = null;
function rcAskClose(i) {
    rcClosing = rcFiles[i];
    document.getElementById('rc-close-description').textContent = `‘${rcClosing.name}’을(를) 닫으면\n이 파일의 점검 결과도 함께 사라져요.`;   // 이름이 길어도 '닫으면' 다음에서 줄을 바꿈
    document.getElementById('rc-close-dialog').showModal();
}

function rcConfirmClose() {
    const dialog = document.getElementById('rc-close-dialog');
    const i = rcFiles.indexOf(rcClosing);
    rcClosing = null;
    dialog.close();
    if (i >= 0) rcRemoveFile(i);
}

function rcRenderFiles() {
    const box = document.getElementById('rc-file-list');
    box.innerHTML = rcFiles.map((f, i) =>
        `<div class="rc-file ${f.isPdf ? 'is-pdf' : 'is-excel'}"><span class="rc-file-icon" aria-hidden="true"><i data-lucide="${f.isPdf ? 'file-text' : 'file-spreadsheet'}"></i></span>`
        + `<span class="rc-file-name" title="${rcEscape(f.name)}">${rcEscape(f.name)}</span><span class="rc-file-count">${f.records.length}건</span>`
        + `<button type="button" onclick="rcAskClose(${i})" aria-label="${rcEscape(f.name)} 닫기" title="닫기"><i data-lucide="x"></i></button></div>`
    ).join('');
    if (window.lucide) lucide.createIcons();
}

// 표 가운데 로딩 표시 (text가 없으면 숨김). from%에서 시작해 to%에 가까워짐
// PDF는 '읽기(0→50%)' 다음 '점검'을 읽기가 멈춘 자리부터 이어 감 (단계마다 0%로 돌아가지 않게)
// ponytail: 맞춤법 검사는 한 번에 끝나서 실제 진행률을 모름 → 처음엔 빠르게, 목표에 가까울수록 천천히 차게 함
let rcBarTimer = null, rcBarP = 0;   // rcBarP: 막대가 마지막으로 그린 진행률
function rcLoading(text, sub = '', from = 0, to = 90) {
    const box = document.getElementById('rc-loading');
    box.hidden = !text;
    document.getElementById('rc-drop').classList.toggle('loading', !!text);
    clearInterval(rcBarTimer);
    if (!text) return;
    let p = from;
    const draw = () => {
        rcBarP = p;
        document.getElementById('rc-bar-fill').style.width = p + '%';
        document.getElementById('rc-pencil').style.left = p + '%';
        document.getElementById('rc-bar-pct').style.left = p + '%';
        document.getElementById('rc-bar-pct').textContent = Math.round(p) + '%';
    };
    draw();
    rcBarTimer = setInterval(() => { p += (to - p) * 0.06; draw(); }, 150);
    document.getElementById('rc-loading-text').textContent = text;
    document.getElementById('rc-loading-sub').textContent = sub;
}

async function rcRun(barFrom = 0) {
    if (!rcFiles.length) return;
    const version = ++rcRunVersion;
    const files = [...rcFiles];
    const records = files.flatMap(f => f.records);
    rcChecking = true;
    rcRenderFiles();
    rcLoading('점검하는 중이에요', '', barFrom);
    try {
        const { spellings, loans } = (await rcCheckSpelling(records)) || {};
        if (version !== rcRunVersion || files.length !== rcFiles.length || files.some((file, i) => file !== rcFiles[i])) return;
        rcResults = rcCheckAll(records, { spellings, loans, limits: RC_DEFAULT_SETTINGS.limits }, getByteLength);
        rcTab = 'all';
        rcQuery = '';
        document.getElementById('rc-search').value = '';
        rcRenderResults();
    } catch (error) {
        if (version === rcRunVersion) showToast(`점검을 완료하지 못했어요. ${error.message}`, 'error');
    } finally {
        if (version === rcRunVersion) {
            rcChecking = false;
            rcLoading(null);
            rcRenderFiles();
            if (!rcResults) rcRenderResults();   // 점검을 못 끝냈을 때만 '결과가 없어요' 안내
        }
    }
}

// ───────── 결과 ─────────
const RC_FILLER = '<tr class="filler-row" style="height:100%"><td></td><td></td><td></td><td></td><td></td><td class="excel-byte"></td></tr>';

// 지금 화면에 보이는 줄 (필터·검색 반영). 화면과 '결과 내려받기'가 같이 씀
// withMarks: 화면에서는 사전 밑줄만 있는 학생도 보여 줌 (맞춤법 밑줄은 전체·맞춤법, 외래어 밑줄은 전체·외래어 보기에서). 엑셀에는 안 담음
function rcHasMarks(r, tab) {
    return ((tab === 'all' || tab === 'spell') && (r.marks || []).length > 0) || ((tab === 'all' || tab === 'loan') && (r.loanMarks || []).length > 0);
}
// types: 보여 줄 점검 영역 목록 (null이면 전체). 기본은 지금 고른 필터, 인쇄 창에서는 고른 영역들
function rcVisibleRows(withMarks = false, types = rcTab === 'all' ? null : [rcTab]) {
    const q = rcQuery.trim();
    const has = t => !types || types.includes(t);
    return (rcResults || [])
        .map(r => ({ ...r, shown: r.issues.filter(i => has(i.type)), dict: withMarks && has('spell') ? r.marks || [] : [], loan: withMarks && has('loan') ? r.loanMarks || [] : [] }))
        .filter(r => (r.shown.length || r.dict.length || r.loan.length) && (!q || rcWho(r.rec).includes(q) || r.rec.subject.includes(q) || r.rec.area.includes(q)));
}

// 학번: 1학년 3반 1번 → 10301 (숫자가 모자라면 있는 것만 이어 씀)
function rcStudentId({ grade, cls, num }) {
    return /^\d$/.test(grade) && /^\d{1,2}$/.test(cls) && /^\d{1,2}$/.test(num)
        ? grade + cls.padStart(2, '0') + num.padStart(2, '0')
        : [grade && grade + '학년', cls && cls + '반', num && num + '번'].filter(Boolean).join(' ');
}

// 항목: 좁은 칸에서 낱말 중간이 잘리지 않게 '및' 앞에서 줄을 나누고, 과목은 다음 줄에 (과목)
function rcWhereLines(rec) {
    const lines = rec.area.split(/ (?=및 )/);
    if (rec.subject) lines.push(`(${rec.subject})`);
    return lines;
}

function rcRenderResults() {
    const tbody = document.getElementById('rc-tbody');
    const tabs = [['all', '전체'], ...Object.entries(RC_TYPES)];
    const filter = document.getElementById('rc-type-filter');
    filter.innerHTML = '<button type="button"><selectedcontent></selectedcontent></button>' + tabs.map(([t, label]) => {
        // 표에 나올 학생 수 (검색어와 상관없이)
        const n = rcCount(t);
        const count = rcResults ? ` <span class="rc-filter-count${n ? '' : ' rc-zero'}" aria-label="${n}명">${n}</span>` : '';
        return `<option value="${t}"><span class="rc-filter-label">${label}</span>${count}</option>`;
    }).join('');
    filter.value = rcTab;
    ['rc-export-btn', 'rc-print-btn'].forEach(id => { document.getElementById(id).disabled = !rcResults; });
    document.getElementById('rc-import').hidden = !!(rcResults || rcFiles.length);

    if (!rcResults) {
        const ready = rcFiles.length && !rcChecking ? `<td colspan="6" class="rc-empty"><span class="rc-empty-msg">점검 결과가 없어요. 파일을 닫고 다시 불러오면 다시 점검해요.</span></td>` : '<td colspan="6"></td>';
        tbody.innerHTML = `<tr class="filler-row" style="height:100%">${ready}</tr>`;
        return;
    }

    const q = rcQuery.trim();
    const rows = rcVisibleRows(true);
    if (!rows.length) {
        tbody.innerHTML = `<tr class="filler-row" style="height:100%"><td colspan="6" class="rc-empty"><span class="rc-empty-msg">${q ? '찾는 학생이 없어요.' : '충성! 보조 점검 결과 이상 없습니다!'}</span></td></tr>`;
        return;
    }
    tbody.innerHTML = rows.map(rcRowHtml).join('') + RC_FILLER;
}

// 점검 영역(t)에 걸린 학생 수 (검색어와 상관없이)
function rcCount(t) {
    return (rcResults || []).filter(r => r.issues.some(issue => t === 'all' || issue.type === t) || rcHasMarks(r, t)).length;
}

// 결과 표 한 줄 (화면과 인쇄가 같이 씀)
function rcRowHtml(r) {
        const where = rcWhereLines(r.rec).map(line => `<span>${rcEscape(line)}</span>`).join('');
        const fixes = rcMergeSimilar(r.shown).map(x => `<li class="rc-${x.level}"><span class="rc-tag">${RC_TYPES[x.type]}</span>${x.people
            ? `다른 학생 기록에도 동일한 문장이 있어요.<span class="rc-dup-list">${x.people.map(p =>
                `<span class="rc-dup-name" tabindex="0" aria-label="${rcEscape(p.who)}과(와) 같은 문장 ${p.passages.length}개" data-passages="${rcEscape(JSON.stringify(p.passages))}">${rcEscape(rcStudentId(p.rec))} ${rcEscape(p.rec.name)}</span>`).join('')}</span>`
            : rcEscape(x.why)}</li>`).join('');
        return `<tr><td class="rc-who"><b>${rcEscape(r.rec.name)}</b></td><td class="rc-id">${rcEscape(rcStudentId(r.rec))}</td><td class="rc-where">${where}</td>`
            + `<td class="result-cell rc-text">${rcHighlight(r.rec.text, r.shown, r.dict, r.loan) || '<span class="rc-blank">(비어 있음)</span>'}</td>`
            + `<td class="rc-fix"><ul>${fixes}</ul></td><td class="excel-byte">${getByteLength(r.rec.text)} Byte</td></tr>`;
}

// 똑같은 문장: 학생 이름에 커서를 올리거나 Tab으로 고르면, 그 학생과 같은 문장만 진하게 남기고 다른 똑같은 문장 표시는 잠깐 끔
function rcDupFocus(name, on) {
    const row = name.closest('tr');
    const mine = new Set(on ? JSON.parse(name.dataset.passages) : []);
    const all = new Set(on ? [...row.querySelectorAll('.rc-dup-name')].flatMap(n => JSON.parse(n.dataset.passages)) : []);
    row.querySelectorAll('.rc-text .rc-mark').forEach(mark => {
        mark.classList.toggle('rc-dup-on', mine.has(mark.textContent));
        mark.classList.toggle('rc-dup-off', all.has(mark.textContent) && !mine.has(mark.textContent));
    });
}
['mouseover', 'focusin'].forEach(ev => document.getElementById('rc-tbody').addEventListener(ev, e => { const n = e.target.closest('.rc-dup-name'); if (n) rcDupFocus(n, true); }));
['mouseout', 'focusout'].forEach(ev => document.getElementById('rc-tbody').addEventListener(ev, e => { const n = e.target.closest('.rc-dup-name'); if (n) rcDupFocus(n, false); }));

function rcSearch(v) {
    rcQuery = v;
    rcRenderResults();
}

// 결과 내려받기(PDF)·인쇄하기: 고른 점검 영역(types)의 표를 화면과 같은 모양(.rc-sheet)으로 만듦
function rcSheetTable(rows) {
    const screen = document.querySelector('#check-result .rc-table');
    return `<table class="excel-table rc-table rc-sheet">${screen.querySelector('colgroup').outerHTML}${screen.querySelector('thead').outerHTML}<tbody>${rows.map(rcRowHtml).join('')}</tbody></table>`;
}
function rcSheetTitle(types) {
    const all = types.length === Object.keys(RC_TYPES).filter(t => rcCount(t)).length;
    return ['생기부_점검결과', ...(all ? [] : types.map(t => RC_TYPES[t]))].join('_');
}

// 인쇄하기: 숨은 틀에 표를 옮겨 인쇄창을 띄움 (A4 가로)
function rcPrint(types) {
    const rows = rcVisibleRows(true, types);
    if (!rows.length) { showModal('알림', '인쇄할 내용이 없어요.', 'info'); return; }
    const css = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => `<link rel="stylesheet" href="${l.href}">`).join('');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${rcEscape(rcSheetTitle(types))}</title>${css}<style>
        @page { size: A4 landscape; margin: 10mm; }
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .rc-sheet tr { break-inside: avoid; }
    </style></head><body>${rcSheetTable(rows)}</body></html>`);
    doc.close();
    frame.contentWindow.onafterprint = () => setTimeout(() => frame.remove());
    // 글꼴·스타일을 다 받은 뒤 인쇄 (안 그러면 밑줄·색 없이 찍힐 수 있음)
    const print = () => frame.contentWindow.print();
    frame.contentWindow.addEventListener('load', () => (doc.fonts ? doc.fonts.ready : Promise.resolve()).then(print), { once: true });
}

// PDF 만드는 도구는 처음 내려받을 때만 불러옴
const RC_PDF_LIBS = ['https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js', 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js'];
let rcPdfLibsReady = null;
function rcLoadPdfLibs() {
    rcPdfLibsReady ||= Promise.all(RC_PDF_LIBS.map(src => new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = () => fail(new Error('PDF 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
        document.head.appendChild(s);
    }))).catch(e => { rcPdfLibsReady = null; throw e; });
    return rcPdfLibsReady;
}

// PDF 그림에 넣을 Pretendard 글꼴 (표에 쓰는 굵기만). 글꼴 파일이 다른 사이트에 있어 도구가 스스로 못 읽음 → 직접 받아 끼움
const RC_PDF_FONT = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-';
let rcPdfFont = null;
function rcPdfFontCss() {
    rcPdfFont ||= Promise.all([[400, 'Regular'], [600, 'SemiBold'], [700, 'Bold']].map(async ([weight, name]) => {
        const blob = await (await fetch(RC_PDF_FONT + name + '.woff2')).blob();
        const url = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
        return `@font-face{font-family:Pretendard;font-weight:${weight};src:url(${url}) format('woff2')}`;
    })).then(css => css.join('')).catch(e => { rcPdfFont = null; throw e; });
    return rcPdfFont;
}

// 내려받기: 화면과 같은 표를 A4 가로 쪽마다 그림으로 찍어 PDF 파일로 바로 저장
// PDF 만드는 중 표시: 점검 로딩(LOADING·연필)과 헷갈리지 않게 PDF 종이가 쌓이는 모양 + 실제 몇 쪽째인지
// done=null이면 숨김, total=0이면 아직 준비 중(도구·글꼴 받는 중)
function rcPdfProgress(done, total = 0) {
    const box = document.getElementById('rc-pdf-loading');
    box.hidden = done === null;
    if (done === null) return;
    document.getElementById('rc-pdf-count').textContent = total ? `${done} / ${total}쪽 · 다 되면 바로 내려받아져요` : '준비하는 중이에요';
    document.getElementById('rc-pdf-fill').style.width = (total ? done / total * 100 : 0) + '%';
}
// ponytail: 쪽마다 그림이라 PDF 안 글자는 고를 수 없음. 한 학생 줄이 한 쪽보다 길면 그 쪽만 줄여서 담음
const RC_PDF = { w: 297, h: 210, margin: 10, px: 96 / 25.4 };   // mm, 1mm = 3.78px
async function rcDownloadPdf(types) {
    const rows = rcVisibleRows(true, types);
    if (!rows.length) { showModal('알림', '내려받을 내용이 없어요.', 'info'); return; }
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;left:-30000px;top:0;width:${Math.round((RC_PDF.w - RC_PDF.margin * 2) * RC_PDF.px)}px;background:#fff`;
    rcPdfProgress(0, 0);
    try {
        await rcLoadPdfLibs();
        box.innerHTML = rcSheetTable(rows);
        document.body.appendChild(box);
        await document.fonts.ready;
        // 한 쪽에 들어갈 만큼씩 줄을 나눔 (제목 줄은 쪽마다 다시)
        const table = box.firstElementChild;
        const pageH = (RC_PDF.h - RC_PDF.margin * 2) * RC_PDF.px - table.tHead.offsetHeight - 2;
        const pages = [[]];
        let used = 0;
        [...table.tBodies[0].rows].forEach(tr => {
            if (used + tr.offsetHeight > pageH && pages.at(-1).length) { pages.push([]); used = 0; }
            pages.at(-1).push(tr);
            used += tr.offsetHeight;
        });
        const fontEmbedCSS = await rcPdfFontCss();
        const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        for (const [n, page] of pages.entries()) {
            rcPdfProgress(n + 1, pages.length);
            const body = table.tBodies[0];
            [...body.rows].forEach(tr => { tr.hidden = !page.includes(tr); });
            const img = await htmlToImage.toJpeg(table, { pixelRatio: 2, quality: 0.92, backgroundColor: '#fff', fontEmbedCSS });
            const fullW = RC_PDF.w - RC_PDF.margin * 2, fullH = RC_PDF.h - RC_PDF.margin * 2;
            const scale = Math.min(fullW / (table.offsetWidth / RC_PDF.px), fullH / (table.offsetHeight / RC_PDF.px));
            if (n) pdf.addPage();
            pdf.addImage(img, 'JPEG', RC_PDF.margin, RC_PDF.margin, table.offsetWidth / RC_PDF.px * scale, table.offsetHeight / RC_PDF.px * scale);
        }
        pdf.save(rcSheetTitle(types) + '.pdf');
    } catch (error) {
        showToast(`PDF를 만들지 못했어요. ${error.message}`, 'error');
    } finally {
        box.remove();
        rcPdfProgress(null);
    }
}

// 내려받기·인쇄하기 전에 결과가 있는 점검 영역만 골라 보여 줌 (처음엔 모두 고름)
let rcPickMode = 'pdf';
function rcAskPick(mode) {
    if (!rcResults) return;
    const types = Object.keys(RC_TYPES).filter(t => rcCount(t));
    const verb = mode === 'print' ? '인쇄' : '내려받기';
    if (!types.length) { showModal('알림', `${verb}할 점검 결과가 없어요.`, 'info'); return; }
    rcPickMode = mode;
    document.getElementById('rc-print-title').textContent = mode === 'print' ? '어떤 점검 결과를 인쇄할까요?' : '어떤 점검 결과를 내려받을까요?';
    document.getElementById('rc-print-desc').textContent = mode === 'print' ? '결과가 있는 영역만 보여요. A4 가로로 인쇄돼요.' : '결과가 있는 영역만 보여요. A4 가로 PDF 파일로 저장돼요.';
    document.getElementById('rc-print-go').textContent = mode === 'print' ? '인쇄하기' : '내려받기';
    document.getElementById('rc-print-list').innerHTML = `<label class="rc-print-all"><input type="checkbox" checked onchange="rcPrintPickAll(this.checked)"><span>전체</span><em>${rcCount('all')}명</em></label>`
        + types.map(t => `<label><input type="checkbox" name="rc-print-type" value="${t}" checked onchange="rcPrintSync()"><span>${RC_TYPES[t]}</span><em>${rcCount(t)}명</em></label>`).join('');
    rcPrintSync();
    document.getElementById('rc-print-dialog').showModal();
}
function rcPrintPicked() {
    return [...document.querySelectorAll('#rc-print-list input[name="rc-print-type"]:checked')].map(i => i.value);
}
function rcPrintPickAll(on) {
    document.querySelectorAll('#rc-print-list input[name="rc-print-type"]').forEach(i => { i.checked = on; });
    rcPrintSync();
}
function rcPrintSync() {
    const boxes = document.querySelectorAll('#rc-print-list input[name="rc-print-type"]');
    const n = rcPrintPicked().length;
    const all = document.querySelector('#rc-print-list .rc-print-all input');
    all.checked = n === boxes.length;
    all.indeterminate = n > 0 && n < boxes.length;
    document.getElementById('rc-print-go').disabled = !n;
}
function rcConfirmPick() {
    const types = rcPrintPicked();
    document.getElementById('rc-print-dialog').close();
    if (!types.length) return;
    if (rcPickMode === 'print') rcPrint(types); else rcDownloadPdf(types);
}

// 끌어다 놓기
(function () {
    const dz = document.getElementById('rc-drop');
    const input = document.getElementById('rc-file-input');
    document.getElementById('rc-import-button').addEventListener('click', () => input.click());
    input.addEventListener('change', () => { rcAddFiles([...input.files]); input.value = ''; });
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => rcAddFiles([...e.dataTransfer.files]));
})();

