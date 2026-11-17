
const keywordDB = {
    '행동특성': { 
        pos: {
            '학교생활': ['규칙준수', '근면성실', '책임감'],
            '교우관계': ['친화력', '배려심', '지도력'],
            '인성태도': ['차분함', '인내심', '겸손함']
        },
        neg: {
            '학교생활': ['무질서', '비성실', '잦은지각'],
            '교우관계': ['소극적', '이기적', '수동적'],
            '인성태도': ['예민함', '끈기부족', '고집센']
        }
    }
};

const FILLER_ROW = '<tr class="filler-row" style="height: 100%;"><td class="excel-num"></td><td></td><td class="excel-byte"></td></tr>';

let area = '자율';
let charLimit = 125; 
const selectedKeywords = new Map(); // 단어 → 'pos'(좋은 태도) | 'neg'(아쉬운 태도)
let rawGeneratedText = ""; 

// 메뉴별 입력·결과를 따로 기억 (메뉴를 오가도 내용 유지)
const tabStates = { '자율': {}, '진로': {}, '동아리': {}, '과세특': {}, '행동특성': {} };

let selectedAutonomyBadges = [];

const presetsByArea = {
    '자율': [
        '정부반장선거', '학급자치활동', '학교폭력예방교육', '장애인식개선교육', '체육한마당',
        '흡연예방교육', '생명존중교육', '다문화이해교육'
    ],
    '진로': [
        '진로심리검사', '진로적성검사', '직업인초청강연', '직업인과의만남',
        '진로융합체험', '현장직업체험', '진로체험의날', '나의꿈발표대회'
    ]
};

function validateStudentCount(input, commit = false) {
    if (input.value === '' && !commit) return;
    input.value = /^\d+$/.test(input.value)
        ? String(Math.min(50, Math.max(1, Number(input.value))))
        : (input.value === '' ? '1' : (input.dataset.validCount || '1'));
    input.dataset.validCount = input.value;
}

window.onload = function() { 
    lucide.createIcons();
    renderAutonomyPresets();
    renderSelectedAutonomyBadges();
    selArea('자율', document.querySelector('.area-btn')); 
};

function renderAutonomyPresets() {
    const container = document.getElementById('preset-group-container');
    if (!container) return;
    document.querySelector('main').classList.toggle('autonomy-layout', area in presetsByArea);
    container.innerHTML = '';
    (presetsByArea[area] || []).forEach(text => {
        const btn = document.createElement('button');
        const isSelected = selectedAutonomyBadges.some(b => b.text === text);
        btn.className = `w-full py-1.5 px-1 text-center rounded-lg text-[12px] font-bold transition-all border shrink-0 truncate ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`;
        btn.innerText = text;
        btn.onclick = () => togglePresetAutonomyBadge(text);
        container.appendChild(btn);
    });
}

function togglePresetAutonomyBadge(text) {
    const existingIndex = selectedAutonomyBadges.findIndex(b => b.text === text);
    if (existingIndex > -1) {
        selectedAutonomyBadges.splice(existingIndex, 1);
    } else {
        selectedAutonomyBadges.push({ id: Date.now() + Math.random(), text: text });
    }
    renderSelectedAutonomyBadges();
    renderAutonomyPresets();
}

function addCustomAutonomyBadge() {
    const input = document.getElementById('custom-autonomy-input');
    const val = input.value.trim();
    if (!val) return;
    selectedAutonomyBadges.push({ id: Date.now() + Math.random(), text: val });
    input.value = '';
    renderSelectedAutonomyBadges();
    renderAutonomyPresets();
}

function updateAutonomyBadgeText(id, newText) {
    const badge = selectedAutonomyBadges.find(b => b.id === id);
    if (badge) {
        badge.text = newText.trim() || '자율활동';
    }
    renderAutonomyPresets();
}

function removeAutonomyBadge(id) {
    selectedAutonomyBadges = selectedAutonomyBadges.filter(b => b.id !== id);
    renderSelectedAutonomyBadges();
    renderAutonomyPresets();
}

function renderSelectedAutonomyBadges() {
    const container = document.getElementById('selected-autonomy-badges');
    if (!container) return;
    container.dataset.emptyMessage = `${area} 활동 내용을 위에서 선택하거나 직접 추가해주세요`;
    container.innerHTML = '';

    selectedAutonomyBadges.forEach(b => {
        const chip = document.createElement('div');
        chip.className = "relative min-w-0";

        const textBox = document.createElement('span');
        textBox.className = "block w-full min-h-[32px] px-1 py-1.5 rounded-lg bg-white border border-slate-300 text-[12px] text-center font-bold text-slate-800 cursor-text whitespace-pre-wrap break-words";
        textBox.contentEditable = "true";
        textBox.spellcheck = false;
        textBox.innerText = b.text;
        textBox.onblur = (e) => updateAutonomyBadgeText(b.id, e.target.innerText.trim());

        const closeBtn = document.createElement('button');
        closeBtn.className = "absolute -top-0.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 text-white text-[7px] leading-none flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm";
        closeBtn.innerText = "✕";
        closeBtn.onclick = () => removeAutonomyBadge(b.id);

        chip.appendChild(textBox);
        chip.appendChild(closeBtn);
        container.appendChild(chip);
    });
}

function showModal(title, msg, type = 'info') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerHTML = msg;
    // 오류 창만 그림과 제목을 보여주고, 안내 창은 문구만 보여줌
    document.getElementById('modal-icon').classList.toggle('hidden-element', type !== 'error');
    document.getElementById('modal-title').classList.toggle('hidden-element', type !== 'error');
    document.getElementById('custom-modal').classList.remove('hidden-element');
}
function closeModal() { document.getElementById('custom-modal').classList.add('hidden-element'); }

function translateError(errStr) {
    const err = errStr.toLowerCase();
    if (err.includes("api key") || err.includes("api_key") || err.includes("permission") || err.includes("unauthenticated")) return "API 키가 올바르지 않거나 쓸 수 없는 키예요.<br>설정(톱니)에서 키를 확인해 주세요.";
    if (err.includes("quota") || err.includes("429") || err.includes("resource_exhausted")) return "오늘 쓸 수 있는 AI 사용량을 다 썼거나 요청이 너무 많아요.<br>잠시 후 다시 시도해 주세요.";
    if (err.includes("failed to fetch") || err.includes("network")) return "인터넷 연결을 확인해 주세요.";
    if (err.includes("safety") || err.includes("blocked") || err.includes("요청 차단")) return "입력 내용 중에 AI 안전 필터에 걸리는 표현이 있는 것 같아요.<br>내용을 순화해서 다시 시도해 주세요.";
    return `알 수 없는 오류가 발생했어요.<br><span class="text-xs text-slate-400 mt-2 block">(${escapeHtml(errStr)})</span>`;
}

function selArea(v, el) { 
    setWorkVisible(true);
    toggleDrawer(false);
    if (area) {
        tabStates[area] = {
            case: document.getElementById('case-inp').value,
            subj: document.getElementById('subj-inp').value,
            autonomyBadges: [...selectedAutonomyBadges],
            resultHtml: document.getElementById('result-tbody').innerHTML,
            resultText: rawGeneratedText
        };
    }

    area = v; 
    document.querySelectorAll('.area-btn').forEach(b => b.classList.remove('active-main'));
    el.classList.add('active-main');

    const keySec = document.getElementById('keyword-section');
    const caseGrp = document.getElementById('case-group');
    const autoBadgeSec = document.getElementById('autonomy-badge-section');

    const caseLabel = document.getElementById('case-label');
    const caseInp = document.getElementById('case-inp');
    const subjInp = document.getElementById('subj-inp');

    rawGeneratedText = tabStates[area].resultText || "";
    document.getElementById('result-tbody').innerHTML = tabStates[area].resultHtml || FILLER_ROW;

    document.getElementById('student-count').value = 1;
    document.getElementById('student-count').dataset.validCount = '1';

    if (area === '자율' || area === '진로') {
        autoBadgeSec.classList.remove('hidden-element');
        caseGrp.classList.add('hidden-element');
        caseGrp.classList.remove('merged');
        keySec.classList.add('hidden-element');

        document.getElementById('autonomy-label').innerText = (area === '자율') ? '자율활동 내용 선택' : '진로활동 내용 선택';
        selectedAutonomyBadges = tabStates[area].autonomyBadges || [];
        renderSelectedAutonomyBadges();
        renderAutonomyPresets();
    } else if (area === '행동특성') {
        autoBadgeSec.classList.add('hidden-element');
        caseGrp.classList.remove('hidden-element');
        caseGrp.classList.remove('merged');
        keySec.classList.remove('hidden-element');

        caseLabel.innerText = '학생 관찰 기록 (필수)';
        caseInp.placeholder = '예시: 매사에 성실함, 책임감이 강함, 수업 시간에 산만함, 운동 좋아함';
    } else {
        autoBadgeSec.classList.add('hidden-element');
        caseGrp.classList.remove('hidden-element');
        keySec.classList.add('hidden-element');

        // 동아리·과세특: 이름 칸 + 활동 내용 칸을 한 상자로 보여줌
        const isClub = area === '동아리';
        caseGrp.classList.add('merged');
        document.getElementById('merge-name-cell').innerText = isClub ? '동아리 이름' : '과목 이름';
        document.getElementById('merge-body-title').innerText = isClub ? '동아리 활동 내용' : '교과 학습 및 활동 내용';
        caseLabel.innerText = isClub ? '스포츠 & 동아리 정보 입력' : '교과 정보 입력';
        subjInp.placeholder = isClub ? '예시: 과학영화 감상반, 농구반, 건강 걷기반' : '예시: 국어, 영어, 수학, 과학';
        caseInp.placeholder = isClub ? '예시: 또래 상담 멘토링, 영화 감상문 발표, 점자책 만들기' : '예시: 밀도, 순물질과 혼합물, 거울과 렌즈 (키워드로만 입력해도 OK)';
    }

    document.getElementById('case-inp').value = tabStates[area].case || '';
    document.getElementById('subj-inp').value = tabStates[area].subj || '';

    updateKeywords();
}

function selChar(v) {
    charLimit = v;
}

function updateKeywords() {
    selectedKeywords.clear();
    const box = document.getElementById('keyword-pairs');
    box.innerHTML = '';
    if (!keywordDB[area]) return;
    const pos = keywordDB[area].pos || {};
    const neg = keywordDB[area].neg || {};
    // 같은 분류의 같은 순서 단어끼리 짝 (예: 규칙준수 ↔ 무질서)
    for (const category of Object.keys(pos)) {
        (pos[category] || []).forEach((p, i) => {
            const n = (neg[category] || [])[i];
            if (n) box.appendChild(makeKeywordPair(p, n));
        });
    }
}

function pickKeywords(side) {
    return [...selectedKeywords].filter(([, s]) => s === side).map(([kw]) => kw).join(', ');
}

function makeKeywordPair(p, n) {
    const pair = document.createElement('div');
    pair.className = 'kw-pair';
    pair.innerHTML = '<span class="kw-slide"></span>';
    [['pos', p], ['neg', n]].forEach(([side, kw]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = kw;
        btn.onclick = () => {
            const off = pair.dataset.pick === side; // 이미 고른 쪽을 다시 누르면 취소
            selectedKeywords.delete(p); selectedKeywords.delete(n);
            if (off) { delete pair.dataset.pick; return; }
            pair.classList.toggle('kw-instant', !pair.dataset.pick);
            void pair.offsetWidth;
            pair.dataset.pick = side; pair.dataset.side = side;
            selectedKeywords.set(kw, side);
        };
        pair.appendChild(btn);
    });
    return pair;
}

async function runAI() {
    let cases = "";
    if (area === '자율' || area === '진로') {
        if (selectedAutonomyBadges.length === 0) {
            showModal('입력 확인', `${area} 활동 내용을 최소 1개 이상 선택하거나<br>직접 입력해 주세요.`, 'info');
            return;
        }
        cases = selectedAutonomyBadges.map(b => b.text.trim()).filter(t => t.length > 0).join(', ');
    } else {
        cases = document.getElementById('case-inp').value.trim();
        if(!cases) {
            showModal('입력 확인', '활동 내용이나 관찰 기록을<br>먼저 입력해 주세요.', 'info');
            return;
        }
    }

    if (!lsGet(LS_KEY)) {
        showModal('', 'API 키가 필요해요.<br>설정에서 내 Gemini API 키를 넣어 주세요.', 'info');
        openGuide('settings');
        return;
    }

    const btn = document.getElementById('run-btn');
    const loadBar = document.getElementById('loading-bar');
    const loadPercent = document.getElementById('loading-percent');

    btn.disabled = true;

    loadBar.style.width = '6%';
    loadPercent.innerText = '0%';

    const countInput = document.getElementById('student-count');
    validateStudentCount(countInput, true);
    const sentenceCount = Number(countInput.value);

    const chunkSize = 5;
    const chunks = [];

    // 입력 칸 전체가 한 덩어리 재료(가르친 활동 전체 / 한 학생의 여러 행동)이므로
    // 줄 수와 상관없이 모든 요청에 전체 내용을 그대로 보냄. 5문장씩 나눠 요청.
    for (let i = 0; i < sentenceCount; i += chunkSize) {
        chunks.push({ sentenceCount: Math.min(chunkSize, sentenceCount - i), cases });
    }

    const totalChunks = chunks.length;
    let completedCount = 0;
    let allResults = [];
    let accumulatedText = "";

    for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];

        const startPercent = Math.round((completedCount / sentenceCount) * 100);
        const targetPercent = Math.round(((completedCount + chunk.sentenceCount) / sentenceCount) * 100);
        const maxSimulated = startPercent + Math.round((targetPercent - startPercent) * 0.88);

        let currentDisplay = Math.max(startPercent, 6);
        loadBar.style.width = currentDisplay + '%';
        loadPercent.innerText = currentDisplay + '%';

        const progressInterval = setInterval(() => {
            if (currentDisplay < maxSimulated) {
                const step = Math.max(1, Math.ceil((maxSimulated - currentDisplay) * 0.08));
                currentDisplay = Math.min(maxSimulated, currentDisplay + step);
                loadBar.style.width = currentDisplay + '%';
                loadPercent.innerText = currentDisplay + '%';
            }
        }, 220);

        const payload = {
            area: area,
            charLimit: charLimit,
            sentenceCount: chunk.sentenceCount,
            subject: document.getElementById('subj-inp').value,
            cases: chunk.cases,
            posKeywords: pickKeywords('pos'),
            negKeywords: pickKeywords('neg')
        };

        try {
            const res = await callGemini(payload);

            clearInterval(progressInterval);

            if (res.success) {
                completedCount += chunk.sentenceCount;
                const currentProgress = Math.round((completedCount / sentenceCount) * 100);
                loadBar.style.width = currentProgress + '%';
                loadPercent.innerText = currentProgress + '%';

                const rawLines = res.result.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const cleanItems = rawLines.map(line => line.replace(/^(?:\d+[\.\)\-]*\s*)+/, '').trim()).filter(l => l.length > 0);

                if (cleanItems.length === 0) {
                    const cleanRes = res.result.replace(/^(?:\d+[\.\)\-]*\s*)+/, '').trim();
                    allResults.push(cleanRes);
                    accumulatedText += `${completedCount - chunk.sentenceCount + 1}. ${cleanRes}\n`;
                } else {
                    cleanItems.forEach((item, idx) => {
                        const cleanText = item.replace(/^(?:\d+[\.\)\-]*\s*)+/, '').trim();
                        allResults.push(cleanText);
                        const seqNum = completedCount - chunk.sentenceCount + idx + 1;
                        accumulatedText += `${seqNum}. ${cleanText}\n`;
                    });
                }
            } else {
                throw new Error(res.error || "AI 생성 오류가 발생했습니다.");
            }
        } catch (err) {
            clearInterval(progressInterval);
            btn.disabled = false;
            showModal('생성 실패', `생성 진행 중 오류가 발생했습니다.<br>완료된 부분까지만 보관하거나 다시 시도해주세요.<br><br>오류내용: ${translateError(err.toString())}`, 'error');
            return;
        }
    }

    loadBar.style.width = '100%';
    loadPercent.innerText = '100%';

    setTimeout(() => {
        btn.disabled = false;

        rawGeneratedText = accumulatedText.trim();
        renderTable(allResults);
    }, 500);
}

function getByteLength(text) {
    if (!text) return 0;
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (text[i] === '\r') {
            if (i + 1 < text.length && text[i + 1] === '\n') {
                i++;
            }
            bytes += 2;
        } else if (text[i] === '\n') {
            bytes += 2;
        } else if (code <= 0x007f) {
            bytes += 1;
        } else {
            if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
                const nextCode = text.charCodeAt(i + 1);
                if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
                    i++;
                }
            }
            bytes += 3;
        }
    }
    return bytes;
}

function renderTable(items) {
    const tbody = document.getElementById('result-tbody');
    tbody.innerHTML = '';
    items.forEach((item, index) => {
        const cleanText = item.trim().replace(/^(?:\d+[\.\)\-]*\s*)+/, '').trim();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="excel-num">${index + 1}</td><td class="result-cell">${cleanText.replace(/\n/g, '<br>')}</td><td class="excel-byte">${getByteLength(cleanText)} Byte</td>`;
        tbody.appendChild(tr);
    });
    tbody.insertAdjacentHTML('beforeend', FILLER_ROW); // 표 아래 빈 공간 채우기
}

function exportExcel(tableId, fileName) {
    try {
        const bodyTable = document.getElementById(tableId);
        if (!bodyTable.querySelector('tbody tr:not(.filler-row)')) {
            showModal('알림', '다운로드할 문장이 없습니다.', 'info');
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = '<thead><tr><th>순</th><th>특기사항</th><th>글자 수</th></tr></thead>';
        const clonedBody = bodyTable.tBodies[0].cloneNode(true);
        clonedBody.querySelectorAll('.filler-row').forEach(r => r.remove());
        table.appendChild(clonedBody);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);

        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

        ws['!cols'] = [
            { wch: 8 }, 
            { wch: 100 },
            { wch: 14 }
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });

                if (!ws[cell_ref]) continue;

                ws[cell_ref].s = {
                    alignment: { vertical: "center", horizontal: "center", wrapText: true },
                    border: {
                        top: { style: "thin", color: { auto: 1 } }, 
                        bottom: { style: "thin", color: { auto: 1 } },
                        left: { style: "thin", color: { auto: 1 } }, 
                        right: { style: "thin", color: { auto: 1 } }
                    }
                };

                if (R === 0) {
                    ws[cell_ref].s.fill = { fgColor: { rgb: "FDE68A" } }; 
                    ws[cell_ref].s.font = { bold: true, color: { rgb: "334155" }, sz: 12 };
                } else {
                    ws[cell_ref].s.font = { sz: 11 };
                    if (C === 1) ws[cell_ref].s.alignment.horizontal = "left"; 
                    else ws[cell_ref].s.alignment.horizontal = "center";
                }
            }
        }

        XLSX.writeFile(wb, fileName + ".xlsx");

    } catch (err) {
        showModal('오류', '엑셀 파일을 생성하는 중 문제가 발생했습니다.<br>' + err.message, 'error');
    }
}

// ─────────────────────────────────────────────────────────────
// 배포용: 서버 없이 각자 브라우저에서 바로 사용
// - 내 API 키·모델·지침은 이 브라우저(localStorage)에만 저장됨
// - 문장 생성 요청은 브라우저에서 Google Gemini API로 바로 보냄
// ─────────────────────────────────────────────────────────────
const LS_KEY = 'sangdolite_api_key';
const LS_MODEL = 'sangdolite_model';
const LS_GUIDE = 'sangdolite_guide';
const DEFAULT_MODEL = 'gemini-flash-lite-latest'; // 구글이 늘 최신 Flash-Lite로 연결해 주는 이름

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

// 저장된 내 지침, 없거나 망가졌으면 처음 지침
function getGuide() {
    try {
        const g = JSON.parse(lsGet(LS_GUIDE));
        if (g && g.parts && g.order && g.order.behavior && g.order.general) return g;
    } catch (e) {}
    return JSON.parse(JSON.stringify(GUIDE_DEFAULT));
}

// 지침에 학생 자료를 채워 AI에게 보낼 글을 만든다
function buildPrompt(data) {
    const guide = getGuide();
    const P = guide.parts;
    const order = guide.order[data.area === '행동특성' ? 'behavior' : 'general'];
    const [introKey, ...ruleKeys] = order;
    const rules = ruleKeys.map((key, i) => `${i + 1}. ${P[key].title}\n${P[key].body}`).join('\n\n');
    const text = `${P[introKey].body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙] 번호가 앞설수록 중요하며, 규칙이 서로 부딪히면 앞 번호를 따를 것.

${rules}`;
    const vals = {
        '생성 문단 개수': data.sentenceCount,
        '생성 글자 수': data.charLimit,
        '최소 글자 수': Math.round(data.charLimit * 0.85), // 생성 글자 수의 85%
        '영역': data.area,
        '과목': data.subject || '해당 없음',
        '좋은태도': data.posKeywords || '없음',
        '아쉬운태도': data.negKeywords || '없음',
        '입력내용': data.cases
    };
    // 입력 내용 속 중괄호는 건드리지 않도록 지침 쪽 빈칸만 한 번에 바꿈
    return text.replace(/\{(생성 문단 개수|생성 글자 수|최소 글자 수|영역|과목|좋은태도|아쉬운태도|입력내용)\}/g, (_, k) => String(vals[k]));
}

async function askGemini(model, key, prompt) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7, topP: 0.95 },
            safetySettings: ['HARASSMENT', 'HATE_SPEECH', 'SEXUALLY_EXPLICIT', 'DANGEROUS_CONTENT']
                .map(c => ({ category: 'HARM_CATEGORY_' + c, threshold: 'BLOCK_NONE' }))
        })
    });
    let json = {};
    try { json = await res.json(); } catch (e) {}
    return { status: res.status, json };
}

// 문장 생성: 성공하면 { success, result }, 실패하면 { success: false, error }
async function callGemini(data) {
    const key = lsGet(LS_KEY);
    if (!key) return { success: false, error: 'NO_API_KEY' };
    let model = lsGet(LS_MODEL) || DEFAULT_MODEL;
    const prompt = buildPrompt(data);
    let { status, json } = await askGemini(model, key, prompt);
    // 고른 모델이 없어졌으면 기본 모델로 한 번 다시 시도
    const msg = (json.error && json.error.message) || '';
    if ((status === 404 || msg.includes('not found') || msg.includes('no longer available')) && model !== DEFAULT_MODEL) {
        model = DEFAULT_MODEL;
        ({ status, json } = await askGemini(model, key, prompt));
    }
    const cand = json.candidates && json.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    if (status === 200 && parts && parts.length) {
        let text = parts.map(p => p.text || '').join('').trim();
        // 길이 제한으로 중간에 멈췄으면 마지막(끊긴) 문장은 빼고 돌려줌
        if (cand.finishReason === 'MAX_TOKENS') {
            const lines = text.split('\n'); lines.pop(); text = lines.join('\n').trim();
        }
        if (text) return { success: true, result: text };
    }
    const block = json.promptFeedback && json.promptFeedback.blockReason;
    return { success: false, error: (json.error && json.error.message) || (block ? `요청 차단(${block})` : '') || (cand && cand.finishReason ? `생성 미완료(${cand.finishReason})` : `HTTP ${status}`) };
}

// ─────────────────────────────────────────────────────────────
// 설정 페이지 (톱니): 내 API 키·모델, 지침 보기·수정. 비밀번호 없음
// ─────────────────────────────────────────────────────────────
let guideData = null;      // { parts: {key: {title, body}}, order: {behavior: [...], general: [...]} }
let guideKind = 'settings';
let guideEditing = false;
let guideDrafts = {};      // 수정 중인 글 {key: text}
const GUIDE_VAR_LABELS = { '생성 문단 개수': '생성 문장 개수', '최소 글자 수': '최소 글자 수 = 생성 글자 수의 85%' }; // 파란 칸 이름을 화면 이름에 맞춰 보여 줌 (지침 속 이름은 그대로)
const MODEL_SUGGESTIONS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-pro'];
const MODEL_CUSTOM = '__custom'; // 목록에 없는 모델을 직접 적을 때
let settingsModel = '';    // 화면에서 고르는 중인 모델 ('' = 기본)
let settingsCustom = '';

function setWorkVisible(show) {
    document.getElementById('work-main').classList.toggle('hidden-element', !show);
    document.getElementById('work-result').classList.toggle('hidden-element', !show);
    document.getElementById('guide-page').classList.toggle('hidden-element', show);
}

function openGuide(kind) {
    document.querySelectorAll('.area-btn').forEach(b => b.classList.remove('active-main'));
    setWorkVisible(false);
    toggleDrawer(false);
    guideData = getGuide();
    guideEditing = false; guideDrafts = {};
    if (kind) guideKind = kind;
    if (guideKind === 'settings') loadSettingsDraft();
    renderGuide();
}

function showGuideKind(kind) {
    if (guideEditing && Object.keys(changedGuideParts()).length && !confirm('고친 지침을 저장하지 않고 나갈까요?')) return;
    guideEditing = false; guideDrafts = {};
    guideKind = kind;
    if (kind === 'settings') loadSettingsDraft();
    renderGuide();
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderGuide() {
    document.querySelectorAll('.guide-switch button').forEach(b => b.classList.toggle('on', b.dataset.guide === guideKind));
    renderGuideActions();
    if (guideKind === 'settings') return renderSettings();

    const order = guideData.order[guideKind];
    const other = guideData.order[guideKind === 'behavior' ? 'general' : 'behavior'];
    const list = document.getElementById('guide-list');
    list.innerHTML = '';
    order.forEach((key, idx) => {
        const part = guideData.parts[key];
        const text = guideDrafts[key] ?? part.body;
        const tags = other.includes(key) ? '<span class="guide-tag">공통</span>' : '';
        const card = document.createElement('div');
        card.className = 'guide-card' + (idx === 0 ? ' intro' : '');
        card.innerHTML = `<div class="guide-head">${idx === 0 ? '' : `<span class="guide-num">${idx}</span>`}<span class="guide-title">${escapeHtml(part.title)}</span>${tags}</div>`;
        if (guideEditing) {
            const ta = document.createElement('textarea');
            ta.className = 'guide-edit';
            ta.value = text;
            ta.rows = text.split('\n').length + 1;
            ta.oninput = () => { guideDrafts[key] = ta.value; };
            card.appendChild(ta);
        } else {
            const body = document.createElement('div');
            body.className = 'guide-body';
            body.innerHTML = escapeHtml(text).replace(/\{([^{}\n]{1,10})\}/g, (_, name) => `<span class="guide-var">${GUIDE_VAR_LABELS[name] || name}</span>`);
            card.appendChild(body);
        }
        list.appendChild(card);
    });
}

function renderGuideActions() {
    const box = document.getElementById('guide-actions');
    if (guideKind === 'settings') {
        box.innerHTML = '<button type="button" class="guide-btn dark" onclick="saveSettings()">설정 저장</button>';
    } else if (guideEditing) {
        box.innerHTML = '<button type="button" class="guide-btn" onclick="resetGuide()">처음 지침으로</button>'
            + '<button type="button" class="guide-btn" onclick="cancelGuideEdit()">취소</button>'
            + '<button type="button" class="guide-btn dark" onclick="saveGuide()">저장</button>';
    } else {
        box.innerHTML = '<button type="button" class="guide-btn" onclick="guideEditing=true; guideDrafts={}; renderGuide()">수정</button>';
    }
}

function changedGuideParts() {
    const changed = {};
    for (const [key, text] of Object.entries(guideDrafts)) {
        if (text.trim() !== guideData.parts[key].body) changed[key] = text.trim();
    }
    return changed;
}

function cancelGuideEdit() {
    if (Object.keys(changedGuideParts()).length && !confirm('고친 내용을 저장하지 않고 나갈까요?')) return;
    guideEditing = false; guideDrafts = {};
    renderGuide();
}

function saveGuide() {
    const changed = changedGuideParts();
    if (!Object.keys(changed).length) return showModal('', '바뀐 내용이 없어요.', 'info');
    if (Object.values(changed).some(t => !t)) return showModal('', '빈 칸으로는 저장할 수 없어요.', 'info');
    for (const [key, text] of Object.entries(changed)) guideData.parts[key].body = text;
    if (!lsSet(LS_GUIDE, JSON.stringify(guideData))) return showModal('저장 실패', '이 브라우저에 저장하지 못했어요.', 'error');
    guideEditing = false; guideDrafts = {};
    renderGuide();
    showModal('', '저장했어요.<br>이 브라우저의 문장 생성에 바로 적용돼요.', 'info');
}

function resetGuide() {
    if (!confirm('지침 전체를 처음 지침으로 되돌릴까요?\n고친 내용은 모두 사라져요.')) return;
    lsDel(LS_GUIDE);
    guideData = getGuide(); guideEditing = false; guideDrafts = {};
    renderGuide();
}

// ── 내 API 키·모델
function loadSettingsDraft() {
    const m = lsGet(LS_MODEL) || '';
    const known = !m || MODEL_SUGGESTIONS.includes(m);
    settingsModel = known ? m : MODEL_CUSTOM;
    settingsCustom = known ? '' : m;
}

function keepModelDraft() {
    const m = document.getElementById('set-model');
    const c = document.getElementById('set-model-custom');
    if (m) settingsModel = m.value;
    if (c) settingsCustom = c.value.trim();
}

function renderSettings() {
    const key = lsGet(LS_KEY);
    const isCustom = settingsModel === MODEL_CUSTOM;
    document.getElementById('guide-list').innerHTML = `<div class="set-grid">
        <div>
            <div class="step-label">내 API 키</div>
            <div class="set-box">
                ${key ? `<div class="set-key"><span>${escapeHtml(key.slice(0, 4) + '…' + key.slice(-4))}</span><button type="button" class="set-del" aria-label="지우기" title="지우기" onclick="removeApiKey()"><i data-lucide="trash-2"></i></button></div>` : ''}
                <input id="set-newkey" class="set-input" type="password" autocomplete="off" placeholder="${key ? '새 키로 바꾸려면 붙여 넣기' : 'Gemini API 키 붙여 넣기'}">
                <p class="set-hint">이 브라우저에만 저장돼요 · <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">키 발급받기</a></p>
            </div>
        </div>
        <div>
            <div class="step-label">AI 모델</div>
            <div class="set-box">
                <select id="set-model" class="nice-select set-input" onchange="keepModelDraft(); renderSettings()">
                    <option value="">기본 모델 (${DEFAULT_MODEL})</option>
                    ${MODEL_SUGGESTIONS.filter(m => m !== DEFAULT_MODEL).map(m => `<option value="${m}"${m === settingsModel ? ' selected' : ''}>${m}</option>`).join('')}
                    <option value="${MODEL_CUSTOM}"${isCustom ? ' selected' : ''}>직접 입력</option>
                </select>
                ${isCustom ? `<input id="set-model-custom" class="set-input mt-2" placeholder="모델 이름 (예: gemini-3.5-flash)" value="${escapeHtml(settingsCustom)}">` : ''}
            </div>
        </div>
    </div>`;
    lucide.createIcons();
}

function removeApiKey() {
    if (!confirm('저장된 API 키를 이 브라우저에서 지울까요?')) return;
    keepModelDraft();
    lsDel(LS_KEY);
    renderSettings();
}

function saveSettings() {
    keepModelDraft();
    const newKey = (document.getElementById('set-newkey').value || '').trim();
    if (newKey && (/[\s,]/.test(newKey) || newKey.length < 20)) return showModal('', '키 모양이 이상해요.<br>띄어쓰기 없이 키 전체를 붙여 넣어 주세요.', 'info');
    const model = settingsModel === MODEL_CUSTOM ? settingsCustom : settingsModel;
    if (settingsModel === MODEL_CUSTOM && !/^[A-Za-z0-9._\-]{3,80}$/.test(model)) return showModal('', '모델 이름을 확인해 주세요.', 'info');
    if (newKey && !lsSet(LS_KEY, newKey)) return showModal('저장 실패', '이 브라우저에 저장하지 못했어요.<br>시크릿 창이면 일반 창에서 열어 주세요.', 'error');
    if (model) lsSet(LS_MODEL, model); else lsDel(LS_MODEL);
    renderSettings();
    showModal('', lsGet(LS_KEY) ? '설정을 저장했어요.<br>이제 문장을 만들 수 있어요.' : '모델을 저장했어요.<br>문장을 만들려면 API 키를 넣어 주세요.', 'info');
}

// 휴대폰·태블릿: 버거 버튼으로 사이드바 서랍 열고 닫기
function toggleDrawer(open) {
    document.getElementById('sidebar').classList.toggle('open', open);
    document.getElementById('drawer-backdrop').classList.toggle('open', open);
}
