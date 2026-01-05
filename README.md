# OpenManager 자연어 기반 서버 분석 데모

본 데모는 OpenManager에 추가될 **자연어 기반 서버 분석 기능**을 보여줍니다. 서버 관리자가 "CPU 사용률 높은 서버 찾아줘"와 같이 쉬운 말로 물어보면 시스템이 자동으로 분석하여 결과를 보여주는 기능입니다.

## 데모 사용 방법

1. **GitHub 저장소**: https://github.com/skyasu2/openmanager-vibe-demo
2. **라이브 데모**: https://openmanager-vibe-v2.netlify.app/ 에서 직접 사용해 볼 수 있습니다.
3. **로컬 실행**: 저장소를 클론하여 `index.html` 파일을 브라우저에서 열어 실행할 수 있습니다.

## 프로젝트 파일 구조

* **README.md**: 프로젝트 소개 및 사용 방법 안내
* **code_notes.md**: AI와의 바이브 코딩 진행 과정 상세 기록
* **data_processor.js**: 서버 데이터 필터링, 분석, 처리 핵심 로직
* **demo.html**: 자연어 분석 기능 데모를 위한 메인 인터페이스
* **fixed_dummy_data.js**: 현실적인 서버 모니터링 더미 데이터 생성 로직
* **index.html**: 프로젝트 소개 및 시작 페이지
* **structure.md**: 실제 시스템과 데모의 구조적 차이점 설명
* **css/style.css**: 기본 사용자 인터페이스 스타일 정의 (레거시)
* **css/modern-style.css**: 서버 모니터링 대시보드용 모던 디자인 스타일시트
* **summary.js**: 데이터 요약 및 보고서 생성 기능

> **Vibe Coding 방식:** 이 데모는 AI(GPT, Claude, Gemini)를 활용한 신속 개발 방식으로 구현했습니다. 자세한 내용은 `code_notes.md`를 참고하세요.

> **주의:** 데모용 가상 데이터만 사용했습니다. 실제 OpenManager와는 다릅니다.

## 주요 기능

* **쉬운 언어로 질문:** "메모리 상태 확인해줘" 같이 일상 언어로 질문
* **즉시 분석:** 시스템이 질문을 이해하고 관련 서버 목록 제공
* **상세 보고서:** 문제 원인과 해결책이 포함된 분석 보고서 제공
* **기존 필터 방식:** 시간, 서버 유형, 위치별 기존 필터 기능 함께 제공
* **요약 데이터 저장:** 분석 결과를 CSV로 다운로드 가능

## 기술 구성

* **순수 웹 기술:** HTML, CSS, JavaScript만 사용 (프레임워크 없음)
* **가상 데이터:** 실제 환경과 유사한 서버 30대 데이터 시뮬레이션
* **자체 개발 분석 엔진:** `data_processor.js`로 데이터 필터링 및 분석
* **배포 환경:** GitHub 저장소 + Netlify 무료 호스팅 연동

## 서버리스 구현 및 백엔드 대체 방식

현재 이 데모는 완전한 서버리스(클라이언트 사이드) 방식으로 구현되어 있습니다. 향후 실제 배포 시 백엔드 구현이 필요한 부분들은 다음과 같습니다:

### 서버리스로 구현된 기능:

1. **더미 데이터 생성 (`dummy_data_generator.js`)**
   - **현재 구현**: 클라이언트 측에서 JavaScript로 가상 서버 데이터 생성
   - **실제 구현 필요**: 실제 서버 모니터링 시스템(Prometheus, Zabbix 등)과 연동

2. **자연어 처리 엔진 (`ai_processor.js`)**
   - **현재 구현**: 정규식과 키워드 기반의 단순 텍스트 매칭 알고리즘
   - **실제 구현 필요**: 백엔드 API로 OpenAI, Azure, AWS Bedrock 등의 LLM 서비스 연동

3. **데이터 처리 및 필터링 (`data_processor.js`)**
   - **현재 구현**: 클라이언트에서 JavaScript로 데이터 처리
   - **실제 구현 필요**: 대규모 데이터는 백엔드 DB 쿼리(MongoDB, PostgreSQL 등)로 처리

4. **장애 보고서 생성 및 저장**
   - **현재 구현**: 클라이언트에서 생성 후 로컬 다운로드
   - **실제 구현 필요**: 백엔드 DB에 저장하고 이메일/메신저 알림 시스템 연동

5. **데이터 캐싱**
   - **현재 구현**: 브라우저 메모리(변수)에 임시 저장
   - **실제 구현 필요**: Redis나 Memcached 같은 분산 캐시 시스템 활용

### 백엔드 구현 시 필요한 API 엔드포인트:

```
/api/servers - 서버 목록 및 상태 정보
/api/servers/{id} - 특정 서버 상세 정보
/api/servers/metrics - 집계된 메트릭 데이터
/api/analysis/natural-query - 자연어 질의 처리
/api/reports - 장애 보고서 생성 및 조회
/api/alerts - 알림 설정 및 이력
```

### 기술 스택 추천:

- **백엔드**: Node.js + Express 또는 Python + FastAPI
- **데이터베이스**: 시계열 DB(InfluxDB, TimescaleDB) + 문서형 DB(MongoDB)
- **캐싱**: Redis
- **인증**: JWT 기반 OAuth2
- **모니터링**: Prometheus + Grafana
- **AI/ML**: OpenAI API 또는 자체 구축 LLM

## 향후 계획

실제 OpenManager에 통합 시 필요한 작업:

1. **AI 연동:** 실제 LLM 연결로 더 정확한 질문 이해
2. **실제 데이터 연결:** OpenManager 데이터베이스와 연동
3. **시각화 강화:** 분석 결과를 그래프로 표현
