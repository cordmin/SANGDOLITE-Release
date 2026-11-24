import { createHunspellFromStrings } from '../vendor/hunspell-wasm/dist/Hunspell.js';

let ready;
const cache = new Map();

async function loadDictionary() {
    const [aff, dic, nouns] = await Promise.all(['hunspell-ko/ko.aff', 'hunspell-ko/ko.dic', 'nikl-nouns/nouns.txt'].map(async name => {
        const response = await fetch(new URL(`../assets/${name}`, import.meta.url));
        if (!response.ok) throw new Error('한국어 맞춤법 사전을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
        return response.text();
    }));
    const dictionary = await createHunspellFromStrings(aff, dic);
    dictionary.nouns = new Set(nouns.split(/\r?\n/)); // 윈도에서 받으면 줄 끝이 \r\n일 수 있음
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
function rcKnownExtra(dictionary, word) {
    const { nouns } = dictionary;
    const stemIs = (ends, test) => ends.some(e => word.endsWith(e) && word.length - e.length >= 2 && test(word.slice(0, -e.length)));
    if (nouns.has(word) || stemIs(RC_JOSA, s => nouns.has(s))) return true;
    if (stemIs(RC_HADA, s => nouns.has(s) || dictionary.testSpelling(s))) return true;
    return word.length >= 3 && word.endsWith('진') && dictionary.testSpelling(word.slice(0, -1) + '지다');
}

self.onmessage = async ({ data: { id, words, exact } }) => {
    try {
        ready ||= loadDictionary().catch(error => { ready = null; throw error; });
        const dictionary = await ready;
        // exact: 나누지 않고 사전에 그대로 있는 낱말만 돌려줌 (PDF 줄바꿈 띄어쓰기 판단용)
        if (exact) return self.postMessage({ id, known: words.filter(word => dictionary.testSpelling(word)) });
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
        self.postMessage({ id, spellings });
    } catch (error) {
        self.postMessage({ id, error: error.message || '한국어 맞춤법 점검 중 문제가 생겼어요.' });
    }
};
