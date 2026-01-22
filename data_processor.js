/**
 * OpenManager AI - 데이터 처리기
 * 서버 데이터 처리, 페이지네이션, 필터링 및 UI 업데이트 로직을 구현합니다.
 */

// HTML escape 유틸리티 함수 (XSS 방지)
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

class DataProcessor {
    constructor() {
        try {
            // 기본 데이터 초기화
            this.serverData = window.serverData || [];
            this.filteredData = [];
            this.currentFilter = 'all';
            this.currentSort = 'status-critical'; // 기본 정렬을 상태 기준(심각 > 경고 > 정상)으로 변경
            this.searchQuery = '';
            this.currentPage = 1;
            this.itemsPerPage = 6; // 페이지당 서버 수
            
            // AI 문제 페이지네이션
            this.currentProblemPage = 1;
            this.problemsPerPage = 5; // 페이지당, 처음에 표시될 문제 수
            
            // 초기화 로깅
            console.log('DataProcessor 초기화 시작...');
            
            // AIProcessor 인스턴스 초기화 개선
            if (window.aiProcessor) {
                this.aiProcessor = window.aiProcessor;
                console.log('기존 AIProcessor 인스턴스를 사용합니다.');
            } else if (typeof AIProcessor === 'function') {
                // AIProcessor 클래스가 존재하면 인스턴스 생성
                try {
                    window.aiProcessor = new AIProcessor();
                    this.aiProcessor = window.aiProcessor;
                    console.log("AIProcessor 인스턴스를 새로 생성했습니다.");
                } catch (e) {
                    console.error("AIProcessor 인스턴스 생성 중 오류 발생:", e);
                    this.aiProcessor = null;
                }
            } else {
                console.warn("AIProcessor 클래스를 찾을 수 없습니다. 기본 상태 판단 로직을 사용합니다.");
                this.aiProcessor = null;
            }
            
            // 서버 상태 평가 임계값 - settings.local.js에서 로드
            this.thresholds = window.AppSettings?.thresholds || {
                critical: { cpu: 90, memory: 90, disk: 90 },
                warning: { cpu: 70, memory: 70, disk: 70 }
            };
            
            // UI 요소 참조 - 안전하게 참조를 시도합니다
            this.findUIElements();
            
            // 이벤트 리스너 등록
            if (this.hasRequiredElements()) {
                this.registerEventListeners();
                console.log('이벤트 리스너가 등록되었습니다.');
            } else {
                console.warn('일부 UI 요소를 찾을 수 없어 이벤트 리스너 등록이 제한됩니다.');
            }
            
            // 자동 데이터 업데이트 (1분 간격)
            setInterval(() => this.refreshData(), 60 * 1000);
            
            // 초기 데이터 로드
            this.loadData();
            
            // 서버 상태 판단 통합 로직을 전역 함수로 등록
            window.getServerStatus = (server) => this.getServerStatus(server);
            
            console.log('DataProcessor 초기화 완료.');
        } catch (error) {
            console.error('DataProcessor 초기화 중 심각한 오류 발생:', error);
            
            // 최소한의 기능 보장
            this.serverData = window.serverData || [];
            this.filteredData = window.serverData || [];
            
            // 기본 필수 함수들은 최소한으로라도 구현
            if (!this.showLoading) {
                this.showLoading = function() {
                    const loadingIndicator = document.getElementById('loadingIndicator');
                    const serverGrid = document.getElementById('serverGrid');
                    if (loadingIndicator) loadingIndicator.style.display = 'block';
                    if (serverGrid) serverGrid.style.opacity = '0.3';
                };
            }
            
            if (!this.hideLoading) {
                this.hideLoading = function() {
                    const loadingIndicator = document.getElementById('loadingIndicator');
                    const serverGrid = document.getElementById('serverGrid');
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    if (serverGrid) serverGrid.style.opacity = '1';
                };
            }
            
            // 기본 데이터 처리 함수
            if (!this.handleDataUpdate) {
                this.handleDataUpdate = function(data) {
                    this.serverData = data || [];
                    this.filteredData = data || [];
                    this.renderServerGrid();
                    this.hideLoading();
                };
            }
        }
    }
    
    // UI 요소를 찾아 참조를 저장하는 메소드
    findUIElements() {
        try {
            // UI 요소 참조
            this.serverGrid = document.getElementById('serverGrid');
            this.loadingIndicator = document.getElementById('loadingIndicator');
            this.searchInput = document.getElementById('searchInput');
            this.statusFilter = document.getElementById('statusFilter');
            this.pageSize = document.getElementById('pageSize');
            this.prevPageBtn = document.getElementById('prevPageBtn');
            this.nextPageBtn = document.getElementById('nextPageBtn');
            this.serverCount = document.getElementById('serverCount');
            this.currentPageElement = document.getElementById('currentPage');
            this.refreshButton = document.getElementById('refreshBtn');
            this.modalElement = document.getElementById('serverDetailModal');
            this.closeModalButton = document.querySelector('.btn-close[data-bs-dismiss="modal"]');
            
            // 페이지네이션 컨테이너 요소
            this.pagination = document.querySelector('.pagination-container');
            
            // 모든 요소 참조가 필요하지 않는지 확인 로깅
            const missingElements = [];
            if (!this.serverGrid) missingElements.push('serverGrid');
            if (!this.loadingIndicator) missingElements.push('loadingIndicator');
            if (!this.refreshButton) missingElements.push('refreshBtn');
            
            if (missingElements.length > 0) {
                console.warn(`다음 UI 요소를 찾을 수 없습니다: ${missingElements.join(', ')}`);
            }
        } catch (error) {
            console.error('UI 요소 참조 중 오류:', error);
        }
    }
    
    // 필수 UI 요소가 있는지 확인
    hasRequiredElements() {
        // 최소한 서버 그리드와 로딩 인디케이터는 필요
        return this.serverGrid && this.loadingIndicator;
    }
    
    registerEventListeners() {
        // 필터링 이벤트
        if (this.statusFilter) {
            this.statusFilter.addEventListener('change', () => {
                this.currentFilter = this.statusFilter.value;
                this.currentPage = 1; // 필터 변경 시 첫 페이지로 리셋
                this.applyFiltersAndSort();
            });
        }
        
        // 검색 이벤트
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                this.searchQuery = this.searchInput.value.toLowerCase();
                this.currentPage = 1; // 검색 시 첫 페이지로 리셋
                this.applyFiltersAndSort();
            });
        }
        
        // 페이지 크기 이벤트
        if (this.pageSize) {
            this.pageSize.addEventListener('change', () => {
                this.itemsPerPage = parseInt(this.pageSize.value);
                this.currentPage = 1;
                this.applyFiltersAndSort();
            });
        }
        
        // 이전 페이지 버튼
        if (this.prevPageBtn) {
            this.prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.applyFiltersAndSort();
                }
            });
        }
        
        // 다음 페이지 버튼
        if (this.nextPageBtn) {
            this.nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.applyFiltersAndSort();
                }
            });
        }
        
        // 새로고침 이벤트
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => this.refreshData());
        }
        
        // 모달 닫기 이벤트
        if (this.closeModalButton) {
            this.closeModalButton.addEventListener('click', () => this.closeModal());
        }
        
        // 서버 데이터 업데이트 이벤트 리스너
        window.addEventListener('serverDataUpdated', (event) => {
            this.handleDataUpdate(event.detail);
        });
        
        // 초기 AI 도우미 기능 설정
        const aiQuerySubmitButton = document.getElementById('ai-query-submit');
        if (aiQuerySubmitButton) {
            aiQuerySubmitButton.addEventListener('click', () => this.processAIQuery());
        }
        
        // 장애 보고서 다운로드 이벤트
        const downloadReportButton = document.getElementById('downloadAllReportsBtn');
        if (downloadReportButton) {
            downloadReportButton.addEventListener('click', () => this.downloadErrorReport());
        }
        
        // 전체 문제 보기 버튼 이벤트 처리
        const viewAllProblemsBtn = document.getElementById('viewAllProblemsBtn');
        if (viewAllProblemsBtn) {
            viewAllProblemsBtn.addEventListener('click', () => {
                // 현재 모든 문제를 모달로 표시하도록 수정
                this.showAllProblems();
            });
        }
        
        // 프리셋 태그 버튼 이벤트
        document.querySelectorAll('.preset-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                // 이전에 선택된 태그의 active 클래스 제거
                document.querySelectorAll('.preset-tag.active').forEach(el => {
                    el.classList.remove('active');
                });
                
                // 클릭한 태그에 active 클래스 추가
                tag.classList.add('active');
                
                const presetText = tag.dataset.preset;
                const input = document.getElementById('queryInput');
                if (input) {
                    input.value = presetText;
                    input.focus();
                    // 자동 실행
                    const submitButton = document.getElementById('ai-query-submit');
                    if (submitButton) {
                        submitButton.click();
                    }
                }
                
                // 0.5초 후 active 클래스 제거하여 클릭 효과 리셋
                setTimeout(() => {
                    tag.classList.remove('active');
                }, 500);
            });
        });
        
        // 전체 보고서 다운로드 버튼 이벤트 리스너
        const downloadAllReportsBtn = document.getElementById('downloadAllReportsBtn');
        if (downloadAllReportsBtn) {
            downloadAllReportsBtn.addEventListener('click', () => {
                this.downloadAllProblemsReport();
            });
        }
        
        // 쿼리 결과 닫기 버튼 이벤트 리스너
        const closeQueryResultBtn = document.getElementById('closeQueryResult');
        if (closeQueryResultBtn) {
            closeQueryResultBtn.addEventListener('click', () => {
                const queryResultElement = document.getElementById('queryResult');
                const queryResultContent = document.getElementById('queryResultContent');
                if (queryResultElement) {
                    queryResultElement.style.display = 'none';
                    queryResultElement.classList.remove('active');
                }
                if (queryResultContent) {
                    queryResultContent.innerHTML = '';
                }
                
                // 입력창도 비우기
                const queryInput = document.getElementById('queryInput');
                if (queryInput) {
                    queryInput.value = '';
                }
                
                console.log('AI 분석 결과가 닫혔습니다.');
            });
        }
    }
    
    loadData() {
        this.showLoading();
        
        // 데이터가 이미 로드되어 있으면 사용
        if (window.serverData && window.serverData.length > 0) {
            this.handleDataUpdate(window.serverData);
            return;
        }
        
        // 데이터 로드 시도 (최대 10초 대기)
        let attempts = 0;
        const maxAttempts = 20; // 10초 = 500ms * 20
        const checkInterval = setInterval(() => {
            if (window.serverData && window.serverData.length > 0) {
                clearInterval(checkInterval);
                this.handleDataUpdate(window.serverData);
                return;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                this.hideLoading();
                console.error('서버 데이터를 로드하지 못했습니다. 백업 데이터 생성을 시도합니다.');
                this.createBackupData();
            }
        }, 500);
    }
    
    // 백업 데이터 생성 함수
    createBackupData() {
        console.log('백업 데이터 생성 시도...');
        
        try {
            // 1. generateDummyData 함수 검사 및 호출
            if (typeof generateDummyData === 'function') {
                window.serverData = generateDummyData(10); // 30개에서 10개로 줄임
                if (window.serverData && window.serverData.length > 0) {
                    this.handleDataUpdate(window.serverData);
                    return;
                }
            }
            
            // 2. generateDummyData가 없거나 실패한 경우 직접 더미 데이터 생성
            console.log('기본 더미 데이터 생성...');
            const backupServers = [];
            
            // 기본 더미 서버 10대 생성
            for (let i = 1; i <= 10; i++) {
                // 약 30%의 확률로 문제 있는 서버 생성
                const hasProblem = Math.random() < 0.3;
                const problemLevel = hasProblem ? (Math.random() < 0.3 ? 'critical' : 'warning') : 'normal';
                
                const cpuUsage = problemLevel === 'critical' ? 
                    Math.floor(Math.random() * 10) + 90 : // 90-99%
                    problemLevel === 'warning' ? 
                        Math.floor(Math.random() * 20) + 70 : // 70-89%
                        Math.floor(Math.random() * 50) + 10; // 10-59%
                
                const memoryUsage = problemLevel === 'critical' ? 
                    Math.floor(Math.random() * 10) + 90 : // 90-99%
                    problemLevel === 'warning' ? 
                        Math.floor(Math.random() * 20) + 70 : // 70-89%
                        Math.floor(Math.random() * 50) + 10; // 10-59%
                
                const diskUsage = problemLevel === 'critical' ? 
                    Math.floor(Math.random() * 10) + 90 : // 90-99%
                    problemLevel === 'warning' ? 
                        Math.floor(Math.random() * 20) + 70 : // 70-89%
                        Math.floor(Math.random() * 50) + 20; // 20-69%
                
                backupServers.push({
                    hostname: `server-${i}`,
                    os: 'Linux',
                    uptime: '3 days, 12:30:15',
                    cpu_usage: cpuUsage,
                    memory_usage_percent: memoryUsage,
                    memory_total: '16GB',
                    memory_used: '8GB',
                    disk: [{
                        mount: '/',
                        disk_total: '500GB',
                        disk_used: '300GB',
                        disk_usage_percent: diskUsage
                    }],
                    load_avg_1m: (Math.random() * 5).toFixed(2),
                    load_avg_5m: (Math.random() * 4).toFixed(2),
                    load_avg_15m: (Math.random() * 3).toFixed(2),
                    process_count: Math.floor(Math.random() * 200) + 50,
                    zombie_count: Math.floor(Math.random() * 3),
                    timestamp: new Date().toISOString(),
                    net: {
                        interface: 'eth0',
                        rx_bytes: Math.floor(Math.random() * 1000000),
                        tx_bytes: Math.floor(Math.random() * 1000000),
                        rx_errors: Math.floor(Math.random() * 10),
                        tx_errors: Math.floor(Math.random() * 10)
                    },
                    services: {
                        'nginx': problemLevel === 'critical' ? 'stopped' : 'running',
                        'mysql': Math.random() > 0.9 ? 'stopped' : 'running',
                        'redis': Math.random() > 0.9 ? 'stopped' : 'running'
                    },
                    errors: problemLevel !== 'normal' ? 
                        [problemLevel === 'critical' ? 'Critical: 서버 응답 없음' : '경고: 높은 부하 감지'] : []
                });
            }
            
            // 전역 변수에 저장 및 이벤트 발생
            window.serverData = backupServers;
            this.handleDataUpdate(backupServers);
            
            // 이벤트 발생시키기
            const event = new CustomEvent('serverDataUpdated', { 
                detail: backupServers 
            });
            window.dispatchEvent(event);
            
        } catch (error) {
            console.error('백업 데이터 생성 중 오류:', error);
            
            // 최종 실패 시 오류 메시지 표시
            this.serverGrid.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    서버 데이터를 로드하지 못했습니다. 새로고침 버튼을 클릭하여 다시 시도해 주세요.
                </div>
            `;
        }
    }
    
    handleDataUpdate(data) {
        this.serverData = [...data]; // 데이터 복사
        this.hideLoading();
        
        // 추가 데이터 처리 (AI 분석 등)
        if (this.aiProcessor) {
            this.aiProcessor.updateData(this.serverData);
            this.updateProblemsList(); // AI 자동 장애 보고서 업데이트
        }
        
        // 필터 및 정렬 적용
        this.applyFiltersAndSort();
        this.updateGlobalStatusSummary(); // 서버 현황 요약 업데이트 추가
        this.updatePresetTagClasses(); // 프리셋 태그 클래스 업데이트
    }
    
    // 프리셋 태그 클래스 업데이트 (서버 상태에 따라 색상 동적 변경)
    updatePresetTagClasses() {
        // 1. CPU 과부하 프리셋
        const cpuPresetTag = document.getElementById('cpu-preset');
        if (cpuPresetTag) {
            const highCpuServers = this.serverData.filter(server => server.cpu_usage >= this.thresholds.warning.cpu);
            const criticalCpuServers = highCpuServers.filter(server => server.cpu_usage >= this.thresholds.critical.cpu);
            
            // 클래스 초기화 및 상태에 따라 설정
            cpuPresetTag.classList.remove('tag-normal', 'tag-warning', 'tag-critical');
            const badgeElement = cpuPresetTag.querySelector('.badge');
            
            if (criticalCpuServers.length > 0) {
                cpuPresetTag.classList.add('tag-critical');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-danger';
                    badgeElement.textContent = '심각';
                }
            } else if (highCpuServers.length > 0) {
                cpuPresetTag.classList.add('tag-warning');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-warning';
                    badgeElement.textContent = '경고';
                }
            } else {
                cpuPresetTag.classList.add('tag-normal');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-success';
                    badgeElement.textContent = '정상';
                }
            }
        }
        
        // 2. 메모리 부족 프리셋
        const memoryPresetTag = document.getElementById('memory-preset');
        if (memoryPresetTag) {
            const highMemoryServers = this.serverData.filter(server => server.memory_usage_percent >= this.thresholds.warning.memory);
            const criticalMemoryServers = highMemoryServers.filter(server => server.memory_usage_percent >= this.thresholds.critical.memory);
            
            // 클래스 초기화 및 상태에 따라 설정
            memoryPresetTag.classList.remove('tag-normal', 'tag-warning', 'tag-critical');
            const badgeElement = memoryPresetTag.querySelector('.badge');
            
            if (criticalMemoryServers.length > 0) {
                memoryPresetTag.classList.add('tag-critical');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-danger';
                    badgeElement.textContent = '심각';
                }
            } else if (highMemoryServers.length > 0) {
                memoryPresetTag.classList.add('tag-warning');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-warning';
                    badgeElement.textContent = '경고';
                }
            } else {
                memoryPresetTag.classList.add('tag-normal');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-success';
                    badgeElement.textContent = '정상';
                }
            }
        }
        
        // 3. 서비스 중단 프리셋
        const servicePresetTag = document.getElementById('service-preset');
        if (servicePresetTag) {
            const stoppedServiceServers = this.serverData.filter(server => 
                server.services && Object.values(server.services).some(status => status === 'stopped')
            );
            
            // 클래스 초기화 및 상태에 따라 설정
            servicePresetTag.classList.remove('tag-normal', 'tag-warning', 'tag-critical');
            const badgeElement = servicePresetTag.querySelector('.badge');
            
            if (stoppedServiceServers.length > 0) {
                servicePresetTag.classList.add('tag-critical');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-danger';
                    badgeElement.textContent = '심각';
                }
            } else {
                servicePresetTag.classList.add('tag-normal');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-success';
                    badgeElement.textContent = '정상';
                }
            }
        }
        
        // 4. 디스크 부족 프리셋
        const diskPresetTag = document.getElementById('disk-preset');
        if (diskPresetTag) {
            const highDiskServers = this.serverData.filter(server => 
                server.disk && 
                server.disk.length > 0 && 
                server.disk[0].disk_usage_percent >= this.thresholds.warning.disk
            );
            const criticalDiskServers = highDiskServers.filter(server => 
                server.disk[0].disk_usage_percent >= this.thresholds.critical.disk
            );
            
            // 클래스 초기화 및 상태에 따라 설정
            diskPresetTag.classList.remove('tag-normal', 'tag-warning', 'tag-critical');
            const badgeElement = diskPresetTag.querySelector('.badge');
            
            if (criticalDiskServers.length > 0) {
                diskPresetTag.classList.add('tag-critical');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-danger';
                    badgeElement.textContent = '심각';
                }
            } else if (highDiskServers.length > 0) {
                diskPresetTag.classList.add('tag-warning');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-warning';
                    badgeElement.textContent = '경고';
                }
            } else {
                diskPresetTag.classList.add('tag-normal');
                if (badgeElement) {
                    badgeElement.className = 'badge bg-success';
                    badgeElement.textContent = '정상';
                }
            }
        }
        
        // 5. 정상 서버 프리셋 (항상 정상 클래스 유지, 정상 배지만 표시)
        const normalPresetTag = document.getElementById('normal-preset');
        if (normalPresetTag) {
            const normalServers = this.serverData.filter(server => this.getServerStatus(server) === 'normal');
            
            normalPresetTag.classList.remove('tag-warning', 'tag-critical');
            normalPresetTag.classList.add('tag-normal');
            
            // 배지 업데이트
            const badgeElement = normalPresetTag.querySelector('.badge');
            if (badgeElement) {
                badgeElement.className = 'badge bg-success';
                badgeElement.textContent = `정상 (${normalServers.length})`;
            }
        }
    }
    
    refreshData() {
        this.showLoading();
        
        // 새로고침 버튼 상태 업데이트
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.setAttribute('disabled', 'disabled');
            const refreshContent = refreshBtn.querySelector('.refresh-content');
            const loadingContent = refreshBtn.querySelector('.loading-content');
            
            if (refreshContent) refreshContent.style.display = 'none';
            if (loadingContent) loadingContent.style.display = 'inline-block';
        }
        
        // 페이지 재로드가 아닌 데이터만 새로 생성
        if (typeof generateDummyData === 'function') {
            try {
                console.log('더미 데이터 다시 생성...');
                window.serverData = generateDummyData(10); // 30개에서 10개로 줄임
                
                // 데이터 업데이트 이벤트 발생시키기
                const event = new CustomEvent('serverDataUpdated', { 
                    detail: window.serverData 
                });
                window.dispatchEvent(event);
                
                // 3초 후 로딩 숨기기 (새로고침 효과)
                setTimeout(() => {
                    this.hideLoading();
                    
                    // 새로고침 버튼 상태 복원
                    this.resetRefreshButton(refreshBtn);
                }, 3000);
                
                return;
            } catch (e) {
                console.error('데이터 새로고침 중 오류:', e);
                // 오류 발생 시 원래 데이터로 UI 복원
                this.hideLoading();
                this.resetRefreshButton(refreshBtn);
                
                // 오류 메시지 표시
                const errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger alert-dismissible fade show';
                errorAlert.innerHTML = `
                    <strong>오류 발생!</strong> 데이터를 새로고침하는 중 문제가 발생했습니다.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                
                // 서버 그리드 위에 오류 메시지 삽입
                const parent = this.serverGrid.parentNode;
                parent.insertBefore(errorAlert, this.serverGrid);
                
                // 5초 후 자동으로 오류 메시지 제거
                setTimeout(() => {
                    if (errorAlert.parentNode) {
                        errorAlert.parentNode.removeChild(errorAlert);
                    }
                }, 5000);
                
                return;
            }
        }
        
        // 데이터가 업데이트되면 serverDataUpdated 이벤트로 처리됨
        // 하지만 10초 내에 업데이트가 없으면 현재 데이터로 UI 다시 로드
        setTimeout(() => {
            if (this.loadingIndicator.style.display !== 'none') {
                this.hideLoading();
                this.applyFiltersAndSort();
                
                // 새로고침 버튼 상태 복원
                this.resetRefreshButton(refreshBtn);
            }
        }, 10000);
    }
    
    // 새로고침 버튼 상태 초기화 유틸리티 메소드
    resetRefreshButton(refreshBtn) {
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.removeAttribute('disabled');
            const refreshContent = refreshBtn.querySelector('.refresh-content');
            const loadingContent = refreshBtn.querySelector('.loading-content');
            
            if (refreshContent) refreshContent.style.display = 'inline-block';
            if (loadingContent) loadingContent.style.display = 'none';
        }
    }
    
    showLoading() {
        this.loadingIndicator.style.display = 'block';
        this.serverGrid.style.opacity = '0.3';
    }
    
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
        this.serverGrid.style.opacity = '1';
    }
    
    applyFiltersAndSort() {
        try {
            // 필터 적용
            this.filteredData = this.serverData.filter(server => {
                // 검색어 필터
                if (this.searchQuery && !server.hostname.toLowerCase().includes(this.searchQuery)) {
                    return false;
                }
                
                // 상태 필터
                if (this.currentFilter !== 'all') {
                    const status = this.getServerStatus(server);
                    return status === this.currentFilter;
                }
                
                return true;
            });
            
            // 정렬 적용
            this.sortData();
            
            // UI 업데이트를 별도 메소드로 분리하여 안전하게 실행
            this.updateUI();
        } catch (error) {
            console.error('필터 및 정렬 적용 중 오류:', error);
            
            // 오류 발생 시 기본 처리
            this.filteredData = [...this.serverData];
            
            // 최소한의 UI 업데이트 시도
            this.hideLoading();
            this.safeUpdateServerGrid();
        }
    }
    
    // 안전하게 UI 요소들을 업데이트하는 메소드
    updateUI() {
        try {
            // 서버 그리드 업데이트
            this.updateServerGrid();
        } catch (e) {
            console.error('서버 그리드 업데이트 중 오류:', e);
            this.safeUpdateServerGrid();
        }
        
        try {
            // 페이지네이션 업데이트
            this.updateNumericPagination();
        } catch (e) {
            console.error('페이지네이션 업데이트 중 오류:', e);
        }
        
        try {
            // 서버 카운트 업데이트
            this.updateServerCount();
        } catch (e) {
            console.error('서버 카운트 업데이트 중 오류:', e);
        }
    }
    
    // 최소한의 안전한 서버 그리드 업데이트
    safeUpdateServerGrid() {
        if (!this.serverGrid) return;
        
        try {
            this.serverGrid.innerHTML = '';
            
            if (this.filteredData.length === 0) {
                this.serverGrid.innerHTML = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        검색 조건에 맞는 서버가 없습니다.
                    </div>
                `;
                return;
            }
            
            // 가장 기본적인 서버 목록만 표시
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredData.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const server = this.filteredData[i];
                if (!server) continue;
                
                const div = document.createElement('div');
                div.className = 'server-card';
                div.textContent = server.hostname || 'Unknown Server';
                this.serverGrid.appendChild(div);
            }
        } catch (e) {
            console.error('안전한 서버 그리드 업데이트 중 오류:', e);
            this.serverGrid.innerHTML = '<div class="alert alert-danger">서버 데이터 표시 중 오류가 발생했습니다.</div>';
        }
    }
    
    sortData() {
        switch(this.currentSort) {
            case 'name':
                this.filteredData.sort((a, b) => a.hostname.localeCompare(b.hostname));
                break;
            case 'cpu-high':
                this.filteredData.sort((a, b) => b.cpu_usage - a.cpu_usage);
                break;
            case 'cpu-low':
                this.filteredData.sort((a, b) => a.cpu_usage - b.cpu_usage);
                break;
            case 'memory-high':
                this.filteredData.sort((a, b) => b.memory_usage_percent - a.memory_usage_percent);
                break;
            case 'memory-low':
                this.filteredData.sort((a, b) => a.memory_usage_percent - b.memory_usage_percent);
                break;
            case 'disk-high':
                this.filteredData.sort((a, b) => b.disk[0].disk_usage_percent - a.disk[0].disk_usage_percent);
                break;
            case 'disk-low':
                this.filteredData.sort((a, b) => a.disk[0].disk_usage_percent - b.disk[0].disk_usage_percent);
                break;
            case 'status-critical':
                this.filteredData.sort((a, b) => {
                    const statusA = this.getServerStatus(a);
                    const statusB = this.getServerStatus(b);
                    const statusWeight = { 'critical': 3, 'warning': 2, 'normal': 1 };
                    return statusWeight[statusB] - statusWeight[statusA];
                });
                break;
            default:
                // 기본 정렬: 심각 > 경고 > 정상 순
                this.filteredData.sort((a, b) => {
                    const statusA = this.getServerStatus(a);
                    const statusB = this.getServerStatus(b);
                    const statusWeight = { 'critical': 3, 'warning': 2, 'normal': 1 };
                    return statusWeight[statusB] - statusWeight[statusA];
                });
        }
    }
    
    updateServerGrid() {
        if (!this.serverGrid) {
            console.error("서버 그리드 요소를 찾을 수 없습니다.");
            return;
        }
        
        this.serverGrid.innerHTML = '';
        
        // 현재 페이지 사이즈 설정 사용 (더 이상 고정 값 사용 안 함)
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredData.length);
        
        if (this.filteredData.length === 0) {
            this.serverGrid.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i>
                    검색 조건에 맞는 서버가 없습니다.
                </div>
            `;
            return;
        }
        
        for (let i = startIndex; i < endIndex; i++) {
            const server = this.filteredData[i];
            const serverCard = this.createServerCard(server);
            this.serverGrid.appendChild(serverCard);
        }
        
        // 페이지네이션 업데이트
        this.updateNumericPagination();
    }
    
    updateNumericPagination() {
        const paginationContainer = document.querySelector('.pagination-container');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        
        // 이전 페이지 버튼
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-sm btn-outline-secondary';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateServerGrid();
            }
        });
        paginationContainer.appendChild(prevBtn);
        
        // 페이지 번호 버튼
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // 표시할 페이지 버튼이 최대 개수보다 적을 경우 startPage 조정
        if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 첫 페이지로 이동 버튼 (필요 시)
        if (startPage > 1) {
            const firstPageBtn = document.createElement('button');
            firstPageBtn.className = 'btn btn-sm btn-outline-secondary mx-1';
            firstPageBtn.textContent = '1';
            firstPageBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.updateServerGrid();
            });
            paginationContainer.appendChild(firstPageBtn);
            
            // 생략 표시 (첫 페이지 버튼과 현재 범위 사이)
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'mx-1';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
        }
        
        // 페이지 버튼 생성
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn btn-sm mx-1 ${i === this.currentPage ? 'btn-primary' : 'btn-outline-secondary'}`;
            pageBtn.textContent = i.toString();
            pageBtn.addEventListener('click', () => {
                this.currentPage = i;
                this.updateServerGrid();
            });
            paginationContainer.appendChild(pageBtn);
        }
        
        // 마지막 페이지로 이동 버튼 (필요 시)
        if (endPage < totalPages) {
            // 생략 표시 (현재 범위와 마지막 페이지 버튼 사이)
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'mx-1';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
            
            const lastPageBtn = document.createElement('button');
            lastPageBtn.className = 'btn btn-sm btn-outline-secondary mx-1';
            lastPageBtn.textContent = totalPages.toString();
            lastPageBtn.addEventListener('click', () => {
                this.currentPage = totalPages;
                this.updateServerGrid();
            });
            paginationContainer.appendChild(lastPageBtn);
        }
        
        // 다음 페이지 버튼
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-sm btn-outline-secondary';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.updateServerGrid();
            }
        });
        paginationContainer.appendChild(nextBtn);
        
        // 현재 페이지 정보 업데이트
        if (this.currentPageElement) {
            this.currentPageElement.style.display = 'none'; // 기존 페이지 표시 숨김
        }
    }
    
    createServerCard(server) {
        if (!server) {
            console.error("서버 데이터가 없습니다.");
            return document.createElement('div'); // 빈 요소 반환
        }
        
        const status = this.getServerStatus(server);
        // 안전하게 services 체크
        const hasStoppedServices = server.services && Object.values(server.services).some(status => status === 'stopped');
        // 안전하게 errors 체크
        const hasErrors = server.errors && Array.isArray(server.errors) && server.errors.length > 0;
        
        // 서버 카드 생성
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card status-' + status;
        serverCard.dataset.serverId = server.hostname || 'unknown';
        
        // 툴팁 요소 추가
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-wrapper';
        tooltip.innerHTML = `
            <div class="tooltip-content">
                클릭하여 ${server.hostname} 서버의 상세 정보를 확인하세요.
            </div>
        `;
        serverCard.appendChild(tooltip);
        
        // 카드 클릭 시 상세 정보 모달 표시
        serverCard.addEventListener('click', () => this.showServerDetail(server));
        
        // CPU, 메모리, 디스크 사용률을 안전하게 가져오기
        const cpuUsage = server.cpu_usage || 0;
        const memoryUsage = server.memory_usage_percent || 0;
        const diskUsage = server.disk && server.disk[0] ? server.disk[0].disk_usage_percent || 0 : 0;
        const diskMount = server.disk && server.disk[0] ? server.disk[0].mount || '/' : '/';
        
        // 리소스 상태 판별
        const cpuStatus = this.getResourceStatus(cpuUsage, 'cpu');
        const memoryStatus = this.getResourceStatus(memoryUsage, 'memory');
        const diskStatus = this.getResourceStatus(diskUsage, 'disk');
        
        // 상태별 색상 클래스
        const getStatusColorClass = (status) => {
            switch(status) {
                case 'critical': return 'text-danger';
                case 'warning': return 'text-warning';
                default: return 'text-success';
            }
        };
        
        // 상태 아이콘 가져오기
        const getStatusIcon = (status) => {
            switch(status) {
                case 'critical': return '<i class="fas fa-exclamation-circle me-1"></i>';
                case 'warning': return '<i class="fas fa-exclamation-triangle me-1"></i>';
                default: return '<i class="fas fa-check-circle me-1"></i>';
            }
        };
        
        // 카드 내용 구성
        serverCard.innerHTML = `
            <div class="card-interaction-hint">
                <i class="fas fa-info-circle"></i>
            </div>
            <div class="server-header">
                <div class="server-name">${escapeHtml(server.hostname) || 'Unknown Server'}</div>
                <div class="server-status status-${status}">${this.getStatusLabel(status)}</div>
            </div>
            <div class="server-details">
                <div class="detail-item">
                    <div class="detail-label">CPU 사용량</div>
                    <div class="detail-value ${getStatusColorClass(cpuStatus)}">
                        ${getStatusIcon(cpuStatus)}<strong>${cpuUsage}%</strong>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${cpuStatus}" 
                             style="width: ${cpuUsage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">메모리</div>
                    <div class="detail-value ${getStatusColorClass(memoryStatus)}">
                        ${getStatusIcon(memoryStatus)}<strong>${typeof memoryUsage === 'number' ? memoryUsage.toFixed(1) : '0'}%</strong>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${memoryStatus}" 
                             style="width: ${memoryUsage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">디스크 (${diskMount})</div>
                    <div class="detail-value ${getStatusColorClass(diskStatus)}">
                        ${getStatusIcon(diskStatus)}<strong>${typeof diskUsage === 'number' ? diskUsage.toFixed(1) : '0'}%</strong>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${diskStatus}" 
                             style="width: ${diskUsage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">로드 평균</div>
                    <div class="detail-value">${server.load_avg_1m || '0'}</div>
                </div>
            </div>
            <div class="services-list">
                ${server.services ? Object.entries(server.services).map(([name, status]) => `
                    <div class="service-badge service-${escapeHtml(status)}">${escapeHtml(name)} (${escapeHtml(status)})</div>
                `).join('') : '<div class="service-badge">서비스 정보 없음</div>'}
            </div>
            ${hasErrors ? `
                <div class="error-messages">
                    <i class="bi bi-exclamation-triangle-fill"></i> ${server.errors.length}개의 오류
                </div>
            ` : ''}
        `;
        
        return serverCard;
    }
    
    showServerDetail(server) {
        if (!server) {
            console.error("서버 데이터가 없습니다.");
            return;
        }
        
        try {
            // 부트스트랩 모달 요소 및 내용을 찾기
            const modalElement = document.getElementById('serverDetailModal');
            if (!modalElement) {
                console.error("모달 요소(serverDetailModal)를 찾을 수 없습니다.");
                return;
            }
            
            // 모달 헤더 내에서 제목 요소 찾기
            const modalTitle = modalElement.querySelector('.modal-title');
            if (!modalTitle) {
                console.error("모달 제목 요소를 찾을 수 없습니다.");
                return;
            }
            
            // 모달 내용을 표시할 요소 찾기
            const modalBody = modalElement.querySelector('.modal-body');
            if (!modalBody) {
                console.error("모달 내용 요소를 찾을 수 없습니다.");
                return;
            }
            
            // 서버 상태 정보
            const status = this.getServerStatus(server);
            
            // 서버 이름과 상태 설정 (escapeHtml로 XSS 방지)
            modalTitle.innerHTML = `
                ${escapeHtml(server.hostname)}
                <span class="server-status status-${escapeHtml(status)}">${this.getStatusLabel(status)}</span>
            `;
            
            // 모달 내용 업데이트 - 개별 필드 업데이트 방식으로 변경
            // OS 정보
            const modalOS = document.getElementById('modalOS');
            if (modalOS) modalOS.textContent = server.os || '-';
            
            // 가동 시간
            const modalUptime = document.getElementById('modalUptime');
            if (modalUptime) modalUptime.textContent = server.uptime || '-';
            
            // 프로세스 수
            const modalProcessCount = document.getElementById('modalProcessCount');
            if (modalProcessCount) modalProcessCount.textContent = server.process_count || '-';
            
            // 좀비 프로세스
            const modalZombieCount = document.getElementById('modalZombieCount');
            if (modalZombieCount) modalZombieCount.textContent = server.zombie_count || '-';
            
            // 로드 평균
            const modalLoadAvg = document.getElementById('modalLoadAvg');
            if (modalLoadAvg) modalLoadAvg.textContent = server.load_avg_1m || '-';
            
            // 마지막 업데이트
            const modalLastUpdate = document.getElementById('modalLastUpdate');
            if (modalLastUpdate) modalLastUpdate.textContent = new Date(server.timestamp).toLocaleString() || '-';
            
            // 네트워크 정보
            const modalNetInterface = document.getElementById('modalNetInterface');
            if (modalNetInterface) modalNetInterface.textContent = server.net?.interface || '-';
            
            const modalRxBytes = document.getElementById('modalRxBytes');
            if (modalRxBytes) modalRxBytes.textContent = this.formatBytes(server.net?.rx_bytes) || '-';
            
            const modalTxBytes = document.getElementById('modalTxBytes');
            if (modalTxBytes) modalTxBytes.textContent = this.formatBytes(server.net?.tx_bytes) || '-';
            
            const modalRxErrors = document.getElementById('modalRxErrors');
            if (modalRxErrors) modalRxErrors.textContent = server.net?.rx_errors || '-';
            
            const modalTxErrors = document.getElementById('modalTxErrors');
            if (modalTxErrors) modalTxErrors.textContent = server.net?.tx_errors || '-';
            
            // 서비스 상태
            const modalServiceStatus = document.getElementById('modalServiceStatus');
            if (modalServiceStatus) {
                modalServiceStatus.innerHTML = '';
                
                if (server.services && Object.keys(server.services).length > 0) {
                    Object.entries(server.services).forEach(([name, status]) => {
                        const serviceTag = document.createElement('div');
                        serviceTag.className = `service-status-tag service-${escapeHtml(status)}`;
                        serviceTag.innerHTML = `
                            ${escapeHtml(name)}
                            <span class="status-indicator">
                                <i class="fas fa-${status === 'running' ? 'check-circle' : 'times-circle'}"></i>
                            </span>
                        `;
                        modalServiceStatus.appendChild(serviceTag);
                    });
                } else {
                    modalServiceStatus.innerHTML = '<div class="alert alert-info">서비스 정보가 없습니다.</div>';
                }
            }
            
            // 오류 메시지
            const modalErrorsContainer = document.getElementById('modalErrorsContainer');
            if (modalErrorsContainer) {
                if (server.errors && server.errors.length > 0) {
                    modalErrorsContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <ul class="mb-0">
                                ${server.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                } else {
                    modalErrorsContainer.innerHTML = '<div class="alert alert-info">현재 보고된 오류가 없습니다.</div>';
                }
            }
            
            // jQuery로 모달 표시 시도 (부트스트랩 의존성 줄이기)
            if (window.jQuery && window.jQuery.fn.modal) {
                window.jQuery(modalElement).modal('show');
                
                // 리소스 차트 생성
                this.createResourceChart(server);
                
                // 서버 이름을 서버 이름 요소에 설정
                const modalServerName = document.getElementById('modalServerName');
                if (modalServerName) modalServerName.textContent = `${server.hostname} 상세 정보`;
                
                return; // jQuery로 성공적으로 표시했으면 여기서 종료
            }
            
            // 부트스트랩 모달 인스턴스 생성 및 표시
            if (typeof bootstrap !== 'undefined' && typeof bootstrap.Modal === 'function') {
                // 부트스트랩 5+
                const bsModal = new bootstrap.Modal(modalElement);
                bsModal.show();
            } else {
                // 순수 JavaScript로 모달 표시 (fallback)
                modalElement.style.display = 'block';
                modalElement.classList.add('show');
                document.body.classList.add('modal-open');
                
                // 배경 요소 추가
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
                
                // 닫기 버튼에 이벤트 리스너 추가
                const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"]');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        modalElement.style.display = 'none';
                        modalElement.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        document.querySelector('.modal-backdrop')?.remove();
                    });
                });
            }
            
            // 리소스 차트 생성
            this.createResourceChart(server);
            
            // 서버 이름을 서버 이름 요소에 설정
            const modalServerName = document.getElementById('modalServerName');
            if (modalServerName) modalServerName.textContent = `${server.hostname} 상세 정보`;
        } catch (error) {
            console.error('서버 상세 정보 표시 중 오류 발생:', error);
            alert('서버 상세 정보를 표시할 수 없습니다.');
        }
    }
    
    closeModal() {
        this.modalElement.style.display = 'none';
    }
    
    createResourceChart(server) {
        const chartElement = document.getElementById('resourceBarChart');
        if (!chartElement) {
            console.error("리소스 차트 요소(resourceBarChart)를 찾을 수 없습니다.");
            return;
        }
        
        const ctx = chartElement.getContext('2d');
        if (!ctx) {
            console.error("리소스 차트 컨텍스트를 가져올 수 없습니다.");
            return;
        }
        
        // 기존 차트가 있다면 파괴
        if (this.resourceChartInstance) {
            this.resourceChartInstance.destroy();
        }
        
        this.resourceChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CPU', '메모리', '디스크'],
                datasets: [{
                    label: '사용량 (%)',
                    data: [
                        server.cpu_usage || 0, 
                        server.memory_usage_percent || 0, 
                        (server.disk && server.disk.length > 0) ? server.disk[0].disk_usage_percent || 0 : 0
                    ],
                    backgroundColor: [
                        this.getChartColor(server.cpu_usage || 0),
                        this.getChartColor(server.memory_usage_percent || 0),
                        this.getChartColor((server.disk && server.disk.length > 0) ? server.disk[0].disk_usage_percent || 0 : 0)
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
    
    createHistoryChart(hostname) {
        const historicalData = window.serverHistoricalData[hostname];
        if (!historicalData || historicalData.length === 0) return;
        
        // history-chart-modal ID를 사용하도록 수정
        const canvasElement = document.getElementById('history-chart-modal');
        if (!canvasElement) {
            console.error("History chart canvas element not found in modal");
            return;
        }
        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
            console.error("히스토리 차트 컨텍스트를 가져올 수 없습니다.");
            return;
        }
        
        // 기존 차트가 있다면 파괴
        if (this.historyChartInstance) {
            this.historyChartInstance.destroy();
        }

        // 시간 레이블 생성 (최근 24시간)
        const labels = historicalData.map(data => {
            const date = new Date(data.timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        
        // CPU, 메모리, 디스크 데이터 추출
        const cpuData = historicalData.map(data => data.cpu_usage);
        const memoryData = historicalData.map(data => data.memory_usage_percent);
        const diskData = historicalData.map(data => data.disk[0].disk_usage_percent);
        
        this.historyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'CPU',
                        data: cpuData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: '메모리',
                        data: memoryData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: '디스크',
                        data: diskData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderWidth: 2,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '사용량 (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '시간'
                        }
                    }
                }
            }
        });
    }
    
    updateProblemsList() {
        if (!this.aiProcessor) return;
        
        const problemListContainer = document.getElementById('aiProblemList');
        const loadingIndicator = document.getElementById('aiProblemsLoading');
        const emptyIndicator = document.getElementById('aiProblemsEmpty');
        const paginationContainer = document.querySelector('.problem-pagination');

        if (!problemListContainer || !loadingIndicator || !emptyIndicator) {
            console.error("AI Problem list UI elements not found.");
            return;
        }

        loadingIndicator.style.display = 'block';
        emptyIndicator.style.display = 'none';
        problemListContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';

        try {
            // detectProblems 메소드가 존재하고 호출 가능한지 확인
            let problems = [];
            if (typeof this.aiProcessor.detectProblems === 'function') {
                problems = this.aiProcessor.detectProblems();
            } else {
                console.warn("AI 프로세서에 detectProblems 메소드가 없습니다. 기본 문제 감지 로직을 사용합니다.");
                // 기본 문제 감지 로직: 리소스 사용량이 높은 서버 감지
                problems = this.serverData.filter(server => {
                    const status = this.getServerStatus(server);
                    if (status === 'critical') {
                        return {
                            severity: 'Critical',
                            serverHostname: server.hostname,
                            description: `리소스 과부하 감지`,
                            solution: '서버 자원 확인 및 불필요한 프로세스를 종료하세요.'
                        };
                    } else if (status === 'warning') {
                        return {
                            severity: 'Warning',
                            serverHostname: server.hostname,
                            description: `자원 사용량 높음`,
                            solution: '서버 상태를 모니터링하고 추세를 확인하세요.'
                        };
                    }
                    return null;
                }).filter(p => p !== null);
            }
            
            // 결과가 배열이 아니거나 undefined인 경우 빈 배열로 처리
            if (!Array.isArray(problems)) {
                console.warn("detectProblems() 함수가 배열을 반환하지 않았습니다.");
                problems = [];
            }
            
            // Normal 상태는 제외 (detectProblems에서 이미 처리되었거나, 여기서 한번 더 필터링)
            problems = problems.filter(p => p && (p.severity === 'Critical' || p.severity === 'Warning' || p.severity === 'Error'));
    
            // 정렬: Critical 우선, 그 다음 Warning(Error 포함) (내림차순)
            problems.sort((a, b) => {
                const severityScore = (severity) => {
                    if (severity === 'Critical') return 2;
                    if (severity === 'Warning' || severity === 'Error') return 1;
                    return 0; // 그 외 (정상 등, 실제로는 필터링됨)
                };
                return severityScore(b.severity) - severityScore(a.severity);
            });
    
            loadingIndicator.style.display = 'none';
        
            if (problems.length === 0) {
                emptyIndicator.style.display = 'block';
                return;
            }

            // 전체 문제 데이터 저장
            this.problemsData = problems;
            
            // 페이지네이션 계산
            const totalProblems = problems.length;
            const totalPages = Math.ceil(totalProblems / this.problemsPerPage);
            
            // 현재 페이지가 범위를 벗어나면 조정
            if (this.currentProblemPage > totalPages) {
                this.currentProblemPage = totalPages;
            }
            
            // 현재 페이지에 표시할 문제 계산
            const startIdx = (this.currentProblemPage - 1) * this.problemsPerPage;
            const endIdx = Math.min(startIdx + this.problemsPerPage, totalProblems);
            const currentPageProblems = problems.slice(startIdx, endIdx);
            
            // 문제 항목 렌더링
            currentPageProblems.forEach((problem, index) => {
                const listItem = document.createElement('li');
                listItem.className = `list-group-item list-group-item-action problem-item severity-${problem.severity.toLowerCase()}`;
                // 인덱스 변수 추가
                listItem.style.setProperty('--item-index', index);
                
                listItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 problem-description">${problem.description}</h6>
                        <small class="text-muted">${problem.serverHostname || '알 수 없는 서버'}</small>
                    </div>
                    <p class="mb-1 problem-solution">${problem.solution || '제안된 해결책 없음'}</p>
                    <small class="text-muted">심각도: <span class="fw-bold problem-severity-text">${problem.severity}</span></small>
                    <div class="problem-hint-icon">
                        <i class="fas fa-search-plus"></i>
                    </div>
                `;
                
                // 문제 항목 클릭 시 액션 (서버 상세 모달)
                listItem.addEventListener('click', () => {
                    // 상세 보고서 모달 표시
                    this.showProblemDetailModal(problem);
                });
                
                problemListContainer.appendChild(listItem);
            });
            
            // 페이지네이션 생성
            if (paginationContainer && totalPages > 1) {
                // 이전 페이지 버튼
                const prevBtn = document.createElement('button');
                prevBtn.className = 'btn btn-sm btn-outline-secondary';
                prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                prevBtn.disabled = this.currentProblemPage === 1;
                prevBtn.addEventListener('click', () => {
                    if (this.currentProblemPage > 1) {
                        this.currentProblemPage--;
                        this.updateProblemsList();
                    }
                });
                paginationContainer.appendChild(prevBtn);
                
                // 페이지 번호 버튼
                const maxVisiblePages = 5;
                let startPage = Math.max(1, this.currentProblemPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                // 표시할 페이지 버튼 조정
                if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                // 페이지 버튼 생성
                for (let i = startPage; i <= endPage; i++) {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = `btn btn-sm mx-1 ${i === this.currentProblemPage ? 'btn-primary' : 'btn-outline-secondary'}`;
                    pageBtn.textContent = i.toString();
                    pageBtn.addEventListener('click', () => {
                        this.currentProblemPage = i;
                        this.updateProblemsList();
                    });
                    paginationContainer.appendChild(pageBtn);
                }
                
                // 다음 페이지 버튼
                const nextBtn = document.createElement('button');
                nextBtn.className = 'btn btn-sm btn-outline-secondary';
                nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                nextBtn.disabled = this.currentProblemPage === totalPages;
                nextBtn.addEventListener('click', () => {
                    if (this.currentProblemPage < totalPages) {
                        this.currentProblemPage++;
                        this.updateProblemsList();
                    }
                });
                paginationContainer.appendChild(nextBtn);
            }
        } catch (error) {
            console.error("AI 문제 목록 업데이트 중 오류 발생:", error);
            loadingIndicator.style.display = 'none';
            emptyIndicator.textContent = "문제 목록을 불러오는 중 오류가 발생했습니다.";
            emptyIndicator.style.display = 'block';
        }
    }
    
    // 서버 수 표시 업데이트하는 메소드
    updateServerCount() {
        if (!this.serverCount) return;
        
        try {
            const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);
            const startIndex = this.filteredData.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
            
            if (this.filteredData.length > 0) {
                this.serverCount.textContent = `전체 ${this.serverData.length} 서버 중 ${startIndex}-${endIndex} 표시 중`;
            } else {
                this.serverCount.textContent = `전체 ${this.serverData.length} 서버 중 0 표시 중`;
            }
        } catch (e) {
            console.error("서버 카운트 업데이트 중 오류:", e);
        }
    }
    
    updateGlobalStatusSummary() {
        if (!this.serverData || this.serverData.length === 0) return;

        const summaryContainer = document.getElementById('statusSummaryContainer');
        if (!summaryContainer) {
            console.error("Status summary container not found.");
            return;
        }

        let normalCount = 0;
        let warningCount = 0;
        let criticalCount = 0;

        this.serverData.forEach(server => {
            const status = this.getServerStatus(server); // 중앙 집중식 상태 판단 함수 사용
            if (status === 'normal') normalCount++;
            else if (status === 'warning') warningCount++;
            else if (status === 'critical') criticalCount++;
        });

        // 타임스탬프 업데이트
        const timestampElement = document.getElementById('timestamp');
        if (timestampElement) {
            const latestTimestamp = this.serverData.reduce((latest, server) => {
                const serverTime = new Date(server.timestamp).getTime();
                return serverTime > latest ? serverTime : latest;
            }, 0);
            
            if (latestTimestamp > 0) {
                timestampElement.textContent = `데이터 기준 시각: ${new Date(latestTimestamp).toLocaleString()}`;
            } else {
                timestampElement.textContent = `데이터 기준 시각: ${new Date().toLocaleString()}`;
            }
        }

        summaryContainer.innerHTML = `
            <div class="row mb-3">
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6 text-success">${normalCount}</h3>
                    <p class="text-success mb-0">정상</p>
                </div>
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6 text-warning">${warningCount}</h3>
                    <p class="text-warning mb-0">경고</p>
                </div>
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6 text-danger">${criticalCount}</h3>
                    <p class="text-danger mb-0">심각</p>
                </div>
            </div>
            <div>
                <canvas id="globalStatusChart" height="150"></canvas>
            </div>
        `;
        
        // 상태 알림 생성 및 표시
        this.updateStatusAlert(normalCount, warningCount, criticalCount);

        // 차트 업데이트
        const chartElement = document.getElementById('globalStatusChart');
        if (!chartElement) {
            console.error("Global status chart element not found.");
            return;
        }
        
        const chartCtx = chartElement.getContext('2d');
        if (!chartCtx) {
            console.error("Global status chart context could not be obtained.");
            return;
        }
        
        if (this.globalStatusChartInstance) {
            this.globalStatusChartInstance.destroy();
        }
        
        if (normalCount === 0 && warningCount === 0 && criticalCount === 0) {
            // 데이터가 없는 경우 빈 차트가 아닌 메시지 표시
            chartElement.parentElement.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="fas fa-info-circle me-2"></i>
                    표시할 서버 상태 데이터가 없습니다.
                </div>
            `;
            return;
        }
        
        this.globalStatusChartInstance = new Chart(chartCtx, {
            type: 'doughnut',
            data: {
                labels: ['정상', '경고', '심각'],
                datasets: [{
                    data: [normalCount, warningCount, criticalCount],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.7)', // 정상 (초록 계열)
                        'rgba(253, 154, 20, 0.7)', // 경고 (주황 계열)
                        'rgba(220, 53, 69, 0.7)'  // 심각 (빨강 계열)
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(253, 154, 20, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed + ' 대';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
        // 서버 수 표시 업데이트
        this.updateServerCount();
    }
    
    // 서버 상태 요약 알림 업데이트
    updateStatusAlert(normalCount, warningCount, criticalCount) {
        const alertElement = document.getElementById('statusSummaryAlert');
        if (!alertElement) return;
        
        const iconContainer = alertElement.querySelector('.status-icon');
        const messageContainer = alertElement.querySelector('.status-message');
        
        if (!iconContainer || !messageContainer) return;
        
        const totalServers = normalCount + warningCount + criticalCount;
        
        // 상태 결정 (최악의 상태를 기준으로)
        let status = 'normal';
        if (criticalCount > 0) status = 'critical';
        else if (warningCount > 0) status = 'warning';
        
        // 알림 클래스와 아이콘 설정
        let alertClass, iconHTML, message;
        
        switch(status) {
            case 'critical':
                alertClass = 'alert-danger';
                iconHTML = '<i class="fas fa-exclamation-circle fa-2x"></i>';
                
                if (criticalCount === 1) {
                    message = `<strong>긴급 주의 필요:</strong> 1개 서버가 심각한 상태입니다. 즉시 확인이 필요합니다.`;
                } else {
                    message = `<strong>긴급 주의 필요:</strong> ${criticalCount}개 서버가 심각한 상태입니다. 즉시 확인이 필요합니다.`;
                }
                break;
                
            case 'warning':
                alertClass = 'alert-warning';
                iconHTML = '<i class="fas fa-exclamation-triangle fa-2x"></i>';
                
                if (warningCount === 1) {
                    message = `<strong>주의:</strong> 1개 서버에 경고 상태가 감지되었습니다. 상태를 확인해 주세요.`;
                } else {
                    message = `<strong>주의:</strong> ${warningCount}개 서버에 경고 상태가 감지되었습니다. 상태를 확인해 주세요.`;
                }
                break;
                
            default: // normal
                alertClass = 'alert-success';
                iconHTML = '<i class="fas fa-check-circle fa-2x"></i>';
                message = `<strong>모두 정상:</strong> 현재 ${totalServers}개의 서버가 모두 정상 작동 중입니다.`;
        }
        
        // 알림 업데이트
        alertElement.className = `alert d-flex align-items-center ${alertClass}`;
        iconContainer.innerHTML = iconHTML;
        messageContainer.innerHTML = message;
        
        // 애니메이션 효과로 표시
        alertElement.style.display = 'flex';
        alertElement.style.opacity = '0';
        alertElement.style.transform = 'translateY(-10px)';
        
        // 부드럽게 표시
        setTimeout(() => {
            alertElement.style.transition = 'all 0.5s ease';
            alertElement.style.opacity = '1';
            alertElement.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // 프리셋 쿼리 처리 개선
    processPresetQuery(query) {
        if (!this.aiProcessor) return "AI 프로세서를 초기화할 수 없습니다.";
        
        // 서버 상태 데이터 수집
        const criticalServers = this.serverData.filter(server => this.getServerStatus(server) === 'critical');
        const warningServers = this.serverData.filter(server => this.getServerStatus(server) === 'warning');
        const normalServers = this.serverData.filter(server => this.getServerStatus(server) === 'normal');
        
        // AI 장애 보고서 데이터 가져오기 (있을 경우)
        let aiProblemsData = [];
        if (this.problemsData && Array.isArray(this.problemsData)) {
            aiProblemsData = [...this.problemsData];
        } else if (typeof this.aiProcessor.detectProblems === 'function') {
            try {
                aiProblemsData = this.aiProcessor.detectProblems();
            } catch (err) {
                console.warn("AI 문제 데이터를 가져오는 중 오류 발생:", err);
            }
        }
        
        // CPU 과부하 관련 쿼리
        if (query.includes("CPU 사용률이 높은 서버") || query.includes("CPU 과부하")) {
            const highCpuServers = this.serverData.filter(server => server.cpu_usage >= this.thresholds.warning.cpu);
            
            // 서버 상태에 따라 응답 형식 조정
            if (highCpuServers.length === 0) {
                return `### CPU 사용률 분석 결과
                
현재 CPU 사용률이 높은 서버가 없습니다. 모든 서버가 정상적인 CPU 사용률을 보이고 있습니다.

**총 서버 수**: ${this.serverData.length}대
**평균 CPU 사용률**: ${(this.serverData.reduce((acc, server) => acc + server.cpu_usage, 0) / this.serverData.length).toFixed(1)}%

모든 서버의 CPU 사용률이 정상 범위(${this.thresholds.warning.cpu}% 미만) 내에 있습니다.`;
            }
            
            // 해당 문제와 관련된 AI 장애 보고서 항목 찾기
            const cpuRelatedProblems = aiProblemsData.filter(problem => 
                problem.description && problem.description.toLowerCase().includes('cpu')
            );
            
            let response = `### CPU 사용률 분석 결과

CPU 사용률이 높은 서버가 ${highCpuServers.length}대 발견되었습니다.

`;
            
            // 심각한 수준(Critical)의 서버 먼저 표시
            const criticalCpuServers = highCpuServers.filter(server => server.cpu_usage >= this.thresholds.critical.cpu);
            if (criticalCpuServers.length > 0) {
                response += `#### 심각한 CPU 과부하 (${this.thresholds.critical.cpu}% 이상)
`;
                criticalCpuServers.forEach(server => {
                    response += `- **${server.hostname}**: CPU ${server.cpu_usage}% (심각)
  - 프로세스 수: ${server.process_count || '정보 없음'}
  - 부하 평균: ${server.load_avg_1m || '정보 없음'}
`;
                });
                response += "\n";
            }
            
            // 경고 수준(Warning)의 서버 표시
            const warningCpuServers = highCpuServers.filter(server => 
                server.cpu_usage >= this.thresholds.warning.cpu && 
                server.cpu_usage < this.thresholds.critical.cpu
            );
            if (warningCpuServers.length > 0) {
                response += `#### 경고 수준의 CPU 사용 (${this.thresholds.warning.cpu}% ~ ${this.thresholds.critical.cpu-0.1}%)
`;
                warningCpuServers.forEach(server => {
                    response += `- **${server.hostname}**: CPU ${server.cpu_usage}% (경고)
  - 프로세스 수: ${server.process_count || '정보 없음'}
  - 부하 평균: ${server.load_avg_1m || '정보 없음'}
`;
                });
                response += "\n";
            }
            
            // 문제 원인 및 해결 방안 (AI 장애 보고서에서 가져옴)
            response += "### 원인 분석 및 조치 방안\n\n";
            
            if (cpuRelatedProblems.length > 0) {
                cpuRelatedProblems.forEach((problem, index) => {
                    if (index < 3) { // 상위 3개만 표시
                        response += `${index+1}. **${problem.serverHostname || '전체 서버'}**: ${problem.description}\n`;
                        response += `   - 권장 조치: ${problem.solution || '서버 부하 원인 확인 필요'}\n\n`;
                    }
                });
            } else {
                response += `1. **높은 CPU 사용률 원인**: 서버에서 리소스를 많이 사용하는 프로세스가 실행 중이거나, 동시에 많은 요청이 처리되고 있을 수 있습니다.\n`;
                response += `   - 권장 조치: 'top' 명령어로 CPU를 많이 사용하는 프로세스를 확인하고, 불필요한 프로세스 종료나 부하 분산을 고려하세요.\n\n`;
                response += `2. **성능 병목 현상**: CPU 사용률이 지속적으로 높은 경우 성능 병목 현상이 발생할 수 있습니다.\n`;
                response += `   - 권장 조치: 서버 스케일 업 또는 로드 밸런싱을 통한 스케일 아웃을 검토하세요.\n\n`;
            }
            
            return response;
        }
        
        // 메모리 부족 관련 쿼리
        else if (query.includes("메모리 사용량이 많은 서버") || query.includes("메모리 부족")) {
            const highMemoryServers = this.serverData.filter(server => server.memory_usage_percent >= this.thresholds.warning.memory);
            
            // 서버 상태에 따라 응답 형식 조정
            if (highMemoryServers.length === 0) {
                return `### 메모리 사용량 분석 결과
                
현재 메모리 사용량이 높은 서버가 없습니다. 모든 서버가 정상적인 메모리 사용량을 보이고 있습니다.

**총 서버 수**: ${this.serverData.length}대
**평균 메모리 사용률**: ${(this.serverData.reduce((acc, server) => acc + server.memory_usage_percent, 0) / this.serverData.length).toFixed(1)}%

모든 서버의 메모리 사용률이 정상 범위(${this.thresholds.warning.memory}% 미만) 내에 있습니다.`;
            }
            
            // 해당 문제와 관련된 AI 장애 보고서 항목 찾기
            const memoryRelatedProblems = aiProblemsData.filter(problem => 
                problem.description && (
                    problem.description.toLowerCase().includes('memory') || 
                    problem.description.toLowerCase().includes('메모리')
                )
            );
            
            let response = `### 메모리 사용량 분석 결과

메모리 사용량이 높은 서버가 ${highMemoryServers.length}대 발견되었습니다.

`;
            
            // 심각한 수준(Critical)의 서버 먼저 표시
            const criticalMemServers = highMemoryServers.filter(server => server.memory_usage_percent >= this.thresholds.critical.memory);
            if (criticalMemServers.length > 0) {
                response += `#### 심각한 메모리 부족 (${this.thresholds.critical.memory}% 이상)
`;
                criticalMemServers.forEach(server => {
                    response += `- **${server.hostname}**: 메모리 ${server.memory_usage_percent}% (심각)
  - 총 메모리: ${server.memory_total || '정보 없음'}
  - 사용 메모리: ${server.memory_used || '정보 없음'}
`;
                });
                response += "\n";
            }
            
            // 경고 수준(Warning)의 서버 표시
            const warningMemServers = highMemoryServers.filter(server => 
                server.memory_usage_percent >= this.thresholds.warning.memory && 
                server.memory_usage_percent < this.thresholds.critical.memory
            );
            if (warningMemServers.length > 0) {
                response += `#### 경고 수준의 메모리 사용 (${this.thresholds.warning.memory}% ~ ${this.thresholds.critical.memory-0.1}%)
`;
                warningMemServers.forEach(server => {
                    response += `- **${server.hostname}**: 메모리 ${server.memory_usage_percent}% (경고)
  - 총 메모리: ${server.memory_total || '정보 없음'}
  - 사용 메모리: ${server.memory_used || '정보 없음'}
`;
                });
                response += "\n";
            }
            
            // 문제 원인 및 해결 방안 (AI 장애 보고서에서 가져옴)
            response += "### 원인 분석 및 조치 방안\n\n";
            
            if (memoryRelatedProblems.length > 0) {
                memoryRelatedProblems.forEach((problem, index) => {
                    if (index < 3) { // 상위 3개만 표시
                        response += `${index+1}. **${problem.serverHostname || '전체 서버'}**: ${problem.description}\n`;
                        response += `   - 권장 조치: ${problem.solution || '메모리 누수 또는 과다 사용 프로세스 확인 필요'}\n\n`;
                    }
                });
            } else {
                response += `1. **높은 메모리 사용률 원인**: 서버에서 메모리 누수가 있거나, 메모리를 많이 사용하는 애플리케이션이 실행 중일 수 있습니다.\n`;
                response += `   - 권장 조치: 'free -m', 'top' 명령어로 메모리를 많이 사용하는 프로세스를 확인하고, 필요시 재시작하세요.\n\n`;
                response += `2. **스왑 사용 확인**: 메모리 부족 시 스왑 사용량이 증가할 수 있습니다.\n`;
                response += `   - 권장 조치: 'vmstat' 명령어로 스왑 사용량을 확인하고, 메모리 증설을 고려하세요.\n\n`;
            }
            
            return response;
        }
        
        // 서비스 중단 관련 쿼리
        else if (query.includes("서비스가 중단된 서버")) {
            // 서비스 중단 서버 찾기
            const stoppedServiceServers = this.serverData.filter(server => 
                server.services && Object.values(server.services).some(status => status === 'stopped')
            );
            
            // 서버 상태에 따라 응답 형식 조정
            if (stoppedServiceServers.length === 0) {
                return `### 서비스 상태 분석 결과
                
현재 중단된 서비스가 있는 서버가 없습니다. 모든 서버의 서비스가 정상 작동 중입니다.

**총 서버 수**: ${this.serverData.length}대

모든 서버에서 서비스가 정상적으로 실행 중입니다.`;
            }
            
            // 해당 문제와 관련된 AI 장애 보고서 항목 찾기
            const serviceRelatedProblems = aiProblemsData.filter(problem => 
                problem.description && (
                    problem.description.toLowerCase().includes('service') || 
                    problem.description.toLowerCase().includes('서비스')
                )
            );
            
            let response = `### 서비스 상태 분석 결과

서비스가 중단된 서버가 ${stoppedServiceServers.length}대 발견되었습니다.

#### 중단된 서비스가 있는 서버
`;
            
            stoppedServiceServers.forEach(server => {
                const stoppedServices = Object.entries(server.services)
                    .filter(([_, status]) => status === 'stopped')
                    .map(([name, _]) => name);
                
                response += `- **${server.hostname}**: 
  - 중단된 서비스: ${stoppedServices.join(', ')}
  - 서버 상태: ${this.getStatusLabel(this.getServerStatus(server))}
`;
            });
            
            // 문제 원인 및 해결 방안 (AI 장애 보고서에서 가져옴)
            response += "\n### 원인 분석 및 서비스 재시작 방법\n\n";
            
            if (serviceRelatedProblems.length > 0) {
                serviceRelatedProblems.forEach((problem, index) => {
                    if (index < 3) { // 상위 3개만 표시
                        response += `${index+1}. **${problem.serverHostname || '전체 서버'}**: ${problem.description}\n`;
                        response += `   - 권장 조치: ${problem.solution || '서비스 재시작 필요'}\n\n`;
                    }
                });
            } else {
                response += `1. **서비스 중단 원인**: 서비스 충돌, 리소스 부족, 또는 강제 종료로 인해 서비스가 중단되었을 수 있습니다.\n`;
                response += `   - 권장 조치: 'systemctl restart SERVICE_NAME' 명령어로 해당 서비스를 재시작하세요.\n\n`;
                response += `2. **로그 확인**: 중단된 원인을 파악하기 위해 로그 확인이 필요합니다.\n`;
                response += `   - 권장 조치: 'journalctl -u SERVICE_NAME' 명령어로 서비스 로그를 확인하세요.\n\n`;
            }
            
            return response;
        }
        
        // 디스크 공간 부족 관련 쿼리
        else if (query.includes("디스크 공간이 부족한 서버")) {
            const highDiskServers = this.serverData.filter(server => 
                server.disk && 
                server.disk.length > 0 && 
                server.disk[0].disk_usage_percent >= this.thresholds.warning.disk
            );
            
            // 서버 상태에 따라 응답 형식 조정
            if (highDiskServers.length === 0) {
                return `### 디스크 공간 분석 결과
                
현재 디스크 공간이 부족한 서버가 없습니다. 모든 서버가 충분한 디스크 공간을 보유하고 있습니다.

**총 서버 수**: ${this.serverData.length}대
**평균 디스크 사용률**: ${(this.serverData.reduce((acc, server) => acc + (server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent : 0), 0) / this.serverData.length).toFixed(1)}%

모든 서버의 디스크 사용률이 정상 범위(${this.thresholds.warning.disk}% 미만) 내에 있습니다.`;
            }
            
            // 해당 문제와 관련된 AI 장애 보고서 항목 찾기
            const diskRelatedProblems = aiProblemsData.filter(problem => 
                problem.description && (
                    problem.description.toLowerCase().includes('disk') || 
                    problem.description.toLowerCase().includes('디스크') ||
                    problem.description.toLowerCase().includes('공간')
                )
            );
            
            let response = `### 디스크 공간 분석 결과

디스크 공간이 부족한 서버가 ${highDiskServers.length}대 발견되었습니다.

`;
            
            // 심각한 수준(Critical)의 서버 먼저 표시
            const criticalDiskServers = highDiskServers.filter(server => 
                server.disk[0].disk_usage_percent >= this.thresholds.critical.disk
            );
            if (criticalDiskServers.length > 0) {
                response += `#### 심각한 디스크 공간 부족 (${this.thresholds.critical.disk}% 이상)
`;
                criticalDiskServers.forEach(server => {
                    response += `- **${server.hostname}**: 디스크 ${server.disk[0].disk_usage_percent}% (심각)
  - 마운트 지점: ${server.disk[0].mount || '/'}
  - 총 용량: ${server.disk[0].disk_total || '정보 없음'}
  - 사용 용량: ${server.disk[0].disk_used || '정보 없음'}
`;
                });
                response += "\n";
            }
            
            // 경고 수준(Warning)의 서버 표시
            const warningDiskServers = highDiskServers.filter(server => 
                server.disk[0].disk_usage_percent >= this.thresholds.warning.disk && 
                server.disk[0].disk_usage_percent < this.thresholds.critical.disk
            );
            if (warningDiskServers.length > 0) {
                response += `#### 경고 수준의 디스크 사용 (${this.thresholds.warning.disk}% ~ ${this.thresholds.critical.disk-0.1}%)
`;
                warningDiskServers.forEach(server => {
                    response += `- **${server.hostname}**: 디스크 ${server.disk[0].disk_usage_percent}% (경고)
  - 마운트 지점: ${server.disk[0].mount || '/'}
  - 총 용량: ${server.disk[0].disk_total || '정보 없음'}
  - 사용 용량: ${server.disk[0].disk_used || '정보 없음'}
`;
                });
                response += "\n";
            }
            
            // 문제 원인 및 해결 방안 (AI 장애 보고서에서 가져옴)
            response += "### 원인 분석 및 조치 방안\n\n";
            
            if (diskRelatedProblems.length > 0) {
                diskRelatedProblems.forEach((problem, index) => {
                    if (index < 3) { // 상위 3개만 표시
                        response += `${index+1}. **${problem.serverHostname || '전체 서버'}**: ${problem.description}\n`;
                        response += `   - 권장 조치: ${problem.solution || '불필요한 파일 정리 필요'}\n\n`;
                    }
                });
            } else {
                response += `1. **디스크 공간 부족 원인**: 로그 파일 증가, 임시 파일 누적, 또는 데이터 증가로 인해 디스크 공간이 부족할 수 있습니다.\n`;
                response += `   - 권장 조치: 'du -h --max-depth=1 /path' 명령어로 용량이 큰 디렉토리를 찾고, 불필요한 파일을 정리하세요.\n\n`;
                response += `2. **로그 정리**: 오래된 로그 파일이 많은 공간을 차지할 수 있습니다.\n`;
                response += `   - 권장 조치: '/var/log' 디렉토리의 오래된 로그 파일을 정리하고, logrotate 설정을 확인하세요.\n\n`;
            }
            
            return response;
        }
        
        // 정상 서버 목록 표시
        else if (query.includes("정상 작동 중인 서버 목록")) {
            if (normalServers.length === 0) {
                return "### 정상 서버 목록\n\n현재 모든 서버에 문제가 있어 정상 작동 중인 서버가 없습니다.";
            }
            
            let response = `### 정상 작동 중인 서버 목록 (총 ${normalServers.length}대)\n\n`;
            
            normalServers.forEach(server => {
                response += `#### ${server.hostname}\n`;
                response += `- CPU: ${server.cpu_usage}% (정상)\n`;
                response += `- 메모리: ${server.memory_usage_percent}% (정상)\n`;
                response += `- 디스크: ${server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent : 0}% (정상)\n`;
                response += `- 업타임: ${server.uptime || '정보 없음'}\n\n`;
            });
            
            response += "모든 리소스가 정상 임계값 이내에서 작동 중이며, 특별한 조치가 필요하지 않습니다.";
            
            return response;
        }
        
        // 전체 서버 상태 요약 보고서
        else if (query.includes("전체 서버 상태 요약")) {
            let response = `### 전체 서버 상태 요약 보고서\n\n`;
            
            response += `**총 서버 수**: ${this.serverData.length}대\n`;
            response += `- 정상 서버: ${normalServers.length}대\n`;
            response += `- 경고 상태: ${warningServers.length}대\n`;
            response += `- 심각 상태: ${criticalServers.length}대\n\n`;
            
            // 임계값 초과 현황
            const highCpuCount = this.serverData.filter(s => s.cpu_usage >= this.thresholds.warning.cpu).length;
            const highMemCount = this.serverData.filter(s => s.memory_usage_percent >= this.thresholds.warning.memory).length;
            const highDiskCount = this.serverData.filter(s => 
                s.disk && s.disk.length > 0 && s.disk[0].disk_usage_percent >= this.thresholds.warning.disk
            ).length;
            const stoppedServiceCount = this.serverData.filter(s => 
                s.services && Object.values(s.services).some(status => status === 'stopped')
            ).length;
            
            response += `### 리소스 사용 현황\n\n`;
            response += `- CPU 임계치 초과: ${highCpuCount}대\n`;
            response += `- 메모리 임계치 초과: ${highMemCount}대\n`;
            response += `- 디스크 임계치 초과: ${highDiskCount}대\n`;
            response += `- 서비스 중단 서버: ${stoppedServiceCount}대\n\n`;
            
            // 심각한 문제 서버 목록 (최대 3대)
            if (criticalServers.length > 0) {
                response += `### 심각한 상태의 서버 (상위 ${Math.min(3, criticalServers.length)}대)\n\n`;
                criticalServers.slice(0, 3).forEach(server => {
                    response += `#### ${server.hostname}\n`;
                    
                    // 서버의 문제 원인 파악
                    const issues = [];
                    if (server.cpu_usage >= this.thresholds.critical.cpu) {
                        issues.push(`CPU 사용률 ${server.cpu_usage}% (임계치 ${this.thresholds.critical.cpu}%)`);
                    }
                    if (server.memory_usage_percent >= this.thresholds.critical.memory) {
                        issues.push(`메모리 사용률 ${server.memory_usage_percent}% (임계치 ${this.thresholds.critical.memory}%)`);
                    }
                    if (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= this.thresholds.critical.disk) {
                        issues.push(`디스크 사용률 ${server.disk[0].disk_usage_percent}% (임계치 ${this.thresholds.critical.disk}%)`);
                    }
                    if (server.services && Object.values(server.services).some(status => status === 'stopped')) {
                        const stoppedServices = Object.entries(server.services)
                            .filter(([_, status]) => status === 'stopped')
                            .map(([name, _]) => name);
                        issues.push(`중단된 서비스: ${stoppedServices.join(', ')}`);
                    }
                    
                    issues.forEach(issue => response += `- ${issue}\n`);
                    response += '\n';
                });
            }
            
            // 관련 AI 문제 항목 추가
            if (aiProblemsData.length > 0) {
                response += `### AI 분석 문제 항목 (상위 ${Math.min(3, aiProblemsData.length)}개)\n\n`;
                aiProblemsData.slice(0, 3).forEach((problem, index) => {
                    response += `${index+1}. **${problem.serverHostname || '전체 서버'}**: ${problem.description}\n`;
                    response += `   - 심각도: ${problem.severity}\n`;
                    response += `   - 권장 조치: ${problem.solution || '문제 원인 분석 필요'}\n\n`;
                });
            }
            
            return response;
        }
        
        // 기본 AI 프로세서 호출
        return this.aiProcessor.processQuery(query);
    }

    processAIQuery() {
        if (!this.aiProcessor) return;
        
        const queryInput = document.getElementById('queryInput');
        if (!queryInput) {
            console.error("쿼리 입력 요소(queryInput)를 찾을 수 없습니다.");
            return;
        }
        
        const query = queryInput.value.trim();
        if (!query) return;
        
        const queryLoadingElement = document.getElementById('queryLoading');
        const queryResultElement = document.getElementById('queryResult');
        const queryResultContent = document.getElementById('queryResultContent');
        
        // 응답 영역 보이기
        if (queryLoadingElement) queryLoadingElement.classList.add('active');
        if (queryResultElement) queryResultElement.style.display = 'none';
        
        // 프리셋 기반 응답 처리 (자체 처리)
        const isPresetQuery = 
            query.includes("CPU 사용률이 높은 서버") || 
            query.includes("CPU 과부하") ||
            query.includes("메모리 사용량이 많은 서버") || 
            query.includes("메모리 부족") ||
            query.includes("서비스가 중단된 서버") || 
            query.includes("디스크 공간이 부족한 서버") ||
            query.includes("정상 작동 중인 서버 목록") ||
            query.includes("전체 서버 상태 요약");
        
        if (isPresetQuery) {
            const result = this.processPresetQuery(query);
            if (result) {
                if (queryResultContent && queryResultElement) {
                    queryResultContent.innerHTML = result;
                    queryResultElement.classList.add('active');
                    queryResultElement.style.display = 'block';
                }
                if (queryLoadingElement) queryLoadingElement.classList.remove('active');
                return;
            }
        }
        
        // AI 질의 처리 (서버 상태 데이터와 AI 문제 데이터 연동)
        let enhancedQuery = query;
        
        // AI 자동 장애 보고서 데이터가 있다면 쿼리에 추가 컨텍스트 제공
        if (this.problemsData && this.problemsData.length > 0) {
            const relevantProblems = this.findRelevantProblems(query);
            if (relevantProblems.length > 0) {
                enhancedQuery += "\n\n관련 문제 데이터:\n";
                relevantProblems.forEach(problem => {
                    enhancedQuery += `- ${problem.serverHostname || '전체 서버'}: ${problem.description} (심각도: ${problem.severity})\n`;
                    if (problem.solution) {
                        enhancedQuery += `  해결책: ${problem.solution}\n`;
                    }
                });
            }
        }
        
        // 서버 상태 데이터 통계 추가
        const criticalServers = this.serverData.filter(server => this.getServerStatus(server) === 'critical').length;
        const warningServers = this.serverData.filter(server => this.getServerStatus(server) === 'warning').length;
        const normalServers = this.serverData.filter(server => this.getServerStatus(server) === 'normal').length;
        
        enhancedQuery += `\n\n서버 현황: 총 ${this.serverData.length}대 (정상: ${normalServers}, 경고: ${warningServers}, 심각: ${criticalServers})`;
        
        this.aiProcessor.processQuery(enhancedQuery)
            .then(response => {
                if (queryResultContent && queryResultElement) {
                    queryResultContent.innerHTML = response;
                    queryResultElement.classList.add('active');
                    queryResultElement.style.display = 'block';
                }
            })
            .catch(error => {
                if (queryResultContent && queryResultElement) {
                    queryResultContent.innerHTML = `오류가 발생했습니다: ${error.message}`;
                    queryResultElement.classList.add('active');
                    queryResultElement.style.display = 'block';
                }
            })
            .finally(() => {
                if (queryLoadingElement) queryLoadingElement.classList.remove('active');
            });
    }
    
    // 쿼리와 관련된 문제 찾기
    findRelevantProblems(query) {
        if (!this.problemsData || !Array.isArray(this.problemsData)) {
            return [];
        }
        
        const keywords = query.toLowerCase().split(/\s+/);
        
        return this.problemsData.filter(problem => {
            if (!problem.description) return false;
            
            const description = problem.description.toLowerCase();
            return keywords.some(keyword => 
                keyword.length > 3 && description.includes(keyword)
            );
        });
    }
    
    downloadErrorReport() {
        if (!this.aiProcessor) return;
        
        let report = '';
        
        try {
            // generateErrorReport 메소드가 존재하고 호출 가능한지 확인
            if (typeof this.aiProcessor.generateErrorReport === 'function') {
                report = this.aiProcessor.generateErrorReport();
            } else {
                console.warn("AI 프로세서에 generateErrorReport 메소드가 없습니다. 기본 보고서를 생성합니다.");
                
                // 기본 장애 보고서 생성 로직
                report = '# 서버 상태 보고서\n\n';
                report += `생성 시간: ${new Date().toLocaleString()}\n\n`;
                
                // 서버 상태에 따라 요약 정보 생성
                const criticalServers = this.serverData.filter(s => this.getServerStatus(s) === 'critical');
                const warningServers = this.serverData.filter(s => this.getServerStatus(s) === 'warning');
                const normalServers = this.serverData.filter(s => this.getServerStatus(s) === 'normal');
                
                report += `## 서버 상태 요약\n\n`;
                report += `- 총 서버 수: ${this.serverData.length}\n`;
                report += `- 정상: ${normalServers.length}\n`;
                report += `- 경고: ${warningServers.length}\n`;
                report += `- 심각: ${criticalServers.length}\n\n`;
                
                // 문제 상태의 서버에 대한 세부 정보
                if (criticalServers.length > 0) {
                    report += '## 심각한 상태의 서버\n\n';
                    criticalServers.forEach(server => {
                        report += `### ${server.hostname}\n`;
                        report += `- CPU: ${server.cpu_usage}%\n`;
                        report += `- 메모리: ${server.memory_usage_percent}%\n`;
                        report += `- 디스크: ${server.disk[0].disk_usage_percent}%\n`;
                        if (server.errors && server.errors.length > 0) {
                            report += `- 오류: ${server.errors.join(', ')}\n`;
                        }
                        report += `\n`;
                    });
                }
                
                if (warningServers.length > 0) {
                    report += '## 경고 상태의 서버\n\n';
                    warningServers.forEach(server => {
                        report += `### ${server.hostname}\n`;
                        report += `- CPU: ${server.cpu_usage}%\n`;
                        report += `- 메모리: ${server.memory_usage_percent}%\n`;
                        report += `- 디스크: ${server.disk[0].disk_usage_percent}%\n`;
                        if (server.errors && server.errors.length > 0) {
                            report += `- 오류: ${server.errors.join(', ')}\n`;
                        }
                        report += `\n`;
                    });
                }
            }
        } catch (e) {
            console.error("장애 보고서 생성 중 오류 발생:", e);
            report = '# 오류 발생\n\n장애 보고서를 생성하는 중 오류가 발생했습니다.\n\n' + e.message;
        }
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `server_error_report_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 유틸리티 함수
    getServerStatus(server) {
        // AI Processor의 getEffectiveServerStatus를 사용하여 상태 결정
        if (this.aiProcessor && typeof this.aiProcessor.getEffectiveServerStatus === 'function') {
            try {
                return this.aiProcessor.getEffectiveServerStatus(server);
            } catch (e) {
                // 에러 발생 시 한 번만 경고 출력 (fallback 로직 수행)
                if (!this._hasLoggedAIProcessorError) {
                    console.error("Error calling aiProcessor.getEffectiveServerStatus:", e);
                    this._hasLoggedAIProcessorError = true;
                }
            }
        } else if (!this._hasLoggedNoAIProcessor) {
            // 경고 메시지를 한 번만 출력
            console.warn("AIProcessor 또는 getEffectiveServerStatus가 없어 기본 상태 판단 로직을 사용합니다.");
            this._hasLoggedNoAIProcessor = true;
        }
        
        // 폴백 로직 (AI Processor 사용 불가 또는 에러 시)
        // 리소스 사용률 기반 명확한 기준으로 상태 판단
        
        // 1. Critical 조건 판단
        if (server.cpu_usage >= this.thresholds.critical.cpu ||
            server.memory_usage_percent >= this.thresholds.critical.memory ||
            (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= this.thresholds.critical.disk)) {
            return 'critical';
        }
        
        // 2. 오류 메시지 기반 Critical 판단
        const hasCriticalError = server.errors && server.errors.some(err => 
            typeof err === 'string' && err.toLowerCase().includes('critical'));
        if (hasCriticalError) {
            return 'critical';
        }
        
        // 3. 서비스 중단 기반 Critical 판단
        const hasStoppedService = server.services && Object.values(server.services).includes('stopped');
        if (hasStoppedService) {
            return 'critical';
        }
        
        // 4. Warning 조건 판단
        if (server.cpu_usage >= this.thresholds.warning.cpu ||
            server.memory_usage_percent >= this.thresholds.warning.memory ||
            (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= this.thresholds.warning.disk)) {
            return 'warning';
        }
        
        // 5. 오류 메시지 기반 Warning 판단
        const hasWarningError = server.errors && server.errors.some(err => 
            typeof err === 'string' && (err.toLowerCase().includes('warning') || err.toLowerCase().includes('error')));
        if (hasWarningError) {
            return 'warning';
        }
        
        // 6. 위 조건에 해당하지 않으면 normal 상태
        return 'normal';
    }
    
    getResourceStatus(value, type = 'generic') {
        // 리소스 유형에 따른 임계값 적용
        const criticalThreshold = type in this.thresholds.critical 
            ? this.thresholds.critical[type] 
            : this.thresholds.critical.cpu;
        
        const warningThreshold = type in this.thresholds.warning 
            ? this.thresholds.warning[type] 
            : this.thresholds.warning.cpu;
        
        if (value >= criticalThreshold) return 'critical';
        if (value >= warningThreshold) return 'warning';
        return 'normal';
    }
    
    getStatusLabel(status) {
        switch(status) {
            case 'normal': return '정상';
            case 'warning': return '경고';
            case 'critical': return '심각';
            default: return '알 수 없음';
        }
    }
    
    // 서버 상태에 따른 부트스트랩 색상 클래스 반환
    getStatusColorClass(status) {
        switch(status) {
            case 'normal': return 'success';
            case 'warning': return 'warning';
            case 'critical': return 'danger';
            default: return 'secondary';
        }
    }
    
    getChartColor(value, type = 'generic') {
        const status = this.getResourceStatus(value, type);
        switch(status) {
            case 'critical': return 'rgba(220, 53, 69, 0.7)'; // 심각
            case 'warning': return 'rgba(253, 154, 20, 0.7)'; // 경고
            default: return 'rgba(40, 167, 69, 0.7)'; // 정상
        }
    }
    
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // 모든 문제를 보여주는 모달 표시
    showAllProblems() {
        if (!this.aiProcessor) {
            alert('AI 프로세서가 초기화되지 않아 문제 목록을 가져올 수 없습니다.');
            return;
        }
        
        // 문제 데이터 가져오기
        let problems = [];
        try {
            if (typeof this.aiProcessor.detectProblems === 'function') {
                problems = this.aiProcessor.detectProblems();
            } else {
                console.warn("AI 프로세서에 detectProblems 메소드가 없습니다.");
                alert('문제 목록을 불러올 수 없습니다.');
                return;
            }
            
            // 결과가 배열이 아니거나 undefined인 경우 빈 배열로 처리
            if (!Array.isArray(problems)) {
                console.warn("detectProblems() 함수가 배열을 반환하지 않았습니다.");
                problems = [];
            }
            
            // Normal 상태는 제외
            problems = problems.filter(p => p && (p.severity === 'Critical' || p.severity === 'Warning' || p.severity === 'Error'));
            
            // 정렬: Critical 우선, 그 다음 Warning/Error
            problems.sort((a, b) => {
                const severityScore = (severity) => {
                    if (severity === 'Critical') return 2;
                    if (severity === 'Warning' || severity === 'Error') return 1;
                    return 0;
                };
                return severityScore(b.severity) - severityScore(a.severity);
            });
        } catch (error) {
            console.error("문제 목록 가져오기 오류:", error);
            alert('문제 목록을 불러오는 중 오류가 발생했습니다.');
            return;
        }
        
        // 문제가 없는 경우
        if (problems.length === 0) {
            alert('현재 감지된 문제가 없습니다.');
            return;
        }
        
        try {
            // 기존 모달이 있으면 제거
            const existingModal = document.getElementById('allProblemsModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // 모든 문제를 표시하는 모달 생성
            const modalHTML = `
                <div class="modal fade" id="allProblemsModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg modal-dialog-scrollable">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-exclamation-triangle me-2 text-danger"></i> 전체 서버 문제 목록
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="problems-count mb-3">
                                    총 <span class="fw-bold">${problems.length}</span>개의 문제가 감지되었습니다.
                                </div>
                                <div class="alert alert-info mb-3">
                                    <i class="fas fa-info-circle me-2"></i>
                                    각 문제를 클릭하면 해당 서버의 상세 정보를 확인할 수 있습니다.
                                </div>
                                <ul class="list-group all-problems-list">
                                    ${problems.map((problem, idx) => `
                                        <li class="list-group-item list-group-item-action problem-item severity-${problem.severity.toLowerCase()}" data-index="${idx}">
                                            <div class="d-flex w-100 justify-content-between">
                                                <h6 class="mb-1 problem-description">${problem.description}</h6>
                                                <small class="text-muted">${problem.serverHostname || '알 수 없는 서버'}</small>
                                            </div>
                                            <p class="mb-1 problem-solution">${problem.solution || '제안된 해결책 없음'}</p>
                                            <small class="text-muted">심각도: <span class="fw-bold problem-severity-text">${problem.severity}</span></small>
                                            <div class="problem-hint-icon">
                                                <i class="fas fa-search-plus"></i>
                                            </div>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" id="downloadModalReport">
                                    <i class="bi bi-download"></i> 보고서 다운로드
                                </button>
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 모달을 페이지에 추가
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // 모달 요소 가져오기
            const modalElement = document.getElementById('allProblemsModal');
            if (!modalElement) {
                console.error("모달 요소 생성 실패");
                return;
            }
            
            // jQuery로 모달 표시 시도 (부트스트랩 의존성 줄이기)
            if (window.jQuery && window.jQuery.fn.modal) {
                const $modal = window.jQuery(modalElement);
                $modal.modal('show');
                
                // 문제 항목에 클릭 이벤트 추가
                window.jQuery('.problem-item').on('click', function() {
                    const index = parseInt(window.jQuery(this).data('index'));
                    const serverHostname = problems[index].serverHostname;
                    if (!serverHostname) return;
                    
                    const server = this.serverData.find(s => s.hostname === serverHostname);
                    if (server) {
                        $modal.modal('hide');
                        setTimeout(() => {
                            this.showServerDetail(server);
                        }, 500);
                    }
                }.bind(this));
                
                // 보고서 다운로드 버튼 이벤트
                window.jQuery('#downloadModalReport').on('click', this.downloadErrorReport.bind(this));
                
                return; // jQuery로 성공적으로 표시했으면 여기서 종료
            }
            
            // 부트스트랩 모달 인스턴스 생성 및 표시
            if (typeof bootstrap !== 'undefined' && typeof bootstrap.Modal === 'function') {
                // 부트스트랩 5+
                const bsModal = new bootstrap.Modal(modalElement);
                bsModal.show();
                
                // 문제 항목 클릭 이벤트 추가
                const problemItems = modalElement.querySelectorAll('.problem-item');
                problemItems.forEach(item => {
                    // 애니메이션 딜레이 설정
                    const index = parseInt(item.dataset.index);
                    item.style.setProperty('--item-index', index);
                    
                    item.addEventListener('click', () => {
                        // 해당 서버 모달 표시
                        const serverHostname = problems[index].serverHostname;
                        if (!serverHostname) return;
                        
                        const server = this.serverData.find(s => s.hostname === serverHostname);
                        if (server) {
                            bsModal.hide(); // 현재 모달 닫기
                            setTimeout(() => {
                                this.showServerDetail(server); // 서버 상세 모달 표시
                            }, 500);
                        }
                    });
                });
            } else {
                // 순수 JavaScript로 모달 표시 (fallback)
                modalElement.style.display = 'block';
                modalElement.classList.add('show');
                document.body.classList.add('modal-open');
                
                // 배경 요소 추가
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
                
                // 닫기 버튼에 이벤트 리스너 추가
                const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"]');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        modalElement.style.display = 'none';
                        modalElement.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        document.querySelector('.modal-backdrop')?.remove();
                    });
                });
                
                // 문제 항목 클릭 이벤트 추가
                const problemItems = modalElement.querySelectorAll('.problem-item');
                problemItems.forEach(item => {
                    const index = parseInt(item.dataset.index);
                    item.style.setProperty('--item-index', index);
                    
                    item.addEventListener('click', () => {
                        const serverHostname = problems[index].serverHostname;
                        if (!serverHostname) return;
                        
                        const server = this.serverData.find(s => s.hostname === serverHostname);
                        if (server) {
                            // 모달 수동 닫기
                            modalElement.style.display = 'none';
                            modalElement.classList.remove('show');
                            document.body.classList.remove('modal-open');
                            document.querySelector('.modal-backdrop')?.remove();
                            
                            setTimeout(() => {
                                this.showServerDetail(server);
                            }, 500);
                        }
                    });
                });
            }
            
            // 보고서 다운로드 버튼 이벤트
            const downloadBtn = document.getElementById('downloadModalReport');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    this.downloadErrorReport();
                });
            }
        } catch (error) {
            console.error('모달 표시 중 오류 발생:', error);
            alert('문제 목록을 표시할 수 없습니다.');
        }
    }
    
    // 문제 상세 보고서 모달 표시 (새로 추가)
    showProblemDetailModal(problem) {
        if (!problem) {
            console.error("문제 데이터가 없습니다.");
            return;
        }
        
        // 서버 정보 가져오기
        const server = this.serverData.find(s => s.hostname === problem.serverHostname);
        
        try {
            // 기존 모달 제거 (중복 생성 방지)
            const existingModal = document.getElementById('problemDetailModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // 모달 HTML 생성 및 추가
            const modalHTML = `
            <div class="modal fade" id="problemDetailModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-exclamation-triangle me-2 text-danger"></i> <span id="problemTitle">문제 상세 보고서</span></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-12">
                                    <div class="alert alert-danger">
                                        <h6 class="alert-heading">문제 설명</h6>
                                        <p id="problemDescription" class="mb-0"></p>
                                    </div>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">서버 정보</h6>
                                        </div>
                                        <div class="card-body">
                                            <table class="table table-sm">
                                                <tbody id="problemServerInfoTable">
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">문제 원인</h6>
                                        </div>
                                        <div class="card-body">
                                            <ul id="problemCausesList" class="mb-0"></ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-12">
                                    <div class="card">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">해결 방법</h6>
                                        </div>
                                        <div class="card-body">
                                            <ul id="problemSolutionsList" class="mb-0"></ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-12">
                                    <div class="card">
                                        <div class="card-header bg-light">
                                            <h6 class="mb-0">상세 메트릭 정보</h6>
                                        </div>
                                        <div class="card-body">
                                            <div id="problemMetricsInfo"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" id="downloadReportBtn">
                                <i class="bi bi-download me-1"></i> 보고서 다운로드 (.txt)
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                        </div>
                    </div>
                </div>
            </div>`;
            
            // 모달을 페이지에 추가
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // 모달 요소를 다시 가져옴
            const problemModal = document.getElementById('problemDetailModal');
            if (!problemModal) {
                console.error("모달 요소 생성 실패");
                return;
            }
            
            // 문제 상세 정보 표시
            const problemTitle = document.getElementById('problemTitle');
            const problemDescription = document.getElementById('problemDescription');
            const serverInfoTable = document.getElementById('problemServerInfoTable');
            const causesList = document.getElementById('problemCausesList');
            const solutionsList = document.getElementById('problemSolutionsList');
            const metricsInfo = document.getElementById('problemMetricsInfo');
            
            // 안전하게 내용 업데이트
            if (problemTitle) problemTitle.textContent = `${problem.severity} 문제 보고서: ${server ? server.hostname : '알 수 없는 서버'}`;
            if (problemDescription) problemDescription.textContent = problem.description;
            
            // 서버 정보 테이블 업데이트
            if (serverInfoTable && server) {
                serverInfoTable.innerHTML = `
                    <tr>
                        <th>호스트명</th>
                        <td>${server.hostname}</td>
                    </tr>
                    <tr>
                        <th>IP 주소</th>
                        <td>${server.ip}</td>
                    </tr>
                    <tr>
                        <th>OS</th>
                        <td>${server.os}</td>
                    </tr>
                    <tr>
                        <th>상태</th>
                        <td><span class="badge bg-${this.getStatusColorClass(this.getServerStatus(server))}">${this.getStatusLabel(this.getServerStatus(server))}</span></td>
                    </tr>
                    <tr>
                        <th>CPU 사용률</th>
                        <td>${server.cpu_usage}%</td>
                    </tr>
                    <tr>
                        <th>메모리 사용률</th>
                        <td>${server.memory_usage_percent}%</td>
                    </tr>
                    <tr>
                        <th>디스크 사용률</th>
                        <td>${server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent + '%' : 'N/A'}</td>
                    </tr>
                `;
            }
            
            // 원인 및 해결 방법 목록 채우기
            if (causesList) {
                causesList.innerHTML = '';
                const causes = problem.causes || ["원인 데이터 없음"];
                causes.forEach(cause => {
                    const li = document.createElement('li');
                    li.textContent = cause;
                    causesList.appendChild(li);
                });
            }
            
            if (solutionsList) {
                solutionsList.innerHTML = '';
                const solutions = problem.solutions || [problem.solution || "해결 방법 데이터 없음"];
                solutions.forEach(solution => {
                    const li = document.createElement('li');
                    li.textContent = solution;
                    solutionsList.appendChild(li);
                });
            }
            
            // 상세 메트릭 정보
            if (metricsInfo && server) {
                metricsInfo.innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <h6 class="mt-2 mb-3">리소스 사용량</h6>
                            <div class="progress mb-2" style="height: 25px;">
                                <div class="progress-bar ${this.getResourceStatus(server.cpu_usage, 'cpu') !== 'normal' ? 'bg-danger' : 'bg-success'}" 
                                    role="progressbar" style="width: ${server.cpu_usage}%">
                                    CPU ${server.cpu_usage}%
                                </div>
                            </div>
                            <div class="progress mb-2" style="height: 25px;">
                                <div class="progress-bar ${this.getResourceStatus(server.memory_usage_percent, 'memory') !== 'normal' ? 'bg-danger' : 'bg-success'}" 
                                    role="progressbar" style="width: ${server.memory_usage_percent}%">
                                    메모리 ${server.memory_usage_percent}%
                                </div>
                            </div>
                            <div class="progress mb-2" style="height: 25px;">
                                <div class="progress-bar ${server.disk && server.disk.length > 0 && this.getResourceStatus(server.disk[0].disk_usage_percent, 'disk') !== 'normal' ? 'bg-danger' : 'bg-success'}" 
                                    role="progressbar" style="width: ${server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent : 0}%">
                                    디스크 ${server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent : 0}%
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h6 class="mt-2 mb-3">네트워크 정보</h6>
                            <p><strong>수신:</strong> ${this.formatBytes(server.net.rx_bytes)}</p>
                            <p><strong>송신:</strong> ${this.formatBytes(server.net.tx_bytes)}</p>
                            <p><strong>오류:</strong> RX: ${server.net.rx_errors}, TX: ${server.net.tx_errors}</p>
                        </div>
                    </div>
                `;
            }
            
            // 보고서 다운로드 버튼 이벤트 리스너
            const downloadBtn = document.getElementById('downloadReportBtn');
            if (downloadBtn) {
                // 이전 이벤트 리스너 제거
                downloadBtn.replaceWith(downloadBtn.cloneNode(true));
                // 새 이벤트 리스너 추가
                document.getElementById('downloadReportBtn').addEventListener('click', () => {
                    this.downloadProblemReport(problem, server);
                });
            }
            
            // jQuery로 모달 표시 시도 (부트스트랩 의존성 줄이기)
            if (window.jQuery && window.jQuery.fn.modal) {
                window.jQuery(problemModal).modal('show');
                return; // jQuery로 성공적으로 표시했으면 여기서 종료
            }
            
            // 부트스트랩 모달 인스턴스 생성 및 표시
            if (typeof bootstrap !== 'undefined' && typeof bootstrap.Modal === 'function') {
                // 부트스트랩 5+
                const bsModal = new bootstrap.Modal(problemModal);
                bsModal.show();
            } else {
                // 순수 JavaScript로 모달 표시 (fallback)
                problemModal.style.display = 'block';
                problemModal.classList.add('show');
                document.body.classList.add('modal-open');
                
                // 배경 요소 추가
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
                
                // 닫기 버튼에 이벤트 리스너 추가
                const closeButtons = problemModal.querySelectorAll('[data-bs-dismiss="modal"]');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        problemModal.style.display = 'none';
                        problemModal.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        document.querySelector('.modal-backdrop')?.remove();
                    });
                });
            }
        } catch (error) {
            console.error('모달 표시 중 오류 발생:', error);
            alert('문제 상세 정보를 표시할 수 없습니다.');
        }
    }
    
    // 문제 보고서 다운로드 (새로 추가)
    downloadProblemReport(problem, server) {
        if (!problem || !server) return;
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `${server.hostname}_${problem.severity}_report_${timestamp}.txt`;
        
        let reportContent = `=========================================\n`;
        reportContent += `    OpenManager AI 자동 장애 보고서\n`;
        reportContent += `=========================================\n\n`;
        reportContent += `[생성 일시]: ${new Date().toLocaleString()}\n\n`;
        
        reportContent += `[문제 요약]\n`;
        reportContent += `심각도: ${problem.severity}\n`;
        reportContent += `설명: ${problem.description}\n\n`;
        
        reportContent += `[서버 정보]\n`;
        reportContent += `호스트명: ${server.hostname}\n`;
        reportContent += `IP: ${server.ip}\n`;
        reportContent += `OS: ${server.os}\n`;
        reportContent += `상태: ${this.getStatusLabel(this.getServerStatus(server))}\n\n`;
        
        reportContent += `[리소스 현황]\n`;
        reportContent += `CPU 사용률: ${server.cpu_usage}%\n`;
        reportContent += `메모리 사용률: ${server.memory_usage_percent}%\n`;
        reportContent += `디스크 사용률: ${server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent + '%' : 'N/A'}\n`;
        reportContent += `네트워크 수신: ${this.formatBytes(server.net.rx_bytes)}\n`;
        reportContent += `네트워크 송신: ${this.formatBytes(server.net.tx_bytes)}\n`;
        reportContent += `네트워크 오류 (RX/TX): ${server.net.rx_errors}/${server.net.tx_errors}\n\n`;
        
        if (problem.causes && problem.causes.length) {
            reportContent += `[추정 원인]\n`;
            problem.causes.forEach((cause, index) => {
                reportContent += `${index + 1}. ${cause}\n`;
            });
            reportContent += `\n`;
        }
        
        reportContent += `[해결 방법]\n`;
        const solutions = problem.solutions || [problem.solution || "해결 방법 데이터 없음"];
        solutions.forEach((solution, index) => {
            reportContent += `${index + 1}. ${solution}\n`;
        });
        reportContent += `\n`;
        
        if (server.errors && server.errors.length) {
            reportContent += `[오류 로그]\n`;
            server.errors.forEach((error, index) => {
                reportContent += `${index + 1}. ${error}\n`;
            });
        }
        
        reportContent += `\n=========================================\n`;
        reportContent += `이 보고서는 OpenManager AI에 의해 자동 생성되었습니다.\n`;
        reportContent += `문의: support@openmanager.ai\n`;
        
        // 텍스트 파일로 다운로드
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 전체 문제 보고서 다운로드 (새로 추가)
    downloadAllProblemsReport() {
        if (!this.problemsData || this.problemsData.length === 0) {
            alert('다운로드할 문제 보고서가 없습니다.');
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const filename = `OpenManager_all_problems_report_${timestamp}.txt`;
        
        let reportContent = `=========================================\n`;
        reportContent += `    OpenManager AI 자동 장애 보고서 (전체)\n`;
        reportContent += `=========================================\n\n`;
        reportContent += `[생성 일시]: ${new Date().toLocaleString()}\n`;
        reportContent += `[총 문제 수]: ${this.problemsData.length}개\n\n`;
        
        this.problemsData.forEach((problem, index) => {
            const server = this.serverData.find(s => s.hostname === problem.serverHostname);
            if (!server) return;
            
            reportContent += `\n=========================================\n`;
            reportContent += `문제 #${index + 1}: ${problem.severity} - ${server.hostname}\n`;
            reportContent += `=========================================\n\n`;
            
            reportContent += `[문제 요약]\n`;
            reportContent += `심각도: ${problem.severity}\n`;
            reportContent += `설명: ${problem.description}\n\n`;
            
            reportContent += `[서버 정보]\n`;
            reportContent += `호스트명: ${server.hostname}\n`;
            reportContent += `IP: ${server.ip}\n`;
            reportContent += `OS: ${server.os}\n`;
            reportContent += `상태: ${this.getStatusLabel(this.getServerStatus(server))}\n\n`;
            
            reportContent += `[리소스 현황]\n`;
            reportContent += `CPU 사용률: ${server.cpu_usage}%\n`;
            reportContent += `메모리 사용률: ${server.memory_usage_percent}%\n`;
            reportContent += `디스크 사용률: ${server.disk && server.disk.length > 0 ? server.disk[0].disk_usage_percent + '%' : 'N/A'}\n`;
            reportContent += `네트워크 수신: ${this.formatBytes(server.net.rx_bytes)}\n`;
            reportContent += `네트워크 송신: ${this.formatBytes(server.net.tx_bytes)}\n`;
            reportContent += `네트워크 오류 (RX/TX): ${server.net.rx_errors}/${server.net.tx_errors}\n\n`;
            
            if (problem.causes && problem.causes.length) {
                reportContent += `[추정 원인]\n`;
                problem.causes.forEach((cause, causeIndex) => {
                    reportContent += `${causeIndex + 1}. ${cause}\n`;
                });
                reportContent += `\n`;
            }
            
            reportContent += `[해결 방법]\n`;
            const solutions = problem.solutions || [problem.solution || "해결 방법 데이터 없음"];
            solutions.forEach((solution, solutionIndex) => {
                reportContent += `${solutionIndex + 1}. ${solution}\n`;
            });
            reportContent += `\n`;
            
            if (server.errors && server.errors.length) {
                reportContent += `[오류 로그]\n`;
                server.errors.forEach((error, errorIndex) => {
                    reportContent += `${errorIndex + 1}. ${error}\n`;
                });
                reportContent += `\n`;
            }
        });
        
        reportContent += `\n=========================================\n`;
        reportContent += `이 보고서는 OpenManager AI에 의해 자동 생성되었습니다.\n`;
        reportContent += `생성 일시: ${new Date().toLocaleString()}\n`;
        reportContent += `문의: support@openmanager.ai\n`;
        
        // 텍스트 파일로 다운로드
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// 데이터 프로세서 인스턴스 생성
window.addEventListener('DOMContentLoaded', () => {
    window.dataProcessor = new DataProcessor();
});
