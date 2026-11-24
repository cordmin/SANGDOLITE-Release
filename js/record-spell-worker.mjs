import { createHunspellFromStrings } from '../vendor/hunspell-wasm/dist/Hunspell.js';

let ready;
const cache = new Map();

async function loadDictionary() {
    const [aff, dic, nouns, loanwords] = await Promise.all(['hunspell-ko/ko.aff', 'hunspell-ko/ko.dic', 'nikl-nouns/nouns.txt', 'nikl-nouns/loanwords.txt'].map(async name => {
        const response = await fetch(new URL(`../assets/${name}`, import.meta.url));
        if (!response.ok) throw new Error('한국어 맞춤법 사전을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
        return response.text();
    }));
    const dictionary = await createHunspellFromStrings(aff, dic);
    dictionary.nouns = new Set(nouns.split(/\r?\n/)); // 윈도에서 받으면 줄 끝이 \r\n일 수 있음
    dictionary.loanwords = new Set(loanwords.split(/\r?\n/));
    return dictionary;
}

// 사전은 '과학탐구반', '분리배출'처럼 붙여 쓴 낱말을 잘 몰라서, 아는 말 2~3개로 나뉘면 맞는 말로 봄.
// 앞 조각은 두 글자 이상, 마지막 한 글자 조각은 '반·회·원'처럼 흔히 붙는 말만 허용 ('일일히'가 '일일+히'로 통과하지 않게)
// ponytail: 단순 나누기라 '어의없다(어의+없다)' 같은 드문 오타는 놓침. 자주 틀리는 말은 관리자 맞춤법 규칙에 추가
const RC_ONE_CHAR_TAIL = '반회원장표별단관실부팀제';
function rcKnown(dictionary, word, depth = 0) {
    if (dictionary.testSpelling(word)) return depth === 0 || word.length >= 2 || RC_ONE_CHAR_TAIL.includes(word);
    if (depth >= 2) return false;
    for (let i = 2; i < word.length; i++) {
        if (dictionary.testSpelling(word.slice(0, i)) && rcKnown(dictionary, word.slice(i), depth + 1)) return true;
    }
    return false;
}

// 사전이 모르는 '마찰력을'·'정해진'·'가창함' 보완: 조사를 떼고 국립국어원 명사 목록(assets/nikl-nouns)에서 찾거나,
// '명사+함·했다' 꼴이면 명사를 확인하거나, '~진'을 '~지다'로 바꿔 확인
const RC_JOSA = ['에서는', '으로는', '에서', '으로', '에게', '까지', '부터', '처럼', '보다', '만큼', '이나', '이라', '과의', '와의',
    '을', '를', '이', '가', '은', '는', '에', '의', '과', '와', '로', '도', '만', '나'];
const RC_HADA = ['함으로써', '하였으며', '하였음', '하였다', '하였고', '했으며', '하면서', '하고자', '하는데', '했다', '했음', '했고', '했던',
    '하여', '하고', '하는', '하며', '하기', '하게', '해서', '하던', '하면', '함', '한', '할'];
// 그 밖에 바른 말인데 사전이 몰랐던 꼴: '조형적(으로)', '미제출(된)'·'비언어적', '다항식에서도'·'하나씩',
// 아는 말 두 개를 붙인 '석회조류'·'원반형'·'활동지'
const RC_JOSA_MORE = ['에서도', '에서의', '이라는', '으로서', '으로도', '라는', '임을', '이란', '로서', '로도', '에도', '에는', '과도', '와도', '씩'];
const RC_DOEDA = ['되었으며', '되었다', '되었음', '되어', '되는', '되고', '되며', '된', '됨'];
const RC_PREFIX = '미재과반오비참왕대초';
const RC_TAIL_MORE = '형면상지화력식문목기';
// 붙인 말 조각: 사전이 아는 말, 또는 명사 목록의 3글자 이상 ('개구+장이'처럼 짧은 목록 낱말로 오타가 통과하지 않게).
// '게이트키퍼'·'플라잉디스크'처럼 외래어를 붙인 말은 밑줄을 남기려고, 표준국어대사전이 외래어로 표시한 말(assets/nikl-nouns/loanwords.txt)은 조각으로 쓰지 않음
function rcKnownMore(dictionary, word) {
    const known = w => w.length >= 2 && (dictionary.testSpelling(w) || dictionary.nouns.has(w));
    const piece = w => !rcIsLoan(dictionary, w) && (dictionary.testSpelling(w) ? w.length >= 2 : w.length >= 3 && dictionary.nouns.has(w));
    const pair = w => known(w) || [...w].some((_, i) => i >= 2 && piece(w.slice(0, i)) && (w.length - i >= 2 ? piece(w.slice(i)) : RC_TAIL_MORE.includes(w.slice(i))));
    const suffix = w => { const m = w.match(/^(.{2,})적(?:으로|인|이고|이며)?$/); return !!m && pair(m[1]); };
    const core = w => pair(w) || suffix(w) || (w.length >= 3 && RC_PREFIX.includes(w[0]) && (pair(w.slice(1)) || suffix(w.slice(1))));
    if (core(word)) return true;
    for (const end of [...RC_JOSA, ...RC_JOSA_MORE, ...RC_DOEDA]) {
        if (!word.endsWith(end) || word.length - end.length < 2) continue;
        const stem = word.slice(0, -end.length);
        // '꼼꼼이'처럼 '이'를 떼면 부사 오타가 통과해서, '이' 앞은 명사 목록이나 두 낱말 붙임만 봄
        if (end === '이' ? dictionary.nouns.has(stem) || (stem.length >= 3 && pair(stem)) : core(stem)) return true;
    }
    return false;
}

// split: 아는 말 두 개로 나눠 보기까지 함. PDF 줄바꿈 판단에서는 '생각과기억이'를 한 낱말로 보면 안 돼서 나누지 않음
function rcKnownExtra(dictionary, word, split = true) {
    const { nouns } = dictionary;
    const stemIs = (ends, test) => ends.some(e => word.endsWith(e) && word.length - e.length >= 2 && test(word.slice(0, -e.length)));
    if (nouns.has(word) || stemIs(RC_JOSA, s => nouns.has(s))) return true;
    // '바탕으로한'·'간단히하고자'는 띄어 써야 해서, 조사·'히'로 끝난 앞말에는 '함·하는'을 붙여 보지 않음
    if (stemIs(RC_HADA, s => !/(?:으로|을|를|히|에서|에게)$/.test(s) && (nouns.has(s) || dictionary.testSpelling(s)))) return true;
    if (word.length >= 3 && word.endsWith('진') && dictionary.testSpelling(word.slice(0, -1) + '지다')) return true;
    return split && rcKnownMore(dictionary, word);
}

// 사전이 모르는 말 중 외래어: 그대로 또는 조사를 떼면 국립국어원 외래어 목록에 있거나('아트의'),
// 외래어·아는 말 두 조각으로 나뉘고 그중 하나가 외래어('플라잉디스크를')면 외래어로 봄
// 외래어 목록은 크기를 줄이려고 '스타일리스트'(스타일+리스트)처럼 목록 낱말로 나뉘는 말을 뺐음. 그래서 나눠서도 찾음
function rcIsLoan(dictionary, w, depth = 0) {
    if (dictionary.loanwords.has(w)) return true;
    if (depth >= 2) return false;
    return [...w].some((_, i) => i >= 2 && w.length - i >= 2 && dictionary.loanwords.has(w.slice(0, i)) && rcIsLoan(dictionary, w.slice(i), depth + 1));
}
function rcLoanLike(dictionary, word) {
    const piece = w => w.length >= 2 && (rcIsLoan(dictionary, w) || dictionary.testSpelling(w));
    const loan = w => rcIsLoan(dictionary, w) || [...w].some((_, i) => i >= 2 && w.length - i >= 2 && piece(w.slice(0, i)) && piece(w.slice(i))
        && (rcIsLoan(dictionary, w.slice(0, i)) || rcIsLoan(dictionary, w.slice(i))));
    return loan(word) || [...RC_JOSA, ...RC_JOSA_MORE].some(e => word.endsWith(e) && word.length - e.length >= 2 && loan(word.slice(0, -e.length)));
}

self.onmessage = async ({ data: { id, words, exact } }) => {
    try {
        ready ||= loadDictionary().catch(error => { ready = null; throw error; });
        const dictionary = await ready;
        // exact: 나누지 않고 사전·명사 목록에 그대로 있는 낱말만 돌려줌 (PDF 줄바꿈 띄어쓰기 판단용. '가창함'·'조형'은 알고, '생각과기억이'는 모름)
        if (exact) return self.postMessage({ id, known: words.filter(word => dictionary.testSpelling(word) || rcKnownExtra(dictionary, word, false)) });
        const spellings = {};
        for (const word of words) {
            if (!cache.has(word)) {
                // 사전이 모르는 전문어·이름도 있을 수 있어, 오류 확정 대신 확인 대상으로 안내함.
                const suggestions = rcKnown(dictionary, word) || rcKnownExtra(dictionary, word) ? null
                    : [...new Set(dictionary.getSpellingSuggestions(word).map(s => s.normalize('NFC')))].slice(0, 3);
                if (cache.size >= 20000) cache.clear();
                cache.set(word, suggestions);
            }
            if (cache.get(word) !== null) spellings[word] = cache.get(word);
        }
        self.postMessage({ id, spellings, loans: Object.keys(spellings).filter(word => rcLoanLike(dictionary, word)) });
    } catch (error) {
        self.postMessage({ id, error: error.message || '한국어 맞춤법 점검 중 문제가 생겼어요.' });
    }
};
