import { createHunspellFromStrings } from '../vendor/hunspell-wasm/dist/Hunspell.js';

let ready;
const cache = new Map();

async function loadDictionary() {
    const files = await Promise.all(['ko.aff', 'ko.dic'].map(async name => {
        const response = await fetch(new URL(`../assets/hunspell-ko/${name}`, import.meta.url));
        if (!response.ok) throw new Error('한국어 맞춤법 사전을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
        return response.text();
    }));
    return createHunspellFromStrings(...files);
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
                const suggestions = rcKnown(dictionary, word) ? null
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
