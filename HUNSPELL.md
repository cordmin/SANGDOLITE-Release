# 로컬 한국어 맞춤법 점검

생활기록부 보조 점검의 ‘맞춤법 및 표기 방식’과 문장 생성 결과의 보조 점검은
보완 교정 규칙에 더해
Hunspell 한국어 사전으로 단어를 확인합니다. 사전에 없는 표현은 확인 대상으로
안내하며, 전문어·고유명사를 오류로 확정하거나 자동으로 바꾸지 않습니다.
문맥 문법과 띄어쓰기 전체를 검사하는 기능은 아닙니다.

기존 맞춤법 예시 34개 중 사전이 검출하는 26개는 기본 목록에서 제외했습니다.
‘몇 일’, ‘됬’, ‘구지’, ‘문안하’, ‘할께’, ‘않 하’, ‘않 되’, ‘바램’ 8개는
띄어쓰기·문맥·짧은 어절 보완을 위해 남겼습니다. 예전 저장 지침을 읽을 때도
동일한 26개 기본 쌍만 제외하고, 수정한 교정안·정규식과 새로 추가한 규칙은
유지합니다. 개인 API 버전의 기본 규칙은 js/record-check.js에 포함됩니다.

## 배포 파일과 출처

- 한국어 사전: `spellcheck-ko/hunspell-dict-ko` **0.7.94**.
  [원본 배포](https://github.com/spellcheck-ko/hunspell-dict-ko/releases/tag/0.7.94),
  [해당 버전 소스](https://github.com/spellcheck-ko/hunspell-dict-ko/tree/0.7.94).
  `assets/hunspell-ko/ko.aff`, `ko.dic`는 공식 ZIP의 파일을 수정 없이 포함했습니다.
  저작권: 프로젝트 개발자·기여자, 단어 기여자, 국립국어원.
  최종 사전의 GPLv3와 구성 자료의 라이선스는 같은 폴더의 `LICENSE.md`,
  `LICENSE.GPL-3`를 참고하십시오.
- 엔진: `hunspell-wasm` **0.3.0**. [원본 소스](https://github.com/rotemdan/hunspell-wasm),
  [원본 패키지](https://registry.npmjs.org/hunspell-wasm/-/hunspell-wasm-0.3.0.tgz).
  `vendor/hunspell-wasm`에 실행 파일과 원본 라이선스를 포함했습니다.
  Hunspell의 LGPL/GPL/MPL 조건은 해당 폴더의 `COPYING*`를 참고하십시오.

## 실행

기존과 동일하게 프로젝트 루트를 HTTP 서버로 제공하면 됩니다.
별도 설치·API 키·외부 맞춤법 서버는 필요 없습니다. `file://` 대신
`http://localhost` 또는 HTTPS로 실행하십시오.

최초 점검 시 같은 사이트의 엔진과 사전을 읽고 Web Worker에서 실행합니다.
학생 기록은 외부로 전송하지 않으며 단어 캐시는 현재 페이지 메모리에만 남습니다.
서버를 배포할 때 `vendor`, `assets/hunspell-ko`, `js/record-spell*`도 함께 배포해야 합니다.
검사 엔진 또는 사전을 불러오지 못하면 점검 실패를 화면에 표시합니다.

## 검증

상위 개발 프로젝트에서 `node --test tests/*.test.cjs tests/*.test.mjs`를 실행합니다.

실제 WASM과 사전으로 정상 활용형, 등록되지 않은 오탈자, 교정 후보,
중복 안내 방지, 점검 해제를 확인합니다.
