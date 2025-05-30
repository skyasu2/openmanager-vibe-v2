# 바이브 코딩(Vibe Coding)으로 구현한 OpenManager 자연어 분석 데모

## 바이브 코딩이란?

자연어로 개발 의도와 아이디어를 설명하면, LLM이 코드 초안을 생성하거나 문제 해결 방안을 제시하는 협업적 개발 방식입니다. 개발자는 AI가 생성한 코드를 바탕으로 신속하게 프로토타입을 구축하고, AI와의 대화를 통해 기능을 구체화하며 빠르게 반복 개발을 진행합니다.

본 데모는 여러 LLM(GPT, Claude, Gemini)과 바이브 코딩으로 개발했습니다.

## 프로젝트 진행 단계별 AI 활용 내용

### 1단계: 초기 아이디어 구체화 및 프로토타입 구상 (with GPT)

* **개발 목표 정의:**
    * "서버 경고를 쉽게 요약하고 분석할 수 있는 기능이 필요합니다."
    * "사용자가 '디스크 경고가 가장 많은 서버는?'이라고 물으면 답을 보여주는 방식"
    * "가상 서버 데이터로 문제 있는 상위 서버를 테이블로 보여주는 웹페이지 구현"
* **GPT 지원 내용:**
    * 자연어 기반 모니터링 아이디어 구체화 및 초기 기능 범위 설정
    * 기술 스택(HTML, CSS, JS 기반) 및 데이터 시뮬레이션 방식 구조화
    * 초기 데이터 구조 및 더미 데이터 생성 로직 제안
    * HTML 레이아웃 및 JavaScript 함수 프로토타입 코드 생성

### 2단계: UI 상세 설계 및 핵심 기능 구현 (with Claude)

* **개발 목표 구체화:**
    * "사용자가 필터(시간, 서버 타입 등)를 선택하고 결과를 볼 수 있는 UI 구성"
    * "데이터 처리 및 동적 테이블 렌더링 기능 구현"
* **Claude 지원 내용:**
    * 상세 UI 레이아웃(필터, 테이블 등) 구성
    * 핵심 데이터 처리 로직(필터링, 정렬, 집계) 코드 생성
    * 서버 목록을 동적으로 테이블에 렌더링하는 JavaScript 코드 작성
    * 사용자 인터랙션 이벤트 핸들러 기본 로직 구현

### 3단계: 최종 기능 완성 및 오류 수정 (with Gemini)

* **개발 목표 고도화:**
    * "더미 데이터를 현실적으로 만들고, 자연어 질의 기능 강화, 동적 보고서 기능 추가"
    * "페이지 로드 시 발생하는 오류 해결"
* **Gemini 지원 내용:**
    * **고도화된 더미 데이터 생성:**
        * 실제 환경과 유사한 서버 이름 생성 규칙 적용
        * 24시간 10분 간격 데이터 동적 생성
        * 다양한 장애 시나리오 주입으로 현실감 있는 데이터 구성
    * **자연어 질의 인터페이스 개선:**
        * 예시 질문 드롭다운 UI 구현
        * 자연어를 필터 조건으로 변환하는 로직 패턴화
        * 해석된 조건 UI 피드백 기능 구현
    * **동적 분석 보고서 기능:**
        * 질의 유형별 맞춤형 분석 보고서 동적 생성
        * 통계 및 조치 권고사항 포함 정보 가치 증대
    * **오류 해결 및 코드 리팩토링**

## 바이브 코딩의 주요 효과

| 특징 | 내용 |
| :-- | :-- |
| **빠른 반복 개선** | 다양한 AI와의 협업으로 기능 점진적 완성 |
| **추상적 설명 → 코드화** | 초기 아이디어를 구체적 코드로 신속하게 구현 |
| **자동화 코드 생성** | 복잡한 데이터 생성 및 분석 로직을 AI 지원으로 효율적 개발 |
| **문서화 및 정리** | 프로젝트 구조와 개발 과정 체계적 정리 |

이 프로젝트는 아이디어 구상부터 최종 데모 완성까지 전 과정에서 AI와 적극적으로 협업하는 "바이브 코딩"의 효과를 보여줍니다. 이를 통해 단시간 내에 사용자 의도를 충실히 반영한 데모를 개발했으며, 향후 OpenManager의 실제 기능으로 발전할 수 있는 프로토타입입니다.
