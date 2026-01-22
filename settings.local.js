/**
 * OpenManager AI - 로컬 설정 파일
 * 하드코딩된 값들을 중앙 집중 관리합니다.
 */

const AppSettings = {
    // 서버 상태 임계값
    thresholds: {
        critical: {
            cpu: 90,
            memory: 90,
            disk: 90
        },
        warning: {
            cpu: 70,
            memory: 70,
            disk: 70
        }
    },

    // UI 설정
    ui: {
        itemsPerPage: 6,           // 페이지당 서버 수
        problemsPerPage: 5,        // 페이지당 문제 수
        chartRefreshInterval: 5000 // 차트 갱신 주기 (ms)
    },

    // 데이터 생성기 설정
    dataGenerator: {
        serverCount: 50,           // 총 서버 수
        initialBatchSize: 10,      // 초기 로딩 배치 크기
        updateInterval: 10 * 60 * 1000, // 데이터 업데이트 주기 (10분)
        maxHistoricalPoints: 144   // 24시간 이력 (10분 간격)
    },

    // 에이전트 설정
    agent: {
        maxHistory: 10,            // 장애 이력 최대 개수
        incidentRetentionHours: 24 // 인시던트 보관 시간
    },

    // AI 프로세서 설정
    aiProcessor: {
        maxHistoryPoints: 144      // 서버별 이력 데이터 최대 개수
    },

    // 장애 감지 임계값
    failureDetection: {
        highCpu: 90,
        highMemory: 85,
        highDisk: 80,
        networkErrorThreshold: 0
    },

    // 서버 유형별 기본 설정
    serverTypes: {
        web: { cpuBase: 40, memoryBase: 50, diskBase: 45 },
        app: { cpuBase: 55, memoryBase: 60, diskBase: 40 },
        db: { cpuBase: 45, memoryBase: 70, diskBase: 55 },
        cache: { cpuBase: 35, memoryBase: 80, diskBase: 30 },
        api: { cpuBase: 50, memoryBase: 55, diskBase: 35 }
    }
};

// 전역으로 노출
window.AppSettings = AppSettings;

// 모듈 시스템 지원
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppSettings;
}
