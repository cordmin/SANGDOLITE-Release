// ─────────────────────────────────────────────────────────────
// 생활기록부 보조 점검 (규칙·계산)
// 나이스에서 내려받은 엑셀·PDF를 읽어 「2026학년도 학교생활기록부 기재요령(중학교)」에 맞는지 살펴봄.
// 모든 계산은 브라우저 안에서만 하고, 어디로도 보내지 않음.
// 글자 수(바이트)는 app.js의 getByteLength를 그대로 씀 (한글 3, 영문·숫자·띄어쓰기 1, 엔터 1바이트).
// ─────────────────────────────────────────────────────────────

const RC_SETUK = '과목별 세부능력 및 특기사항';
const RC_PERSONAL = '개인별 세부능력 및 특기사항';
const RC_JAYUL = '자율·자치활동';
const RC_CLUB = '동아리활동';
const RC_CAREER = '진로활동';
const RC_FREE = '자유학기활동';
const RC_HAENG = '행동특성 및 종합의견';

// 영역별 최대 글자 수(바이트) — 2026 기재요령(중학교) '영역별 입력 가능 최대 글자수' 표 (학년 단위)
const RC_DEFAULT_SETTINGS = {
    limits: { [RC_SETUK]: 1500, [RC_PERSONAL]: 1500, [RC_JAYUL]: 1500, [RC_CLUB]: 1500, [RC_CAREER]: 1500, [RC_FREE]: 3000, [RC_HAENG]: 900, '기타': 1500 },
    off: []            // 끈 점검 항목 (RC_TYPES 열쇠)
};

// 점검 종류 (화면 탭 순서)
const RC_TYPES = {
    forbid: '기재 요령',
    length: '최대 글자수',
    spell: '맞춤법',
    ending: '종결 어미',
    similar: '똑같은 문장',
    empty: '미입력 항목'
};

// ───────── 점검 지침 (관리자 페이지 '생활기록부 점검 지침'에서 고치면 서버에 저장되고 모두에게 적용) ─────────
// 아래는 처음 지침. 서버에 저장된 지침이 있으면 rcApplyGuide()로 바꿔 끼움.
// words·wrong: 찾을 낱말을 쉼표로 이어 씀. 낱말 속 띄어쓰기는 '띄어 써도 붙여 써도 찾음'. 관리자가 고치는 칸
// find: 낱말로 나타낼 수 없는 '자동 규칙'(정규식). 관리자 화면에는 findNote(쉬운 설명)만 보이고 그대로 지켜짐
// level: 'no' = 기재 불가, 'check' = 확인 필요. allowIn: 이 영역에서는 넘어감, skip: 찾은 말이 이 낱말이면 넘어감

// 기재 점검 내용 (2026 기재요령 '학교생활기록부 작성 시 유의사항'·영역별 기재요령)
const RC_DEFAULT_FORBID = [
    { level: "no", label: "대회", words: "대회, 경진, 경시, 올림피아드, 공모전", why: "'대회'라는 말과 대회 참가·준비 사실은 수상경력 말고는 쓸 수 없어요. 행사로 이름만 바꿔 써도 안 돼요." },
    { level: "no", label: "수상 사실", words: "입상, 표창, 감사장, 공로상, 최우수상, 우수상, 장려상, 금상, 은상", find: "수상(?!자|스키|하)", findNote: "'수상'이라는 말도 찾아요. 단, '수상자', '수상스키', '수상하다'는 빼요.", why: "상을 받은 사실은 수상경력에만 써요." },
    { level: "no", label: "교외상", words: "대통령 상, 국무총리 상, 장관 상, 교육감 상, 도지사 상, 시장 상, 군수 상, 구청장 상, 국회의원 상, 이사장 상, 회장 상", why: "교외 기관·단체에서 받은 상은 쓸 수 없어요." },
    { level: "no", label: "공인어학시험", words: "토익, 토플, 텝스, 오픽, TOEIC, TOEFL, TEPS, IELTS, OPIc, HSK, JLPT, JPT, DELF, DALF, TestDaF, TORFL, DELE, 상공회의소 한자, 한자 능력 검정, 실용 한자, 한자 급수, 상무 한검, 한자 자격 검정", find: "\\bZD\\b|\\bDSH\\b|\\bDSD\\b", findNote: "독일어 시험 ZD·DSH·DSD도 찾아요. 다른 영어 낱말 속에 섞인 글자는 빼요.", why: "공인어학시험 참여 사실과 성적은 쓸 수 없어요." },
    { level: "no", label: "인증시험", words: "인증 시험, 검정 시험, 급수 시험, 급수 취득", find: "\\d\\s*급\\s*(?:취득|합격)", findNote: "'3급 취득', '2급 합격'처럼 숫자 + 급 + 취득·합격도 찾아요.", why: "교내외 인증시험 참여 사실이나 성적은 쓸 수 없어요." },
    { level: "no", label: "자격증", words: "자격증, 컴퓨터 활용 능력, 한국사 능력 검정, 워드 프로세서", find: "[가-힣]+기능사|\\bITQ\\b|\\bGTQ\\b|\\bMOS\\b", findNote: "'제빵기능사', '조리기능사'처럼 '기능사'로 끝나는 모든 자격증과 ITQ·GTQ·MOS도 찾아요.", why: "자격증 이름과 취득 사실은 쓸 수 없어요." },
    { level: "no", label: "해외 활동", words: "어학 연수, 해외 연수, 해외 봉사, 해외 탐방, 해외 캠프, 해외 활동", why: "어학연수·봉사 같은 해외 활동은 쓸 수 없어요." },
    { level: "no", label: "사교육", words: "과외, 인터넷 강의, 인강", find: "(?<!대)학원", findNote: "'학원'도 찾아요. 단, '대학원'은 빼요.", why: "사교육과 관련된 내용은 쓸 수 없어요." },
    { level: "no", label: "특허·지식재산권", words: "특허, 실용신안, 지식 재산권, 상표 출원, 상표 등록, 디자인 출원, 디자인 등록", why: "특허·실용신안·상표·디자인 출원이나 등록 사실은 쓸 수 없어요." },
    { level: "no", label: "도서 출간", words: "저서, 책 출간, 책을 출간, 책 출판, 책을 출판, 도서 출간, 도서 출판, 시집 발간, 소설 출간, 출간함, 출간했, 출간하여", why: "책을 펴낸 사실은 쓸 수 없어요." },
    { level: "no", label: "논문·학회 발표", words: "학회지, 학회 발표, 학회에서 발표, 학술지 게재, 학술지에 게재, 논문 게재, 논문 투고, 논문 등재", why: "논문 투고·등재, 학회 발표 사실은 쓸 수 없어요." },
    { level: "no", label: "부모·친인척 지위", words: "", find: "(?:아버지|어머니|부모님?|아빠|엄마|부친|모친|친척|삼촌|외삼촌|이모|고모|큰아버지|작은아버지|할아버지|할머니)[가-힣\\s]{0,10}?(?:의사|변호사|판사|검사|교수|대표|사장|회장|임원|국회의원|CEO|공무원|교사|회사|기업|병원|직장|근무|운영|직업|직위)", findNote: "아버지·어머니·부모님·삼촌 같은 가족 낱말 뒤 10글자 안에 의사·변호사·교수·대표·공무원·회사·병원·근무·직업 같은 말이 오면 찾아요.", why: "부모·친인척의 직업·직장·직위를 짐작할 수 있는 내용은 쓸 수 없어요." },
    { level: "no", label: "장학생·장학금", words: "장학금, 장학생", why: "장학생·장학금 관련 내용은 쓸 수 없어요." },
    { level: "no", label: "대학 이름", words: "", find: "[가-힣]{2,}대학교|[가-힣]{2,}대(?:학)?\\s*(?:교수|병원|부설)", findNote: "'서울대학교'처럼 '대학교'로 끝나는 모든 대학 이름과, '○○대 교수', '○○대 병원', '○○대 부설'을 찾아요. '○○대학교'처럼 이름을 가린 건 빼요.", why: "구체적인 대학 이름은 쓸 수 없어요." },
    { level: "no", label: "K-MOOC·KOCW", words: "K-MOOC, KMOOC, MOOC, KOCW, 무크", why: "K-MOOC·MOOC·KOCW 관련 내용은 쓸 수 없어요." },
    { level: "no", label: "방과후학교", words: "방과 후 학교, 방과 후 수업, 방과 후 교실, 방과 후 활동, 방과 후 프로그램", why: "방과후학교 활동은 쓸 수 없어요." },
    { level: "no", label: "소논문·연구보고서", words: "소논문, 연구 보고서, R&E", why: "소논문·연구보고서의 제목·주제·참여 인원 같은 실적은 쓸 수 없어요. 세특에는 작성 관련 사항도 쓸 수 없어요." },
    { level: "check", label: "기관·단체·상호명", words: "", find: "[가-힣A-Za-z]{2,}(?:재단|협회|연구원|연구소|박물관|미술관|과학관|기념관|센터|주식회사|생태원|수목원|식물원|천문대)|㈜", findNote: "'○○재단', '○○협회', '○○연구소', '○○박물관', '○○과학관', '○○센터', '○○생태원', '○○수목원'처럼 끝나는 모든 기관 이름과 '㈜'를 찾아요.", why: "구체적인 기관·단체·상호 이름은 쓸 수 없어요. 교육부·교육청 같은 교육관련기관은 써도 돼요." },
    { level: "check", label: "강사 이름", words: "", find: "(?<![가-힣])[가-힣]{2,4}\\s*(?:강사|작가|박사|교수)(?:님)?(?:의|을|를|와|과|에게|이|가)?\\s*(?:강연|특강|강의|초청)", findNote: "'홍길동 강사의 특강', '김○○ 작가 초청 강연'처럼 이름(2~4글자) + 강사·작가·박사·교수 + 강연·특강·강의·초청을 찾아요.", why: "강의를 한 강사의 이름은 쓸 수 없어요." },
    { level: "no", label: "영재교육기관 이름", words: "", find: "[가-힣]{2,}(?:교육청|교육지원청|대학교|대학|중학교|초등학교|고등학교)\\s*(?:부설\\s*)?[가-힣]{0,4}영재\\s*(?:교육원|학급|학교)", findNote: "'천안교육지원청 영재교육원', '○○대학교 부설 과학영재교육원'처럼 기관 이름이 붙은 영재교육원·영재학급을 찾아요.", why: "영재교육 이수내용에도 기관 이름은 쓰지 않아요. '영재교육원', '영재학급'처럼만 쓰세요." },
    { level: "no", label: "영재교육(세특 제외)", words: "영재 교육원, 영재 학급, 영재 학교, 영재 교육", why: "영재교육 내용은 과목별 세특의 '영재교육 기록사항'에만 쓸 수 있어요.", allowIn: [RC_SETUK, RC_PERSONAL] },
    { level: "check", label: "성적·등급·석차", words: "모의고사, 모의평가, 내신 등급, 석차, 백분위", find: "[1-9]\\s*등급|전교\\s*\\d+\\s*등", findNote: "'1등급'~'9등급', '전교 3등'처럼 숫자가 들어간 등급·등수도 찾아요.", why: "시험 성적·등급·석차는 특기사항에 쓰지 않아요. (학생건강체력평가 1등급은 체육 세특에 쓸 수 있어요.)" },
    { level: "check", label: "영어 낱말", words: "", find: "\\b[A-Za-z][A-Za-z]+\\b", findNote: "영어로 된 모든 낱말을 찾아요. 단, CEO·PD·UCC·IT·POP·CF·TV·PAPS·SNS·PPT·AI는 빼요.", why: "문자는 한글로 써요. 외국인 이름, 책 이름 같은 고유명사나 CEO·SNS·AI 같은 일반화된 말은 써도 돼요.", skip: "CEO|PD|UCC|IT|POP|CF|TV|PAPS|SNS|PPT|AI" }
];

// 맞춤법 점검 내용 (자주 틀리는 말 → 바른 말)
// 사전이 놓치는 띄어쓰기·문맥 표현과 짧은 어절만 보완 규칙으로 유지함.
const RC_DEFAULT_SPELL = [
    {
        "wrong": "몇 일",
        "right": "며칠"
    },
    {
        "wrong": "됬",
        "right": "됐"
    },
    {
        "wrong": "구지",
        "right": "굳이"
    },
    {
        "wrong": "문안하",
        "right": "무난하"
    },
    {
        "wrong": "할께",
        "right": "할게"
    },
    {
        "wrong": "않 하",
        "right": "안 하"
    },
    {
        "wrong": "않 되",
        "right": "안 되"
    },
    {
        "wrong": "바램",
        "right": "바람"
    }
];

// 예전 저장 지침에 남은 동일한 기본 예시만 정리함. 수정한 교정안과 새 규칙은 유지함.
const RC_RETIRED_SPELL = [{"wrong":"금새","right":"금세"},{"wrong":"역활","right":"역할"},{"wrong":"희안","right":"희한"},{"wrong":"오랫만","right":"오랜만"},{"wrong":"일일히","right":"일일이"},{"wrong":"깨끗히","right":"깨끗이"},{"wrong":"곰곰히","right":"곰곰이"},{"wrong":"틈틈히","right":"틈틈이"},{"wrong":"꼼꼼이","right":"꼼꼼히"},{"wrong":"솔직이","right":"솔직히"},{"wrong":"일찌기","right":"일찍이"},{"wrong":"더우기","right":"더욱이"},{"wrong":"갯수","right":"개수"},{"wrong":"촛점","right":"초점"},{"wrong":"댓가","right":"대가"},{"wrong":"어의없","right":"어이없"},{"wrong":"내노라","right":"내로라"},{"wrong":"설겆이","right":"설거지"},{"wrong":"뵈요","right":"봬요"},{"wrong":"왠만","right":"웬만"},{"wrong":"웬지","right":"왠지"},{"wrong":"어떻해","right":"어떡해"},{"wrong":"할려고","right":"하려고"},{"wrong":"넓따","right":"널따"},{"wrong":"짧다랗","right":"짤따랗"},{"wrong":"가르켜","right":"가르쳐"}];

// 늘 살펴보는 표기 규칙 (관리자 지침과 상관없이 고정)
const RC_SPELL_FIXED = [
    [/([을할볼될갈올알줄낼칠쓸])수\s?있/g, '$1 수 있'],
    [/ {2,}/g, '띄어쓰기 한 번'], [/ +([.,])/g, '$1'],
    // 기재요령: 서술형 항목에 특수문자·문단 구분 기호(번호)는 쓰지 않음
    [/^[ \t]*(?:\d{1,2}[.)](?!\d)|[①-⑳]|[-•▪](?=\s))[ \t]*/gm, '번호·기호'], // ★ 같은 특수문자는 아래 규칙에서 한 번만 잡음
    [/[★☆♥♡◆◇■□▶▷◀◁※♣♠◎]/g, '특수문자']
];
// 바로 고쳐 줄 수 없는 것(설명만 보여 줌)
const RC_SPELL_NOTE = {
    '띄어쓰기 한 번': '띄어쓰기가 두 번 이상 들어갔어요.',
    '번호·기호': '문단 앞 번호나 기호는 쓰지 않아요.',
    '특수문자': '서술형 항목에는 특수문자를 쓰지 않아요.'
};

// 영역별 입력 가능 최대 글자수 (2026 기재요령 중학교 162쪽 중 보조 점검이 실제로 살펴보는 영역만). key 영역의 글자 수로 점검함
const RC_DEFAULT_LIMITS = [
    { group: '창의적 체험활동상황', item: '자율·자치활동 특기사항', max: '500', key: RC_JAYUL },
    { group: '창의적 체험활동상황', item: '동아리활동 특기사항', max: '500', key: RC_CLUB },
    { group: '창의적 체험활동상황', item: '진로활동 특기사항', max: '500', key: RC_CAREER },
    { group: '자유학기활동상황', item: '진로탐색활동 특기사항', max: '1000', key: RC_FREE },
    { group: '자유학기활동상황', item: '주제선택활동 특기사항', max: '1000', key: RC_FREE },
    { group: '자유학기활동상황', item: '예술·체육활동 특기사항', max: '1000', key: RC_FREE },
    { group: '자유학기활동상황', item: '동아리활동 특기사항', max: '1000', key: RC_FREE },
    { group: '교과학습발달상황', item: '과목별 세부능력 및 특기사항', max: '500', key: RC_SETUK },
    { group: '교과학습발달상황', item: '개인별 세부능력 및 특기사항', max: '500', key: RC_PERSONAL },
    { group: '행동특성 및 종합의견', item: '행동특성 및 종합의견', max: '300', key: RC_HAENG }
];

const RC_DEFAULT_GUIDE = { forbid: RC_DEFAULT_FORBID, spell: RC_DEFAULT_SPELL, limits: RC_DEFAULT_LIMITS };
let RC_GUIDE = RC_DEFAULT_GUIDE;   // 지금 쓰는 지침
let RC_FORBID_RULES = [];          // 지침을 정규식으로 바꾼 것
let RC_SPELL_RULES = [];

// 쉼표 낱말 목록 + 자동 규칙 → 찾기 규칙 하나로 (낱말 속 기호는 글자 그대로, 띄어쓰기는 '띄어 써도 붙여 써도')
function rcPattern(words, find) {
    const list = String(words || '').split(',').map(w => w.trim()).filter(Boolean)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));
    return [find, ...list].filter(Boolean).join('|');
}

// 지침(자료)을 점검에 쓰는 모양으로 바꿈. 잘못된 찾을 말은 건너뜀
function rcLimitNumber(value) {
    const text = String(value ?? '').trim();
    // 예전 저장값(500자, 1,000자, 과목별 500자)을 숫자로 이관함.
    const match = text.match(/^(?:과목별\s*)?([0-9]+(?:,[0-9]{3})*)\s*자?$/);
    const n = match ? Number(match[1].replace(/,/g, '')) : NaN;
    return Number.isSafeInteger(n) && n > 0 ? String(n) : '';
}

function rcApplyGuide(guide) {
    const original = guide && Array.isArray(guide.forbid) ? guide : RC_DEFAULT_GUIDE;
    const savedLimits = original.limits || [];
    const fixedLimits = RC_DEFAULT_LIMITS.map(base => {
        const sameArea = savedLimits.filter(row => row.key === base.key);
        const saved = sameArea.find(row => row.item === base.item) || (sameArea.length === 1 ? sameArea[0] : null);
        return { ...base, max: rcLimitNumber(saved?.max) || base.max };
    });
    const g = { ...original, limits: fixedLimits, spell: (original.spell || []).filter(row => row.find || !RC_RETIRED_SPELL.some(old => old.wrong === row.wrong && old.right === row.right)) };
    const re = (s, flags) => { try { return s ? new RegExp(s, flags) : null; } catch (e) { return null; } };
    RC_GUIDE = g;
    RC_FORBID_RULES = g.forbid.map(r => ({ ...r, re: re(rcPattern(r.words, r.find), 'gi'), skip: r.skip ? re('^(?:' + r.skip + ')$', 'i') : null })).filter(r => r.re);
    RC_SPELL_RULES = (g.spell || []).map(r => [re(rcPattern(r.wrong, r.find), 'g'), r.right]).filter(([r]) => r).concat(RC_SPELL_FIXED);
    // 한글 글자 수 × 3바이트. 자유학기는 세부 활동별 기준도 각각 적용함.
    const limits = { ...RC_BASE_LIMITS }, got = {};
    for (const row of g.limits || []) {
        const n = parseInt(String(row.max || '').replace(/[^0-9]/g, ''), 10);
        if (row.key && n) {
            got[row.key] = limits[row.key] = Math.max(got[row.key] || 0, n * 3);
            if (row.key === RC_FREE) limits[row.key + '|' + row.item.replace(/\s*특기사항.*$/, '')] = n * 3;
        }
    }
    RC_DEFAULT_SETTINGS.limits = limits;
}
const RC_BASE_LIMITS = { ...RC_DEFAULT_SETTINGS.limits };
rcApplyGuide(RC_DEFAULT_GUIDE);

function rcEscape(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ───────── 엑셀 읽기 ─────────
// 나이스 엑셀은 위쪽에 제목 줄이 몇 줄 있고, 그 아래 '성명' 같은 머리글 줄이 있음.
// 긴 글은 여러 줄로 나뉘어 있기도 해서, 이름 없이 글만 있는 줄은 바로 위 학생 글에 이어 붙임.
const RC_HEAD = {
    grade: /^학\s*년$/, cls: /^반$/, term: /^학\s*기$/, num: /^번\s*호?$/, name: /성\s*명|^이\s*름$/,
    subject: /과\s*목/, part: /영\s*역|활\s*동\s*명|^구\s*분$/,
    text: /특\s*기\s*사\s*항|종\s*합\s*의\s*견|세\s*부\s*능\s*력|활\s*동\s*내\s*용|^내\s*용$/
};

function rcGuessArea(...hints) {
    const s = hints.filter(Boolean).join(' ');
    if (/행동|행특|종합\s*의견/.test(s)) return RC_HAENG;
    if (/자유\s*학기|진로\s*탐색|주제\s*선택|예술\s*[·･]?\s*체육/.test(s)) return RC_FREE;
    if (/개인별/.test(s)) return RC_PERSONAL;
    if (/자율|자치/.test(s)) return RC_JAYUL;
    if (/동아리|스포츠/.test(s)) return RC_CLUB;
    if (/진로/.test(s)) return RC_CAREER;
    if (/세특|세부|교과|과목/.test(s)) return RC_SETUK;
    return null;
}

function rcParseRows(rows, sheetName = '', fileName = '') {
    const cell = (r, c) => (c == null || !r ? '' : String(r[c] ?? '').trim());
    const headOf = r => {
        const found = {};
        (r || []).forEach((v, c) => {
            const t = String(v ?? '').trim();
            for (const [k, re] of Object.entries(RC_HEAD)) if (found[k] == null && re.test(t)) found[k] = c;
        });
        return found;
    };
    let headRow = -1, col = {};
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const found = headOf(rows[i]);
        if (found.name != null) { headRow = i; col = found; break; }
    }
    // 중간에 칸 배치가 다른 머리글이 나오면(< 체육·예술 > 아래) 거기서부터 따로 읽음
    for (let j = headRow + 2; headRow >= 0 && j < rows.length; j++) {
        const f = headOf(rows[j]);
        if (f.name == null || f.text == null || JSON.stringify(f) === JSON.stringify(col)) continue;
        const head = rcParseRows(rows.slice(0, j), sheetName, fileName), rest = rcParseRows(rows.slice(j), sheetName, fileName);
        rest.forEach(r => { r.grade ||= head[0]?.grade || ''; r.cls ||= head[0]?.cls || ''; });
        return [...head, ...rest];
    }
    // 나이스 창체·자유학기는 머리글이 두 줄 (번호·성명 | 영역·특기사항)
    const headRows = headRow >= 0 ? [rows[headRow] || []] : [];
    const next = rows[headRow + 1] || [];
    if (headRow >= 0 && !next.some(v => RC_HEAD.name.test(String(v ?? '').trim()))) {
        let more = false;
        next.forEach((v, c) => {
            const t = String(v ?? '').trim();
            for (const k of ['part', 'text']) if (t.length <= 12 && col[k] == null && RC_HEAD[k].test(t)) { col[k] = c; more = true; }
        });
        if (more) { headRows.push(next); headRow++; }
    }
    const headWords = new Set(headRows.flat().map(v => rcNorm(String(v ?? ''))).filter(Boolean));
    const data = rows.slice(headRow + 1);

    // 글 칸: 머리글로 못 찾았으면 글이 가장 긴 칸
    if (col.text == null) {
        const total = {};
        data.forEach(r => (r || []).forEach((v, c) => { if (c !== col.name) total[c] = (total[c] || 0) + String(v ?? '').length; }));
        const best = Object.entries(total).sort((a, b) => b[1] - a[1])[0];
        if (best) col.text = Number(best[0]);
    }
    if (col.name == null) {
        const hits = {};
        data.forEach(r => (r || []).forEach((v, c) => { if (/^[가-힣]{2,4}$/.test(String(v ?? '').trim())) hits[c] = (hits[c] || 0) + 1; }));
        const best = Object.entries(hits).filter(([c]) => Number(c) !== col.text).sort((a, b) => b[1] - a[1])[0];
        if (best) col.name = Number(best[0]);
    }
    if (col.text == null) return [];

    const headText = headRow >= 0 ? (rows[headRow] || []).join(' ') : '';
    const sheetArea = rcGuessArea(headText.match(RC_HEAD.text)?.[0], sheetName, fileName);
    const out = [];
    let last = null, carry = {};
    const RC_CLASS_CELL = /^([1-6])\s*학년\s*(\d{1,2})\s*반$/;
    for (const r of rows.slice(0, headRow)) for (const v of r || []) {   // 머리글 위 '1학년 1반'
        const m = String(v ?? '').trim().match(RC_CLASS_CELL);
        if (m) { carry.grade = m[1]; carry.cls = m[2]; }
    }
    for (const r of data) {
        const text = /^희망\s*분야$/.test(cell(r, col.text)) ? '' : cell(r, col.text);   // 진로활동 희망분야는 특기사항이 아님
        // 나이스 엑셀은 인쇄 쪽 모양 그대로라 쪽마다 '1학년 1반', 머리글, '1 / 55 ○○중학교'가 다시 나옴
        if (!text) {
            const cm = (r || []).map(v => String(v ?? '').trim().match(RC_CLASS_CELL)).find(Boolean);
            if (cm) { carry.grade = cm[1]; carry.cls = cm[2]; continue; }
            if ((r || []).some(v => String(v ?? '').trim() === '/')) continue;
        }
        if ([col.name, col.text, col.part, col.subject].some(c => headWords.has(rcNorm(cell(r, c))))) continue;
        if (/^<.*>$/.test(rcNorm(cell(r, col.subject)))) continue;   // < 체육·예술(음악/미술) >
        // 합쳐진 칸 때문에 비어 보이는 학년·반·번호·이름·과목은 위 줄 값을 이어 씀
        const newKind = !!(cell(r, col.subject) || cell(r, col.part)); // 같은 학생의 다른 과목·영역 줄
        for (const k of ['grade', 'cls', 'term', 'num', 'name', 'subject', 'part']) { const v = cell(r, col[k]); if (v) carry[k] = v; }
        let name = cell(r, col.name);
        if (!name) {
            if (!newKind || !carry.name) {
                if (text && last) last.text += text;
                continue;
            }
            name = carry.name;
        }
        if (RC_HEAD.name.test(name)) continue; // 중간에 다시 나오는 머리글 줄
        const rec = {
            grade: carry.grade || '', cls: carry.cls || '', num: cell(r, col.name) ? cell(r, col.num) : carry.num || '', name,
            subject: col.subject != null ? carry.subject || '' : '',
            area: rcGuessArea(col.part != null ? carry.part : '') || sheetArea || (col.subject != null ? RC_SETUK : '기타'),
            text, term: carry.term || ''
        };
        if (col.part != null && carry.part && (rec.area === RC_FREE || !rcGuessArea(carry.part))) rec.subject = rec.subject || rcNorm(carry.part);
        // 쪽이 넘어가며 이름이 다시 찍힌 줄: 같은 학생·영역·과목·학기면 앞 글에 이어 붙임
        if (last && ['num', 'name', 'area', 'subject', 'term'].every(k => last[k] === rec[k])) { last.text += text; continue; }
        out.push(last = rec);
    }
    return rcSplitSubjects(out).map(({ term, ...rec }) => rec);
}

// 학생 한 칸에 모든 과목이 든 세특 '국어(자유학기): …⏎과학(자유학기): …' → 과목마다 따로 점검
// 과목 머리는 글 맨 앞·줄 맨 앞·문장 끝 바로 뒤에 옴 (쪽이 넘어가면 줄바꿈 없이 '…함.과학(자유학기):'로 붙기도 함)
const RC_SUBJ_HEAD = /(?:^|\n|(?<=[.!?]))[ \t]*(?:\(([12])\s*학기\)\s*)?([가-힣A-Za-z][가-힣A-Za-z0-9ⅠⅡⅢ·]{0,12})(?:\s*\([^()\n]{1,12}\))?\s*[:：][ \t]*/g;
function rcSplitSubjects(recs) {
    return recs.flatMap(rec => {
        const heads = rec.area === RC_SETUK && !rec.subject ? [...rec.text.matchAll(RC_SUBJ_HEAD)] : [];
        if (!heads.length || heads[0].index !== 0) return [rec];
        return heads.map((m, i) => ({
            ...rec, subject: m[1] ? `${m[2]}(${m[1]}학기)` : m[2],
            text: rec.text.slice(m.index + m[0].length, heads[i + 1]?.index ?? rec.text.length).trim()
        }));
    });
}

// ───────── PDF 읽기 ─────────
// 나이스 학교생활기록부 PDF에서 뽑은 글 줄(쪽마다 줄 배열)을 학생·영역별 기록으로 나눔.
// 표 모양이 쪽마다 조금씩 달라서, 칸 제목과 줄 머리(자율활동, '국어:' 등)를 보고 짐작함.
const RC_PDF_SKIP_SECTION = /인적\s*·?\s*학적|학적\s*사항|출결\s*상황|수상\s*경력|자격증|봉사\s*활동\s*실적|독서\s*활동|교과\s*학습\s*발달\s*상황\s*$/;
const RC_PDF_NOISE = /^\s*(?:-?\s*\d+\s*-?|\d+\s*\/\s*\d+|\d+\s*쪽)\s*$|출력일|발급|본\s*(?:문서|증명서)|^\s*학교생활기록부\s*$|^\s*(?:학년|과\s*목|영\s*역|시\s*간|특\s*기\s*사\s*항|\s)+$/;
const RC_PDF_ACT = /^(?:([1-3])\s+)?(자율(?:\s*[·･]\s*자치)?|동아리|진로)\s*활동\s*(?:\d+\s*(?:시간)?)?\s*(.*)$/;
const RC_PDF_FREE = /^(?:([1-3])\s+)?(?:[12]\s*학기\s+)?(진로\s*탐색|주제\s*선택|예술\s*[·･]?\s*체육|동아리)\s*활동\s*(?:\d+\s*(?:시간)?)?\s*(.*)$/;
const RC_PDF_SUBJ = /^(?:\(\s*[12]\s*학기\s*\)\s*)?([가-힣A-Za-z][가-힣A-Za-z0-9ⅠⅡⅢ·\s]{0,14}?)\s*[:：]\s*(.*)$/;

// 줄이 바뀌는 자리에 원래 띄어쓰기가 있었는지: PDF에서 알아낸 값(endSp)이 있으면 그대로 쓰고,
// 없으면 한국어 끝말로 짐작함 (다음 줄이 '을·에서·함' 같은 조사·어미로 시작하면 붙이고, 앞 줄이 조사·어미·문장부호로 끝나면 띄움)
const RC_WORD_END = /([을를은는이가에의와과로도만며고서여면나지게니든요함음임됨듯것등및중때후전내외간]|[.,)\]’”'"·…:;!?%])$/;
const RC_NEXT_JOSA = /^([을를은는이가에의와과로도만함음임됨]|으로|에서|에게|하고|하며|하여|했|하였|하는|하기|한|할|된|되|적|성|화|들)([\s.,)]|$)/;
function rcWrapSpace(prev, next, endSp) {
    if (endSp) return true;   // 나이스 PDF는 줄 끝 띄어쓰기를 빼고 찍기도 해서 '없음'은 믿지 않고 아래로 짐작함
    if (/^[.,)\]’”'"·…:;!?%]/.test(next) || RC_NEXT_JOSA.test(next)) return false;
    return RC_WORD_END.test(prev.trim());
}

function rcParsePdfLines(pages, fileName = '') {
    const out = [];
    let who = { grade: '', cls: '', num: '', name: '' };
    let section = null, last = null, lastEnd = null;
    let endSp = null;   // 지금 줄 끝에 띄어쓰기가 있었는지 (모르면 null)
    const start = (area, subject, text, grade) => {
        if (!who.name) return null;
        last = { grade: grade || who.grade, cls: who.cls, num: who.num, name: who.name, subject: subject || '', area, text: text || '' };
        lastEnd = endSp;
        out.push(last);
        return last;
    };
    const append = t => {
        if (!last || !t) return;
        last.text += (last.text && rcWrapSpace(last.text, t, lastEnd) ? ' ' : '') + t;
        lastEnd = endSp;
    };

    for (const lines of pages) {
        for (const raw of lines) {
            // 줄은 글자만 있거나, rcGroupLines가 만든 { text, endSp } 모양
            endSp = typeof raw === 'string' ? null : raw.endSp;
            const line = (typeof raw === 'string' ? raw : raw.text).replace(/\s+/g, ' ').trim();
            if (!line) continue;

            // 학생 바뀜: '1학년 3반 12번', '성명 홍길동'
            // '성명'은 줄 맨 앞이나 '…번' 바로 뒤에 있을 때만 이름으로 봄 (본문 속 '성명 제외', '성명： 성별：'은 이름이 아님)
            const g = line.match(/([1-3])\s*학년\s*(\d{1,2})\s*반\s*(\d{1,2})\s*번/);
            const n = line.match(/(?:^|\d\s*번\s*)성\s*명\s*[:：]?\s*([가-힣]{2,5})(?![가-힣])(?!\s*[:：])/);
            if (g || n) {
                const next = { grade: g ? g[1] : who.grade, cls: g ? g[2] : who.cls, num: g ? g[3] : who.num, name: n ? n[1] : who.name };
                if (next.name !== who.name || next.num !== who.num) { last = null; section = null; }
                who = next;
                continue;
            }

            // 영역 제목
            if (/행동\s*특성\s*및\s*종합\s*의견/.test(line)) { section = 'haeng'; last = null; continue; }
            if (/세부\s*능력\s*및\s*특기\s*사항/.test(line)) { section = 'setuk'; last = null; continue; }
            if (/창의적\s*체험\s*활동/.test(line)) { section = 'cc'; last = null; continue; }
            if (/자유\s*학기\s*활동/.test(line)) { section = 'free'; last = null; continue; }
            if (RC_PDF_SKIP_SECTION.test(line)) { section = 'skip'; last = null; continue; }
            if (RC_PDF_NOISE.test(line) || section === 'skip' || !section) continue;

            if (section === 'free') {
                const m = line.match(RC_PDF_FREE);
                if (m) { start(RC_FREE, m[2].replace(/\s+/g, '') + '활동', m[3], m[1]); continue; }
                append(line);
            } else if (section === 'cc') {
                const m = line.match(RC_PDF_ACT);
                if (m) { start(rcGuessArea(m[2]), '', m[3], m[1]); continue; }
                append(line);
            } else if (section === 'setuk') {
                const m = line.match(RC_PDF_SUBJ);
                if (m) { start(RC_SETUK, m[1].trim(), m[2]); continue; }
                append(line);
            } else if (section === 'haeng') {
                const m = line.match(/^([1-3])\s+(.+)$/);
                if (m || !last) { start(RC_HAENG, '', m ? m[2] : line, m ? m[1] : ''); continue; }
                append(line);
            }
        }
    }
    return out;
}

// ───────── PDF 글 조각 → 줄 ─────────
// 조각: { s: 글자, x, y(위로 갈수록 큼), w: 폭, h: 글자 크기, sp: 띄어쓰기 조각인지, spAfter: 뒤에 띄어쓰기가 있었는지 }
// 띄어쓰기 조각은 폭 값이 엉터리라 위치 계산에 쓰지 않음
function rcJoinItems(items) {
    let text = '', end = null;
    for (const it of items) {
        if (it.sp) { if (text && !text.endsWith(' ')) text += ' '; continue; }
        if (end !== null && it.x - end > it.h * 0.25 && !text.endsWith(' ')) text += ' ';
        text += it.s;
        end = it.x + it.w;
    }
    return text.replace(/\s+/g, ' ').trim();
}

// 위→아래로 놓고, 높이 차이가 글자 크기의 45% 안이면 같은 줄로 묶음
function rcGroupLines(parts) {
    parts = [...parts].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const p of parts) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.y - p.y) <= Math.max(2, Math.min(last.h, p.h) * 0.45)) {
            // 굵은 글씨를 같은 자리에 두 번 찍은 PDF('1 1 / / 26 26')는 한 번만 셈
            if (!last.items.some(q => q.s === p.s && Math.abs(q.x - p.x) < 1)) last.items.push(p);
        }
        else lines.push({ y: p.y, h: p.h, items: [p] });
    }
    for (const ln of lines) {
        ln.items.sort((a, b) => a.x - b.x);
        ln.words = ln.items.filter(i => !i.sp);
        ln.text = rcJoinItems(ln.items);
        const lw = ln.words[ln.words.length - 1];
        ln.endSp = lw ? lw.spAfter ?? null : null;
    }
    return lines.filter(ln => ln.words.length);
}

// ───────── 표 모양 PDF ─────────
// 나이스에서 반 전체를 '번호 | 성명 | 학년 | 특기사항' 표로 출력한 PDF를 엑셀과 같은 줄·칸으로 되살려 rcParseRows에 넘김.
// 번호·성명은 합쳐진 칸의 '세로 가운데'에 찍히고, 쪽이 넘어가면 쪽마다 다시 찍힘.
const rcNorm = t => t.replace(/\s+/g, '');
const rcIsPdfHead = ln => { const n = rcNorm(ln.text); return n.includes('번호') && /성명|이름/.test(n) && !/담임|주민|보호자/.test(n); };
const rcIsPdfFoot = ln => ln.text.length < 60 && /(^|\s)\d+\s*\/\s*\d+(\s|$)/.test(ln.text);
const RC_CLASS_LINE = /([1-6])\s*학년\s*(\d{1,2})\s*반/;

// 쪽 번호('3 / 12')·학교 이름이 있는 바닥 줄의 높이 (그 아래는 버림)
function rcPdfFootY(lines) {
    const ys = lines.filter(rcIsPdfFoot).map(l => l.y);
    return ys.length ? Math.min(...ys) : null;
}

// 머리글 칸: 띄어 쓴 한 글자 조각끼리만 한 칸 ("번 호" → 번호). '학년 학기'처럼 붙어 있는 두 칸은 합치지 않음
function rcPdfHeadCells(ln) {
    const cells = [];
    for (const it of ln.words) {
        const last = cells[cells.length - 1];
        if (last && last.one && it.s.trim().length === 1 && it.x - last.x1 < it.h * 1.5) { last.t += it.s; last.x1 = it.x + it.w; }
        else cells.push({ t: it.s, x0: it.x, x1: it.x + it.w, one: it.s.trim().length === 1 });
    }
    cells.forEach(c => c.t = rcNorm(c.t));
    return cells;
}

// 학생을 알려 주는 칸들. 그 밖의 칸(자유학기·학교자율시간 등)도 넣어 두어 거기 찍힌 글자가 이름에 섞이지 않게 함
function rcPdfIdCols(cells) {
    const pick = re => cells.find(c => re.test(c.t));
    const cols = { num: pick(/^번호?$/), name: pick(/^(성명|이름)$/), grade: pick(/^학년$/), term: pick(/^학기$/), subject: pick(/^과목$/) };
    for (const k of Object.keys(cols)) if (!cols[k]) delete cols[k];
    if (!cols.num || !cols.name) return null;
    const known = Object.values(cols);
    cells.forEach((c, i) => { if (!known.includes(c)) cols['etc' + i] = c; });
    return cols;
}

// 학생 칸 글자를 가장 가까운 머리글 칸에 나눠 담음. 번호 없이 과목만 찍힌 줄은 { subject }만 돌려줌
function rcPdfId(words, cols) {
    if (!words.length) return null;
    const keys = Object.keys(cols);
    const mid = c => (c.x0 + c.x1) / 2;
    const v = Object.fromEntries(keys.map(k => [k, '']));
    for (const w of words) {
        const m = w.x + w.w / 2;
        v[keys.reduce((a, b) => Math.abs(m - mid(cols[a])) <= Math.abs(m - mid(cols[b])) ? a : b)] += w.s;
    }
    const num = parseInt(v.num, 10), subject = rcNorm(v.subject || '');
    if (!Number.isFinite(num)) return subject ? { subject } : null;
    return { num: String(num), name: rcNorm(v.name), grade: rcNorm(v.grade || ''), term: rcNorm(v.term || ''), subject };
}

function rcPdfBodyLine(items, y, page) {
    const words = items.filter(w => !w.sp);
    if (!words.length) return null;
    const lw = words[words.length - 1];
    return { y, page, text: rcJoinItems(items), endSp: lw.spAfter ?? null, right: lw.x + lw.w };
}

// 줄들을 글로: 같은 쪽에서 줄 간격이 평소의 1.6배를 넘으면 문단 나눔
function rcPdfBody(lines) {
    const g = [];
    lines.forEach((l, i) => { const p = lines[i - 1]; if (p && p.page === l.page) g.push(p.y - l.y); });
    g.sort((a, b) => a - b);
    const lineGap = g.length ? g[Math.floor(g.length * 0.3)] : 12;
    return lines.reduce((out, l, i) => {
        const p = lines[i - 1];
        if (!p) return l.text;
        if (p.page === l.page && p.y - l.y > lineGap * 1.6) return out + '\n' + l.text;
        const sp = rcWrapSpace(p.text, l.text, p.endSp);
        // 글자끼리 맞닿은 줄바꿈은 짐작 표시를 남겨 두고 사전으로 다시 정함 (rcResolveWraps)
        const unsure = !p.endSp && /[가-힣A-Za-z0-9]$/.test(p.text) && /^[가-힣A-Za-z0-9]/.test(l.text);
        return out + (unsure ? (sp ? RC_WRAP_SP : RC_WRAP_NO) : sp ? ' ' : '') + l.text;
    }, '');
}

// PDF 줄바꿈 자리 띄어쓰기: 붙인 말이 사전에 있으면 붙이고(설+명하는), 두 조각이 각각 사전에 있으면 띄우고(생각과 기억이),
// 둘 다 아니거나 사전이 없으면 끝말 짐작(rcWrapSpace)대로. known: 사전에 그대로 있는 낱말 모음(Set) 또는 null
const RC_WRAP_SP = '⁣', RC_WRAP_NO = '⁤';
const RC_WRAP_PAIR = /([가-힣A-Za-z0-9]+)([⁣⁤])([가-힣A-Za-z0-9]+)/g;
function rcWrapWords(records) {
    const words = new Set();
    for (const rec of records) for (const [, a, , b] of rec.text.matchAll(RC_WRAP_PAIR)) words.add(a).add(b).add(a + b);
    return [...words];
}
function rcResolveWraps(records, known) {
    return records.map(rec => ({
        ...rec,
        text: rec.text.replace(RC_WRAP_PAIR, (m, a, mark, b) => {
            const sp = known && (known.has(a + b) || RC_NEXT_JOSA.test(b)) ? false : known && known.has(a) && known.has(b) ? true : mark === RC_WRAP_SP;
            return a + (sp ? ' ' : '') + b;
        }).replace(/[⁣⁤]/g, m => (m === RC_WRAP_SP ? ' ' : ''))
    }));
}

// PDF 그리기 명령에서 표 칸(네모)을 꺼냄. 좌표는 글 조각과 같은 화면 기준(y는 아래에서부터)
function rcPdfRects(ops, pdfjs, vp) {
    const { OPS, Util } = pdfjs, rects = [], stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    ops.fnArray.forEach((fn, i) => {
        const a = ops.argsArray[i];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() || ctm;
        else if (fn === OPS.transform) ctm = Util.transform(ctm, a);
        else if (fn === OPS.constructPath) {
            const m = Util.transform(vp.transform, ctm), P = (x, y) => Util.applyTransform([x, y], m);
            let j = 0;
            for (const op of a[0]) {
                if (op === OPS.rectangle) {
                    const [x, y, w, h] = a[1].slice(j, j + 4), p = P(x, y), q = P(x + w, y + h);
                    if (Math.abs(p[0] - q[0]) > 3 && Math.abs(p[1] - q[1]) > 3)
                        rects.push({ x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), y0: vp.height - Math.max(p[1], q[1]), y1: vp.height - Math.min(p[1], q[1]) });
                }
                j += op === OPS.rectangle ? 4 : op === OPS.curveTo ? 6 : op === OPS.curveTo2 || op === OPS.curveTo3 ? 4 : op === OPS.moveTo || op === OPS.lineTo ? 2 : 0;
            }
        }
    });
    return rects;
}

// 표시(번호·영역 이름)가 든 칸의 위아래 끝으로 본문 줄 주인을 정함. 칸을 못 찾으면 null (→ rcCenterSplit)
function rcCellOwner(body, marks, rects) {
    if (!rects || !rects.length || !marks.length) return null;
    const cells = marks.map(m => rects.filter(r => r.x0 - 1 <= m.x && m.x <= r.x1 + 1 && r.y0 - 1 <= m.y && m.y <= r.y1 + 1)
        .sort((a, b) => (a.y1 - a.y0) - (b.y1 - b.y0))[0]);
    if (cells.some(c => !c)) return null;
    return body.map(b => cells.findIndex(c => c.y0 - 1 <= b.y && b.y <= c.y1 + 1));
}

// 본문 줄(위→아래)마다 주인 표시(학생 번호·영역 이름) 번호를 정함. -1: 첫 표시 위 줄(앞쪽에서 이어진 글), 표시가 없으면 모두 -1.
// 표시는 그 칸(이 쪽에 보이는 부분)의 세로 가운데에 찍힘 → 아래 칸부터 '가운데×2 − 맨 아래 줄'로 칸 위 끝을 짐작하고,
// 그 근처에서 줄 간격이 넓은 곳(문단·학생 사이)을 경계로 삼음. allowed(m): m번 줄에서 새 칸이 시작될 수 있는지
function rcCenterSplit(body, marks, hasPrev, allowed = () => true) {
    const gaps = body.slice(1).map((b, i) => body[i].y - b.y).sort((a, b) => a - b);
    const lineGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
    const owner = body.map(() => -1);
    let end = body.length;
    for (let k = marks.length - 1; k >= 0 && end > 0; k--) {
        const est = 2 * marks[k].y - body[end - 1].y;
        const ok = m => (m === 0 || allowed(m)) && body[m].y >= marks[k].y - lineGap * 0.6 && (k === 0 || body[m].y < marks[k - 1].y);
        // 짐작한 위 끝에 가까울수록, 앞 줄과 간격이 넓을수록 좋은 경계
        const score = m => Math.abs(body[m].y - est) - (m ? Math.max(0, body[m - 1].y - body[m].y - lineGap) * 0.5 : 0);
        let start = end - 1, best = Infinity;
        for (let m = 0; m < end; m++) if (ok(m) && score(m) < best) { best = score(m); start = m; }
        if (k === 0 && !hasPrev) start = 0;
        for (let m = start; m < end; m++) owner[m] = k;
        end = start;
    }
    return owner;
}

// 표 모양 PDF면 엑셀과 같은 줄 배열을, 아니면 null을 돌려줌
function rcPdfTable(pages) {
    if (!pages.some(ls => ls.some(rcIsPdfHead))) return null;
    const cc = pages.some(ls => ls.some(ln => { const n = rcNorm(ln.text); return n.includes('영역') && n.includes('특기사항'); }));
    return cc ? rcPdfChangcheRows(pages) : rcPdfSetukRows(pages);
}

// 세특·행특 표: [번호 | 성명 | 학년 | 특기사항]
function rcPdfSetukRows(pages) {
    const students = [], labels = [];
    let H = null, cur = null, cls = '', grade = '', subject = '', title = '', rects = null;

    // 머리글 아래 연속된 줄들: 본문 줄마다 주인 학생을 정함
    const flush = block => {
        if (!block.length || !H) return;
        const ids = [], body = [];
        for (const ln of block) {
            const id = rcPdfId(ln.words.filter(w => w.x + w.w / 2 < H.cut), H.cols);
            if (id?.subject) labels.push({ page: ln.page, y: ln.y, subject: id.subject });   // 과목 칸 (합쳐진 칸 가운데에 찍힘)
            if (id?.num) ids.push({ ...id, y: ln.y });
            const b = rcPdfBodyLine(ln.items.filter(w => w.x >= H.cut - 1), ln.y, ln.page);
            if (b) body.push(b);
        }
        const numX = (H.cols.num.x0 + H.cols.num.x1) / 2;
        const owner = rcCellOwner(body, ids.map(i => ({ x: numX, y: i.y })), rects) || rcCenterSplit(body, ids, !!cur);
        body.forEach((b, m) => {
            const id = ids[owner[m]];
            if (id && !(cur && cur.num === id.num && cur.name === id.name && cur.cls === cls && cur.subject === subject && cur.term === id.term)) {
                cur = { grade: id.grade || grade, cls, term: id.term, num: id.num, name: id.name, subject, page: b.page, y: id.y, lines: [] };
                students.push(cur);
            }
            if (cur) cur.lines.push(b);
        });
    };

    pages.forEach((lines, page) => {
        const footY = rcPdfFootY(lines);
        rects = lines.rects;   // 표 칸 (rcPdfRects)
        let block = [];
        for (const ln of lines) {
            if (footY != null && ln.y <= footY + 4) continue;
            ln.page = page;
            const left = !H || ln.words[0].x < H.cut;
            if (rcIsPdfHead(ln)) {
                flush(block); block = [];
                // 학생 칸들 | 특기사항 칸('세부능력 및 특기사항', '행 동 특 성 …'부터 끝까지)
                const cells = rcPdfHeadCells(ln);
                let ti = cells.findIndex((_, i) => /^(세부|특기|행동|종합|및)/.test(cells.slice(i).map(c => c.t).join('')));
                if (ti <= 0) ti = cells.length - 1;
                const cols = rcPdfIdCols(cells.slice(0, ti));
                title ||= cells.slice(ti).map(c => c.t).join('');
                if (!cols) { H = null; continue; }
                // 본문 시작 위치 = 학생 칸들 오른쪽에서 가장 흔한 줄 시작 위치 (그 앞 칸에 찍힌 '시간' 같은 글자는 본문이 아님)
                const right = Math.max(...cells.slice(0, ti).map(c => c.x1)), starts = {};
                lines.forEach(l => { const f = l.y < ln.y && l.words.find(w => w.x > right + 2); if (f) starts[Math.round(f.x)] = (starts[Math.round(f.x)] || 0) + 1; });
                const top = Object.entries(starts).sort((a, b) => b[1] - a[1])[0];
                H = { cols, cut: top ? +top[0] - 1 : right + 3 };
                continue;
            }
            const cm = left && ln.text.length < 60 && ln.text.match(RC_CLASS_LINE);   // '일반계 3학년 13반'
            if (cm) { flush(block); block = []; grade = cm[1]; cls = cm[2]; continue; }
            const sm = left && ln.text.match(/교\s*과\s*목\s*[:：]\s*(.+?)\s*(?:\(\d+\))?\s*$/);   // '교과목 : 국어(4)'
            if (sm) { flush(block); block = []; subject = sm[1]; continue; }
            if (/^<.*>$/.test(rcNorm(ln.text))) { flush(block); block = []; cur = null; continue; }   // <진로 선택 과목>: 번호가 1번부터 다시
            if (/조회된\s*데이터가\s*없습니다/.test(ln.text)) continue;
            if (H) block.push(ln);
        }
        flush(block);
    });
    if (!students.length) return null;
    // 과목 칸이 있는 표: 번호가 다시 작아지면 다음 과목. 과목 글자에 가장 가까운 학생의 묶음이 그 과목
    if (labels.length) {
        let run = -1, prev = null;
        students.forEach(s => { if (!prev || +s.num <= +prev.num || s.term !== prev.term || s.subject !== prev.subject) run++; s.run = run; prev = s; });
        const runSubject = {};
        for (const l of labels) {
            const near = students.filter(s => s.page === l.page).sort((a, b) => Math.abs(a.y - l.y) - Math.abs(b.y - l.y))[0];
            if (near) runSubject[near.run] ||= l.subject;
        }
        let last = '';
        students.forEach(s => { last = runSubject[s.run] || last; s.subject ||= last; });
    }
    return [['학년', '반', '학기', '번호', '성명', '과목', title || '세부능력 및 특기사항'],
        ...students.map(s => [s.grade, s.cls, s.term || '', s.num, s.name, s.subject, rcPdfBody(s.lines)])];
}

// 창체 표: 2단 머리글 [번호 | 성명 | 학년] + [영역 | 시간 | 특기사항]
// 학생 칸은 그 학생 영역들 전체의, 영역 칸은 그 영역 글의 세로 가운데에 찍힘
function rcPdfChangcheRows(pages) {
    const isHead2 = ln => { const n = rcNorm(ln.text); return n.includes('영역') && n.includes('특기사항'); };
    const students = [];
    let C = null, cur = null, curArea = null, cls = '', grade = '';
    const addLine = l => { if (curArea && !/^희\s*망\s*분\s*야/.test(l.text)) curArea.lines.push(l); };

    pages.forEach((lines, page) => {
        const footY = rcPdfFootY(lines);
        const h1 = lines.findIndex(rcIsPdfHead), h2 = lines.findIndex(isHead2);
        const hs = [h1, h2].filter(i => i >= 0);
        lines.slice(0, hs.length ? Math.min(...hs) : 0).forEach(ln => {
            const m = ln.text.match(RC_CLASS_LINE);
            if (m) { grade = m[1]; cls = m[2]; }
        });
        if (h1 >= 0 && h2 >= 0) {
            const cols = rcPdfIdCols(rcPdfHeadCells(lines[h1]));
            const c2 = rcPdfHeadCells(lines[h2]);
            const area = c2.find(c => c.t === '영역'), hour = c2.find(c => c.t === '시간');
            if (cols && area) {
                const idRight = Math.max(...Object.entries(cols).filter(([k]) => !k.startsWith('etc')).map(([, c]) => c.x1));
                const edge = (hour || area).x1;
                // 본문 시작 위치 = 시간 칸 오른쪽에서 가장 흔한 줄 시작 위치
                const starts = {};
                lines.slice(Math.max(h1, h2) + 1).forEach(ln => {
                    const f = ln.words.find(w => w.x > edge + 2);
                    if (f) starts[Math.round(f.x)] = (starts[Math.round(f.x)] || 0) + 1;
                });
                const top = Object.entries(starts).sort((a, b) => b[1] - a[1])[0];
                C = { cols, idCut: (idRight + area.x0) / 2, bodyCut: (edge + (top ? +top[0] : edge + 10)) / 2 };
            }
        }
        if (!C) return;

        const ids = [], areas = [], body = [];
        lines.slice(Math.max(h1, h2) + 1).forEach(ln => {
            if (footY != null && ln.y <= footY + 4) return;
            if (/조회된\s*데이터가\s*없습니다/.test(ln.text)) return;
            if (ln.text.length < 60 && RC_CLASS_LINE.test(ln.text) && ln.words[0].x < C.bodyCut) return;
            const id = rcPdfId(ln.words.filter(w => w.x + w.w / 2 < C.idCut), C.cols);
            if (id?.num) ids.push({ ...id, y: ln.y, x: (C.cols.num.x0 + C.cols.num.x1) / 2 });
            const aw = ln.words.filter(w => w.x + w.w / 2 >= C.idCut && w.x < C.bodyCut);
            const an = rcNorm(aw.map(w => w.s).join('')).replace(/\d+$/, '');   // '자율활동 34' → 자율활동
            if (an) areas.push({ y: ln.y, name: an, x: aw[0].x + aw[0].w / 2 });
            const b = rcPdfBodyLine(ln.items.filter(w => w.x >= C.bodyCut), ln.y, page);
            if (b) body.push(b);
        });
        if (!body.length && !areas.length) return;

        // 영역 이름은 영역 칸의, 학생 번호는 그 학생 영역들 전체의 세로 가운데에 찍힘
        // ① 본문 줄 → 영역  ② 학생 경계는 영역이 바뀌는 줄에서만
        const areaOf = rcCellOwner(body, areas, lines.rects) || rcCenterSplit(body, areas, !!curArea);
        const idOf = rcCellOwner(body, ids, lines.rects) || rcCenterSplit(body, ids, !!cur, m => areaOf[m] !== areaOf[m - 1]);
        body.forEach((b, m) => {
            const id = ids[idOf[m]], area = areas[areaOf[m]];
            if (id && !(cur && cur.num === id.num && cur.name === id.name && cur.cls === cls)) {
                cur = { grade: id.grade || grade, cls, num: id.num, name: id.name, areas: [] };
                students.push(cur);
                curArea = null;
            }
            if (!cur) return;
            if (area && (!curArea || curArea.name !== area.name)) {
                curArea = cur.areas.find(a => a.name === area.name);
                if (!curArea) cur.areas.push(curArea = { name: area.name, lines: [] });
            }
            addLine(b);
        });
    });
    if (!students.length) return null;
    return [['학년', '반', '번호', '성명', '영역', '특기사항'],
        ...students.flatMap(s => s.areas.map(a => [s.grade, s.cls, s.num, s.name, a.name, rcPdfBody(a.lines)]))];
}

// ───────── 점검 ─────────
function rcSpellWords(text) {
    // 사전이 '교수님의'처럼 '님'이 붙은 말을 몰라서 '님' 앞부분만 확인함
    return [...new Set((text.normalize('NFC').match(/[\p{L}\p{N}]+/gu) || [])
        .map(word => word.replace(/(?<=^[가-힣]{2,})님[가-힣]{0,3}$/, ''))
        .filter(word => /^[가-힣]{2,}$/.test(word)))];
}

function rcCheckOne(rec, settings, byteLen) {
    const issues = [];
    const text = rec.text.replace(/\r\n?/g, '\n');
    const add = (type, level, what, why, fix) => issues.push({ type, level, what, why, fix });

    if (!text.trim()) {
        // 교과학습발달상황 두 항목은 안 쓴 경우가 많아서 비어 있어도 오류로 보지 않음
        if (rec.area !== RC_SETUK && rec.area !== RC_PERSONAL) add('empty', 'no', '', '기록이 비어 있어요.');
        return issues;
    }

    const bytes = byteLen(text);
    const limit = settings.limits[rec.area + '|' + rec.subject] || settings.limits[rec.area] || settings.limits['기타'];
    if (bytes > limit) add('length', 'no', '', `글자 수가 ${bytes - limit}바이트 넘쳐요. (지금 ${bytes} / 최대 ${limit}바이트)`);

    for (const rule of RC_FORBID_RULES) {
        if (rule.allowIn && rule.allowIn.includes(rec.area)) continue;
        let prev = null; // '경진대회'처럼 같은 규칙 낱말이 바로 붙어 나오면 하나로 합침
        for (const m of text.matchAll(rule.re)) {
            if (rule.skip && rule.skip.test(m[0])) continue;
            if (prev && prev.end === m.index) { prev.issue.what += m[0]; prev.end += m[0].length; continue; }
            add('forbid', rule.level, m[0], rule.why);
            prev = { issue: issues[issues.length - 1], end: m.index + m[0].length };
        }
    }

    for (const [re, right] of RC_SPELL_RULES) {
        for (const m of text.matchAll(re)) {
            const fix = m[0].replace(re, right);
            add('spell', 'check', m[0], RC_SPELL_NOTE[right] || `'${m[0].trim()}' → '${fix.trim()}'`, RC_SPELL_NOTE[right] ? null : fix);
        }
    }

    if (!(settings.off || []).includes('spell')) for (const word of rcSpellWords(text)) {
        const suggestions = settings.spellings?.[word];
        if (!suggestions || issues.some(issue => (issue.type === 'spell' || issue.type === 'forbid') && (word.includes(issue.what) || issue.what.includes(word)))) continue; // 이미 잡힌 말은 한 번만
        // 사전 미등록·교정 후보만으로는 오류 근거가 되지 않음. 알려진 오타와 교정 가능한 활용형만 표시.
        const known = RC_RETIRED_SPELL.find(rule => word.includes(rule.wrong));
        const fix = known ? word.replace(known.wrong, known.right) : word.replace(/햇(?=다|음|으|던|는)/g, '했');
        if (fix === word || (!known && !suggestions.includes(fix))) continue;
        add('spell', 'check', word, `'${word}' → '${fix}'`, fix);
    }

    // 문장 끝맺음: 특기사항은 '~함.', '~임.'처럼 명사형으로 끝내고 마침표를 찍음
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    sentences.forEach((s, i) => {
        const tail = s.slice(-12);
        if (/[다요]\.?$/.test(s)) add('ending', 'check', tail, "'~다.'로 끝났어요. '~함.', '~임.'처럼 끝맺어 주세요.");
        else if (/[!?]$/.test(s)) add('ending', 'check', tail, '느낌표·물음표 대신 마침표로 끝맺어 주세요.');
        else if (i === sentences.length - 1 && !/\.$/.test(s)) add('ending', 'check', tail, '마지막 문장에 마침표가 빠졌어요.');
    });

    return issues;
}

// 문단과 문장을 원문 그대로 비교함. 양끝 공백과 줄바꿈 형식만 정리함.
function rcExactPassages(text) {
    const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n+/).map(s => s.trim()).filter(Boolean);
    const sentences = paragraphs.flatMap(p => p.split(/(?<=[.!?])(?=\s|[가-힣])/).map(s => s.trim()).filter(Boolean));
    // '1.', '★'처럼 글자가 거의 없는 조각은 비교하지 않음 (번호만 같아도 똑같은 문장으로 잡히던 문제)
    return new Set([...paragraphs, ...sentences].filter(p => (p.match(/[가-힣A-Za-z]/g) || []).length >= 5));
}

function rcCheckAll(records, settings, byteLen) {
    const off = new Set(settings.off || []);
    const results = records.map(rec => ({ rec, issues: rcCheckOne(rec, settings, byteLen).filter(i => !off.has(i.type)) }));
    if (off.has('similar')) return results;
    // 같은 영역·과목의 다른 학생끼리 비교. ponytail: 수천 명이면 문장 색인으로 바꿀 것
    const groups = new Map();
    results.forEach(r => {
        if (!r.rec.text.trim()) return;
        const k = r.rec.area + '|' + r.rec.subject;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push({ ...r, passages: rcExactPassages(r.rec.text) });
    });
    for (const list of groups.values()) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            if (['grade', 'cls', 'num', 'name'].every(key => (a.rec[key] || '') === (b.rec[key] || ''))) continue;
            const shared = [...a.passages].filter(p => b.passages.has(p)).sort((x, y) => y.length - x.length);
            const matches = shared.filter((p, index) => !shared.slice(0, index).some(longer => longer.includes(p)));
            for (const passage of matches) {
                a.issues.push({ type: 'similar', level: 'check', what: passage, why: `${rcWho(b.rec)} 기록에 100% 동일한 문장 또는 문단이 있어요.` });
                b.issues.push({ type: 'similar', level: 'check', what: passage, why: `${rcWho(a.rec)} 기록에 100% 동일한 문장 또는 문단이 있어요.` });
            }
        }
    }
    return results;
}

function rcWho(rec) {
    const where = [rec.grade && rec.grade + '학년', rec.cls && rec.cls + '반', rec.num && rec.num + '번'].filter(Boolean).join(' ');
    return (where ? where + ' ' : '') + rec.name;
}

// 기록 글에 문제 부분을 표시한 HTML
function rcHighlight(text, issues) {
    const marks = [...new Set(issues.map(i => i.what).filter(w => w && w.trim()))].sort((a, b) => b.length - a.length);
    let html = rcEscape(text);
    if (!marks.length) return html.replace(/\n/g, '<br>');
    const levelOf = w => (issues.some(i => i.what === w && i.level === 'no') ? 'no' : 'check');
    const re = new RegExp(marks.map(w => rcEscape(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    const raw = new Map(marks.map(w => [rcEscape(w), w]));
    return html.replace(re, m => `<mark class="rc-mark rc-${levelOf(raw.get(m))}">${m}</mark>`).replace(/\n/g, '<br>');
}

if (typeof module !== 'undefined') module.exports = { RC_DEFAULT_SETTINGS, RC_DEFAULT_GUIDE, rcApplyGuide, rcPattern, RC_TYPES, rcParseRows, rcParsePdfLines, rcGroupLines, rcPdfRects, rcPdfTable, rcWrapWords, rcResolveWraps, rcCheckOne, rcCheckAll, rcHighlight, rcGuessArea };
