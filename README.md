# JOB INSIGHT · AI 기반 취업정보 탐색 서비스

기업 · 직무를 한 번에 검색해 **채용 요구사항 · 기업 이슈 · 전형 일정**을 확인하고,
내 프로필(전공 · 학점 · 어학 · 자격증 · 경험)과 자동 비교해주는 정적 웹 서비스입니다.

## 프로젝트 목표

- 국내 대기업 · 중견기업 · 공기업 · 해외 글로벌 기업 디렉터리 제공
- 직무별 요구사항(학력 · 어학 컷 · 자격증 · 기술스택 · 역량) 구조화
- 내 프로필과의 매칭도(🟢 충족 / 🟡 보완 / 🔴 미달) 자동 평가
- 최대 3개 "기업 + 직무" 조합 나란히 비교

## 이번 리팩터링 내용 (데이터 분리)

기존에 `index.html` 인라인 `<script>` 안에 하드코딩되어 있던 데이터를
`data/companies.json` 단일 파일로 **완전히 분리**하고, 페이지 로드 시
`fetch('data/companies.json')`으로 비동기 호출하도록 변경했습니다.

분리된 데이터:

| 키 | 내용 | 건수 |
|---|---|---|
| `KO_LARGE` | 국내 대기업 목록 | 20 |
| `KO_MID` | 중견기업 목록 | 10 |
| `KO_PUB` | 공기업 목록 | 10 |
| `GLOBAL_INDUSTRIES` | 해외·글로벌 (6개 산업군) | 30 |
| `SAMPLES` | 기업 프로필 심화 데이터 | 3 (SK하이닉스 · 한국전력공사 · ASML) |
| `DETAIL_DATA` | 직무 상세 데이터 | 3 (`SK하이닉스__process`, `한국전력공사__elec`, `ASML__cse`) |

### 동작 방식

```
DOMContentLoaded
  ├─ renderProfileSideCard()        // localStorage 기반, 데이터 불필요
  └─ bootstrapApp()
       ├─ showDataLoading()         // "기업 데이터를 불러오는 중입니다…"
       ├─ await loadCompanyData()   // fetch('data/companies.json')
       │     └─ buildCategoryIndex()  // CATEGORY_INDEX 재생성
       ├─ renderTabs()              // 탭 + 기업 카드 그리드 렌더
       └─ (실패 시) showDataError() // 에러 메시지 + [다시 시도] 버튼
```

주요 구현 포인트

- `KO_LARGE` / `KO_MID` / `KO_PUB` / `GLOBAL_INDUSTRIES` / `SAMPLES` / `DETAIL_DATA`
  는 `const` → `let`으로 변경하고 로드 후 주입
- `CATEGORY_INDEX`는 모듈 로드 시점이 아니라 `buildCategoryIndex()`에서 생성
  (데이터 도착 후 호출)
- `loadCompanyData()`는 프로미스를 캐시해 **중복 fetch를 방지**, 실패 시에는
  캐시를 비워 재시도 허용
- `openCompany()`에 로드 전 클릭 방어 로직 추가 → 토스트 안내 후 로드 완료 시 자동 진입
- 폴백 생성기(`fallbackSampleFor` / `fallbackDetailFor`)는 그대로 유지되어
  JSON에 상세 데이터가 없는 기업도 전부 진입 가능

## 기능 진입 경로 (URI)

정적 SPA(화면 전환 방식)로 동작하며 별도 라우팅 경로는 없습니다.

| 경로 | 설명 |
|---|---|
| `/` 또는 `/index.html` | 메인 (Screen 1: 기업 디렉터리 + 검색 + 프로필 완성도) |
| `data/companies.json` | 기업/직무 데이터 (fetch 전용, 정적 JSON) |

화면 전환 (JS 함수 호출 기준)

| 함수 | 동작 |
|---|---|
| `bootstrapApp()` | 데이터 로드 + 초기 렌더 (수동 재시도용으로도 사용) |
| `openCompany(name)` | Screen 2 — 기업 프로필 · 직무 카테고리 |
| `openDetail(company, jobKey)` | Screen 3 — 직무 요구사항 상세 · 매칭 결과 |
| `goScreen(4)` | Screen 4 — 담은 직무 비교 (최대 3개) |
| `toggleCompare()` | 내 프로필 기준 요구사항 비교 ON/OFF |
| `switchTab(id)` | 디렉터리 탭 전환 (`ko-large` / `ko-mid` / `ko-pub` / `global`) |

## 데이터 모델

`data/companies.json`

```jsonc
{
  "meta": { "version": "1.0.0", "updatedAt": "2026-09-16", "description": "..." },

  "KO_LARGE": [ { "name": "삼성전자", "short": "삼", "tag": "반도체·전자·모바일" } ],
  "KO_MID":   [ { "name": "...", "short": "...", "tag": "..." } ],
  "KO_PUB":   [ { "name": "...", "short": "...", "tag": "..." } ],

  "GLOBAL_INDUSTRIES": [
    { "group": "반도체 (Semiconductor)", "items": [ { "name": "TSMC", "short": "TS", "tag": "..." } ] }
  ],

  "SAMPLES": {
    "<회사명>": {
      "company": "...", "category": "...", "industry": "...",
      "logoShort": "SK", "logoGrad": ["#e60028", "#ff4d5b"],
      "source": "...",
      "jobs": [ { "key": "process", "title": "...", "cat": "...", "desc": "..." } ]
    }
  },

  "DETAIL_DATA": {
    "<회사명>__<직무key>": {
      "company": "...", "job": "...", "category": "...", "source": "...",
      "dday": { "label": "D-14", "type": "urgent", "note": "..." },
      "documents": {
        "education":   { "type": "필수", "detail": "..." },
        "cutoff":      { "type": "필수", "detail": "..." },
        "license":     { "type": "필수", "detail": "..." },   // optional
        "certificate": [ { "name": "...", "type": "가산점", "detail": "..." } ]
      },
      "techStack":  { "summary": "...", "tools": [ { "name": "...", "category": "...", "level": "..." } ] },
      "competency": [ { "name": "...", "type": "AI분석", "detail": "..." } ],
      "insight":    { "news": ["..."], "products": ["..."], "competitors": ["..."] },
      "workCondition": { "location": "...", "shift": "...", "commute": "...", "dorm": "...", "etc": "..." },
      "timeline": [ { "title": "...", "desc": "...", "state": "done|next|upcoming" } ]
    }
  }
}
```

### 저장소 / 스토리지

| 데이터 | 저장 위치 |
|---|---|
| 기업 · 직무 데이터 | `data/companies.json` (정적 파일, 읽기 전용) |
| 내 프로필 | 브라우저 `localStorage` 키 `jobinsight_profile_v1` |
| 비교 목록 | 메모리 (`COMPARE_SET`, 새로고침 시 초기화) |

> 서버 DB나 API를 사용하지 않는 순수 정적 사이트입니다.

## 완료된 기능

- [x] 기업 디렉터리 (4개 카테고리 · 총 70개 기업) 탭 탐색
- [x] 기업명 검색 + 별칭(alias) 정규화 (`엔비디아` → `NVIDIA` 등)
- [x] 기업 프로필 화면 (직무 카테고리 카드)
- [x] 직무 상세 화면 (지원 자격 · 기술스택 · 요구역량 · 기업 이슈 · 근무조건 · 전형 일정)
- [x] 내 프로필 편집 + localStorage 저장 / 완성도 링 차트
- [x] 프로필 ↔ 요구사항 자동 비교 (🟢/🟡/🔴) 및 요약 카드
- [x] 최대 3개 "기업+직무" 조합 비교 화면
- [x] 상세 데이터가 없는 기업의 폴백 템플릿 자동 생성
- [x] **데이터 외부 JSON 분리 + fetch 비동기 로드 (본 작업)**
- [x] 로딩 상태 / 로드 실패 시 재시도 UI

## 미구현 기능

- [ ] 실제 채용 공고 API 연동 (현재는 정적 큐레이션 데이터)
- [ ] `SAMPLES` / `DETAIL_DATA` 심화 데이터가 3개 기업에만 존재 (나머지는 폴백 템플릿)
- [ ] 비교 목록 localStorage 영속화
- [ ] 마감일(D-day) 자동 계산 (현재 라벨 하드코딩)
- [ ] 검색 자동완성 / 오타 보정
- [ ] 직무 상세 데이터 관리자 편집 화면

## 권장 다음 단계

1. `data/companies.json`의 `DETAIL_DATA`를 기업별로 계속 추가 (`회사명__직무key` 규칙)
2. 데이터가 커지면 `data/companies.json`(목록) / `data/details/{회사}.json`(상세)로
   한 번 더 분리하고 상세는 화면 진입 시 lazy fetch
3. `dday`를 `deadline: "2026-09-29"` 같은 날짜 필드로 바꾸고 D-day를 런타임 계산
4. 비교 목록을 localStorage에 저장해 새로고침 후에도 유지
5. 검색 입력에 자동완성(datalist 또는 커스텀 드롭다운) 추가

## 배포

배포는 **Publish 탭**에서 원클릭으로 진행할 수 있습니다.

> 참고: `data/companies.json`을 `fetch`로 불러오기 때문에 `file://`로 직접 열면
> CORS 정책 때문에 데이터 로드가 실패합니다. 로컬 확인 시에는
> `python3 -m http.server` 같은 정적 서버를 사용하세요.

## 파일 구조

```
index.html            메인 페이지 (HTML + CSS + JS 인라인)
data/
  └── companies.json  기업 목록 · 기업 프로필 · 직무 상세 데이터
README.md
```
