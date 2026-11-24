# 로컬 한국어 맞춤법 점검

생활기록부 보조 점검의 ‘맞춤법 및 표기 방식’은 보완 교정 규칙과
Hunspell 한국어 사전을 사용합니다. 문장 생성 결과에는 보조 점검을 적용하지 않습니다.
사전에 없거나 교정 후보가 나온다는 이유만으로는 문제로 표시하지 않습니다.
명시된 오타 교정 쌍 또는 교정 후보로 뒷받침되는 제한적인 활용형 오타만 안내합니다.
전문어·활동명·고유명사·붙여 쓴 표현을 사전 미등록이라는 이유로 표시하거나 자동으로 바꾸지 않습니다.
문맥 문법과 띄어쓰기 전체를 검사하는 기능은 아닙니다.

‘몇 일’, ‘됬’, ‘구지’, ‘문안하’, ‘할께’, ‘않 하’, ‘않 되’, ‘바램’ 같은
보완 교정 규칙과 알려진 오타의 교정 쌍을 사용합니다. 배포용의 점검 규칙은
`js/record-check.js`에서 관리하며, 관리자 화면이나 GAS 서버 저장을 사용하지 않습니다.

## 배포 파일과 출처

- 한국어 사전: `spellcheck-ko/hunspell-dict-ko` **0.7.94**.
  [원본 배포](https://github.com/spellcheck-ko/hunspell-dict-ko/releases/tag/0.7.94),
  [해당 버전 소스](https://github.com/spellcheck-ko/hunspell-dict-ko/tree/0.7.94).
  `assets/hunspell-ko/ko.aff`, `ko.dic`는 공식 ZIP의 파일을 수정 없이 포함했습니다.
  저작권: 프로젝트 개발자·기여자, 단어 기여자, 국립국어원.
  최종 사전의 GPLv3와 구성 자료의 라이선스는 같은 폴더의 `LICENSE.md`,
  `LICENSE.GPL-3`를 참고하십시오.
- 보조 명사 목록: 국립국어원 「표준국어대사전」·「한국어기초사전」 자료
  ([korean-dict-nikl](https://github.com/spellcheck-ko/korean-dict-nikl))를 가공한
  `assets/nikl-nouns/nouns.txt` (약 15만 개, 1.6MB). CC BY-SA 2.0 KR.
  Hunspell이 모르는 낱말은 끝의 조사를 떼고 이 목록에 있으면(예: 마찰력을),
  ‘명사+함·했다·하는’ 꼴이면(예: 가창함), 또는 ‘~진’을 ‘~지다’로 바꿔
  Hunspell이 알면(예: 정해진) 밑줄을 긋지 않습니다. ‘금새’(물건값)처럼 사전에 있는
  낱말과 같은 꼴의 오타는 이 방식으로 잡지 못합니다.
  붙여 쓴 말을 나눠 볼 때는 같은 사전에서 외래어로 표시된 말
  (`assets/nikl-nouns/loanwords.txt`, 표준국어대사전·우리말샘, 약 19만 개)을 조각으로 쓰지 않아, 외래어를 붙인 말은 계속 밑줄을 긋습니다.
  사전이 모르는 말 중 이 목록의 외래어는 보라색 밑줄로 ‘외래어’ 탭에서 따로 셉니다.
  가공 방법은 같은 폴더의 `LICENSE.md`를 참고하십시오.
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
서버를 배포할 때 `vendor`, `assets/hunspell-ko`, `assets/nikl-nouns`, `js/record-spell*`도 함께 배포해야 합니다.
검사 엔진 또는 사전을 불러오지 못하면 점검 실패를 화면에 표시합니다.

## 검증

`node --test tests/*.test.cjs tests/hunspell.test.mjs`

실제 WASM과 사전으로 정상 활용형, 등록되지 않은 오탈자, 교정 후보,
중복 안내 방지, 점검 해제를 확인합니다.
