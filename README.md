# OpenManager AI - 자연어 기반 서버 모니터링 대시보드

서버 관리자가 "CPU 사용률 높은 서버 찾아줘"와 같이 자연어로 질문하면 AI가 자동으로 분석하여 결과를 제공하는 서버 모니터링 시스템입니다.

## 데모

- **라이브 데모**: https://openmanager-vibe-v2.netlify.app/
- **GitHub**: https://github.com/skyasu2/openmanager-vibe-v2

## 주요 기능

- **자연어 질의**: "메모리 상태 확인해줘" 같이 일상 언어로 질문
- **실시간 모니터링**: 50대 서버 상태를 실시간으로 표시
- **자동 장애 감지**: AI 기반 문제 패턴 인식 및 알림
- **상세 보고서**: 문제 원인과 해결책이 포함된 분석 보고서
- **CSV 다운로드**: 분석 결과를 CSV로 내보내기

## 프로젝트 구조

```
openmanager-vibe-v2/
├── index.html              # 프로젝트 소개 페이지
├── server_dashboard.html   # 메인 대시보드
├── server_detail.html      # 서버 상세 정보 페이지
├── settings.local.js       # 중앙 설정 파일
├── data_processor.js       # 데이터 처리 및 UI 제어
├── ai_processor.js         # AI 자연어 분석 엔진
├── agent.js                # 자동 장애 감지 에이전트
├── dummy_data_generator.js # 더미 서버 데이터 생성
├── css/
│   ├── style.css           # 기본 스타일
│   └── modern-style.css    # 모던 대시보드 스타일
├── code_notes.md           # 개발 과정 기록
└── structure.md            # 시스템 구조 설명
```

## 설정 (settings.local.js)

중앙 설정 파일에서 임계값, 서버 수, 업데이트 주기 등을 관리합니다:

```javascript
AppSettings = {
    thresholds: {
        critical: { cpu: 90, memory: 90, disk: 90 },
        warning: { cpu: 70, memory: 70, disk: 70 }
    },
    dataGenerator: {
        serverCount: 50,
        updateInterval: 10 * 60 * 1000  // 10분
    },
    // ...
}
```

## 로컬 실행

```bash
# 저장소 클론
git clone https://github.com/skyasu2/openmanager-vibe-v2.git
cd openmanager-vibe-v2

# 브라우저에서 index.html 열기
# 또는 로컬 서버 실행
npx serve .
```

## 기술 스택

- **프론트엔드**: HTML, CSS, JavaScript (프레임워크 없음)
- **UI**: Bootstrap 5, Font Awesome, Chart.js
- **배포**: Netlify

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    HTML Pages                        │
│  (index.html, server_dashboard.html, server_detail) │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              settings.local.js                       │
│         (중앙 설정 - 임계값, 서버 수 등)              │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│   Agent   │  │    AI     │  │   Data    │
│  장애감지  │◄─┤ Processor │◄─┤ Processor │
└───────────┘  │ 자연어분석 │  │  UI제어   │
               └─────┬─────┘  └─────┬─────┘
                     │              │
               ┌─────▼──────────────▼─────┐
               │  DummyDataGenerator      │
               │  (50대 서버 데이터 생성)  │
               └──────────────────────────┘
```

## 향후 계획

1. **백엔드 연동**: 실제 모니터링 시스템(Prometheus, Zabbix) 연결
2. **LLM 연동**: OpenAI/Claude API로 더 정확한 자연어 처리
3. **알림 시스템**: 이메일/Slack 알림 연동
4. **인증**: JWT 기반 사용자 인증

## 라이선스

MIT License

---

> **Vibe Coding**: 이 프로젝트는 AI(GPT, Claude)를 활용한 신속 개발 방식으로 구현되었습니다.
