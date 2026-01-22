/**
 * OpenManager AI - 자동 장애 감지 에이전트
 * 주기적으로 서버 데이터를 확인하여 장애를 감지하고, AI 기반 보고서를 생성합니다.
 */

class Agent {
    constructor(aiProcessor) {
        this.aiProcessor = aiProcessor; // ai_processor.js의 인스턴스를 받아 사용
        this.lastCheckTimestamp = null;
        this.detectedIncidents = []; // 감지된 장애 보고서 저장
        this.incidentHistory = []; // 장애 이력 (간단히 최신 몇 개만 유지)
        this.maxHistory = 10;

        // 장애 감지 조건 정의
        this.failureConditions = [
            { id: 'high_cpu', name: '높은 CPU 사용률', condition: server => server.cpu_usage > 90, serverMetric: s => s.cpu_usage, unit: '%' },
            { id: 'high_memory', name: '높은 메모리 사용률', condition: server => server.memory_usage_percent > 85, serverMetric: s => s.memory_usage_percent, unit: '%' },
            { id: 'high_disk', name: '높은 디스크 사용률', condition: server => server.disk && server.disk[0] && server.disk[0].disk_usage_percent > 80, serverMetric: s => (s.disk && s.disk[0] ? s.disk[0].disk_usage_percent : 0), unit: '%' },
            { id: 'network_errors', name: '네트워크 오류', condition: server => (server.net && (server.net.rx_errors > 0 || server.net.tx_errors > 0)), serverMetric: s => (s.net ? s.net.rx_errors + s.net.tx_errors : 0), unit: '개' },
            { id: 'zombie_processes', name: '좀비 프로세스 발생', condition: server => server.zombie_count > 0, serverMetric: s => s.zombie_count, unit: '개' },
            { 
                id: 'service_stopped', 
                name: '주요 서비스 중단', 
                condition: server => server.services && (server.services.mysql === 'stopped' || server.services.nginx === 'stopped' || server.services.rabbitmq === 'stopped'),
                getStoppedServices: server => {
                    if (!server.services) return [];
                    return Object.entries(server.services)
                                 .filter(([service, status]) => ['mysql', 'nginx', 'rabbitmq'].includes(service) && status === 'stopped')
                                 .map(([service]) => service);
                }
            }
        ];
    }

    /**
     * 주기적으로 서버 데이터를 확인하고 장애를 감지합니다.
     * @param {Array} currentServerData 현재 서버 데이터 배열
     */
    async checkServersAndReport(currentServerData) {
        // 오래된 인시던트 정리 (메모리 누수 방지)
        this.clearOldIncidents();

        if (!currentServerData || currentServerData.length === 0) {
            console.warn("[Agent] 확인할 서버 데이터가 없습니다.");
            return null; // 감지된 장애 없음
        }
        this.lastCheckTimestamp = new Date();
        console.log(`[Agent] 서버 데이터 확인 시작: ${this.lastCheckTimestamp.toLocaleString()}`);

        const newIncidents = [];

        for (const server of currentServerData) {
            if (!server || !server.hostname) continue;

            const failedConditions = [];
            for (const fc of this.failureConditions) {
                if (fc.condition(server)) {
                    failedConditions.push({
                        id: fc.id,
                        name: fc.name,
                        value: fc.serverMetric ? fc.serverMetric(server).toFixed(fc.unit === '%' ? 1: 0) + fc.unit : (fc.getStoppedServices ? fc.getStoppedServices(server).join(', ') : '발생'),
                        serverHostname: server.hostname
                    });
                }
            }

            if (failedConditions.length > 0) {
                const incidentId = `${server.hostname}-${failedConditions.map(fc => fc.id).join('-')}`;
                if (!this.detectedIncidents.find(inc => inc.id === incidentId && (new Date() - inc.timestamp < 60 * 60 * 1000))) { // 1시간 내 중복 방지
                    const incidentReport = await this.generateIncidentReport(server, failedConditions);
                    newIncidents.push({
                        id: incidentId,
                        report: incidentReport,
                        serverName: server.hostname,
                        timestamp: new Date(),
                        conditions: failedConditions.map(fc => fc.name)
                    });
                }
            }
        }

        if (newIncidents.length > 0) {
            this.detectedIncidents = this.detectedIncidents.concat(newIncidents);
            this.incidentHistory = newIncidents.concat(this.incidentHistory).slice(0, this.maxHistory); // 최신 이력 관리
            console.log(`[Agent] ${newIncidents.length}개의 신규 장애 감지됨.`, newIncidents);
            return newIncidents; // 새로 감지된 장애 보고서 반환
        }
        
        console.log("[Agent] 신규 감지된 장애 없음.");
        return null;
    }

    /**
     * AI를 사용하여 장애 보고서를 생성합니다.
     * @param {Object} server 장애가 발생한 서버 데이터
     * @param {Array} failedConditions 감지된 장애 조건들
     */
    async generateIncidentReport(server, failedConditions) {
        if (!this.aiProcessor) {
            console.error("[Agent] AI Processor가 설정되지 않아 보고서를 생성할 수 없습니다.");
            return "AI Processor가 설정되지 않아 상세 보고서를 생성할 수 없습니다.";
        }

        let query = `서버 ${server.hostname}에서 ${failedConditions.map(fc => fc.name).join(', ')} 문제가 동시 감지되었습니다. `;
        query += `각 문제의 현재 값은 다음과 같습니다: `;
        query += failedConditions.map(fc => `${fc.name} (${fc.value})`).join(', ');
        query += `. 이 상황에 대한 종합적인 분석과 긴급 조치 방안을 포함한 상세 보고서를 작성해주세요.`;

        try {
            let reportContent = await this.aiProcessor.processQuery(query); 
            
            let htmlReport = `
                <div class="incident-report-card card mb-3">
                    <div class="card-header bg-danger text-white">
                        <h5 class="mb-0"><i class="fas fa-triangle-exclamation me-2"></i>장애 발생: ${server.hostname}</h5>
                    </div>
                    <div class="card-body">
                        <p class="card-text"><strong>감지 시각:</strong> ${new Date().toLocaleString()}</p>
                        <p class="card-text"><strong>문제 요약:</strong></p>
                        <ul>${failedConditions.map(fc => `<li>${fc.name}: ${fc.value}</li>`).join('')}</ul>
                        <hr>
                        <h6 class="card-subtitle mb-2 text-muted">AI 분석 및 권고:</h6>
                        <div class="ai-generated-content">${reportContent.replace(/\n/g, '<br>')}</div>
                    </div>
                    <div class="card-footer text-muted">
                        본 보고서는 시스템에 의해 자동 생성되었습니다.
                    </div>
                </div>
            `;
            return htmlReport;
        } catch (error) {
            console.error(`[Agent] AI 보고서 생성 중 오류 발생 (${server.hostname}):`, error);
            return `AI 보고서 생성 중 오류 발생: ${error.message}`;
        }
    }

    getLatestIncidents() {
        return this.incidentHistory;
    }

    clearOldIncidents() {
        const now = new Date();
        this.detectedIncidents = this.detectedIncidents.filter(
            inc => (now - inc.timestamp) < 24 * 60 * 60 * 1000 // 24시간 이내 내용만 유지
        );
    }
}

// Agent 클래스를 전역으로 노출 (server_dashboard.html에서 사용하기 위함)
window.Agent = Agent; // 또는 모듈 시스템 사용 시 export 