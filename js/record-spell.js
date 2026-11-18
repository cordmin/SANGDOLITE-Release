// 사전과 엔진은 이 사이트에서만 읽고, 학생 기록은 브라우저 작업 스레드에서 검사함.
let rcSpellWorker;
let rcSpellRequest = 0;
const rcSpellPending = new Map();
// index.html의 ?v= 버전을 작업 스레드 파일에도 붙여서, 새로 올리면 예전 검사 파일을 쓰지 않게 함
const rcSpellVersion = (typeof document !== 'undefined' && document.currentScript?.src.split('?')[1]) || '';

function rcCheckSpelling(records) {
    if (!rcSpellWorker) {
        rcSpellWorker = new Worker('js/record-spell-worker.mjs' + (rcSpellVersion ? '?' + rcSpellVersion : ''), { type: 'module' });
        rcSpellWorker.onmessage = ({ data }) => {
            const pending = rcSpellPending.get(data.id);
            if (!pending) return;
            rcSpellPending.delete(data.id);
            if (data.error) pending.reject(new Error(data.error));
            else pending.resolve(data.spellings);
        };
        rcSpellWorker.onerror = () => {
            for (const pending of rcSpellPending.values()) pending.reject(new Error('맞춤법 검사 엔진을 실행하지 못했어요. 새로고침 후 다시 시도해 주세요.'));
            rcSpellPending.clear();
            rcSpellWorker.terminate();
            rcSpellWorker = null;
        };
    }
    const id = ++rcSpellRequest;
    const words = [...new Set(records.flatMap(rec => rcSpellWords(rec.text)))];
    return new Promise((resolve, reject) => {
        rcSpellPending.set(id, { resolve, reject });
        rcSpellWorker.postMessage({ id, words });
    });
}
