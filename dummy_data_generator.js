/**
 * OpenManager AI - 더미 데이터 생성기
 * 실시간 서버 모니터링을 위한 현실적인 더미 데이터를 생성합니다.
 * 
 * 주요 기능:
 * - 50대 서버에 대한 현실적인 모니터링 데이터 생성
 * - 10분마다 데이터 갱신 및 누적 저장 (24시간 이력 보관)
 * - 서버 유형별 특성에 따른 데이터 생성 (웹서버, DB서버, API서버 등)
 * - 약 14%의 서버가 경고 또는 심각 상태로 생성 (심각: 4%, 경고: 10%)
 */

class DummyDataGenerator {
    constructor() {
        // settings.local.js에서 설정 로드
        const config = window.AppSettings?.dataGenerator || {};
        this.serverCount = config.serverCount || 50;
        this.initialBatchSize = config.initialBatchSize || 10;
        this.updateInterval = config.updateInterval || 10 * 60 * 1000;
        
        // 최종 상태 목표치 (ai_processor.js가 판단)
        this.targetCriticalRatio = 0.03; // 심각 상태 서버 비율 목표 (50대 중 1-2대로 줄임)
        this.targetWarningRatio = 0.06;  // 경고 상태 서버 비율 목표 (50대 중 3대로 줄임)

        // "재료" 발생 확률 (이 값들을 조정하여 위 목표치에 근접하도록 함)
        // 이 확률들은 독립적으로 작용하거나 여러개가 동시에 발생할 수 있음
        this.highResourceUsageCriticalProb = 0.02; // 리소스 하나가 90% 넘을 확률 (줄임)
        this.highResourceUsageWarningProb = 0.04; // 리소스 하나가 70-89% 될 확률 (줄임)
        this.criticalErrorProb = 0.01;    // "Critical" 오류 메시지 발생 확률 (줄임)
        this.warningErrorProb = 0.03;     // "Error" 또는 "Warning" 오류 메시지 발생 확률 (줄임)
        this.serviceStoppedProb = 0.01;   // 서비스 중단 발생 확률 (줄임)
        this.errorProbability = 0.1;     // 네트워크 오류 발생 확률
        
        // 서버 구성 정보
        this.serverConfigurations = [
            // 웹 서버 (15대)
            { 
                prefix: 'web', 
                count: 15,
                cpu: { base: 40, variation: 15 }, // 기본 CPU 사용률 40% ± 15%
                memory: { base: 50, variation: 15 }, // 기본 메모리 사용률 50% ± 15%
                disk: { base: 45, variation: 10 }, // 기본 디스크 사용률 45% ± 10%
                services: ['nginx', 'php-fpm', 'varnish', 'haproxy'],
                serviceCount: { min: 2, max: 4 }
            },
            // 애플리케이션 서버 (10대)
            {
                prefix: 'app',
                count: 10,
                cpu: { base: 55, variation: 20 },
                memory: { base: 60, variation: 15 },
                disk: { base: 40, variation: 10 },
                services: ['tomcat', 'nodejs', 'pm2', 'supervisord', 'docker'],
                serviceCount: { min: 2, max: 5 }
            },
            // 데이터베이스 서버 (8대)
            {
                prefix: 'db',
                count: 8,
                cpu: { base: 45, variation: 15 },
                memory: { base: 70, variation: 15 },
                disk: { base: 65, variation: 15 },
                services: ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch'],
                serviceCount: { min: 1, max: 3 }
            },
            // 캐시 서버 (5대)
            {
                prefix: 'cache',
                count: 5,
                cpu: { base: 30, variation: 20 },
                memory: { base: 80, variation: 15 },
                disk: { base: 25, variation: 10 },
                services: ['redis', 'memcached', 'varnish'],
                serviceCount: { min: 1, max: 2 }
            },
            // API 서버 (7대)
            {
                prefix: 'api',
                count: 7,
                cpu: { base: 50, variation: 20 },
                memory: { base: 55, variation: 15 },
                disk: { base: 35, variation: 10 },
                services: ['nginx', 'nodejs', 'python', 'gunicorn', 'uwsgi'],
                serviceCount: { min: 2, max: 4 }
            },
            // 모니터링 서버 (5대)
            {
                prefix: 'monitor',
                count: 5,
                cpu: { base: 35, variation: 10 },
                memory: { base: 50, variation: 10 },
                disk: { base: 60, variation: 15 },
                services: ['prometheus', 'grafana', 'influxdb', 'telegraf', 'alertmanager'],
                serviceCount: { min: 2, max: 5 }
            }
        ];
        
        this.regions = ['kr', 'us', 'eu', 'jp', 'sg'];
        this.osTypes = [
            'Ubuntu 20.04 LTS', 
            'Ubuntu 22.04 LTS', 
            'CentOS 7', 
            'Rocky Linux 8', 
            'Amazon Linux 2', 
            'Debian 11',
            'RHEL 8'
        ];
        
        // 서버 시간 패턴 (일과 시간에 부하 증가)
        this.timePatterns = {
            dailyPattern: [
                // 0-23시간, 가중치(0-100)
                30, 20, 15, 10, 10, 15, // 0-5시 (새벽): 낮은 부하
                25, 40, 60, 70, 75, 80, // 6-11시 (오전): 점차 증가
                85, 90, 85, 80, 75, 70, // 12-17시 (오후): 피크 후 감소
                65, 60, 55, 50, 40, 35  // 18-23시 (저녁): 점차 감소
            ]
        };
        
        // 생성 상태
        this.isGenerating = false;
        this.generatedCount = 0;
        
        // 이력 데이터 저장 (서버별로 보관)
        this.historicalData = {}; // 서버명: [데이터 포인트들]
        this.maxHistoricalPoints = 144; // 24시간(10분 간격 = 6개/시간 * 24시간)
        
        // 하루치 데이터 생성 시간 단위
        this.dayHours = 24;
        this.currentHour = new Date().getHours(); // 현재 시간으로 초기화
        
        // 서버 데이터 초기화 - 첫 배치만 즉시 생성
        this.serverData = [];
        this.generateInitialBatch();
        
        // 데이터 자동 업데이트 시작
        this.startDataUpdates();
    }
    
    // 초기 서버 배치 데이터 생성 (빠른 로딩을 위해 일부만 생성)
    generateInitialBatch() {
                
        // 서버 구성에 맞게 배포
        this.serverData = [];
        let serverIndex = 0;
        
        // 먼저 초기 배치 크기만큼만 생성
        for (let i = 0; i < this.initialBatchSize && serverIndex < this.serverCount; i++) {
            const server = this.createServerByConfiguration(serverIndex);
            this.serverData.push(server);
            
            // 이력 데이터 초기화 (메모리 누수 방지)
            if (!this.historicalData[server.hostname]) {
                this.historicalData[server.hostname] = [];
            }
            this.historicalData[server.hostname].push({...server, timestamp: new Date().toISOString()});
            if (this.historicalData[server.hostname].length > this.maxHistoricalPoints) {
                this.historicalData[server.hostname].shift();
            }
            
            serverIndex++;
        }
        
        // 전역 객체에 데이터 할당
        window.serverData = this.serverData;
        
        // 이벤트 발생
        this.dispatchUpdateEvent();
        
        // 나머지 데이터 비동기적으로 생성
        this.generateRemainingServersAsync();
    }
    
    // 서버 구성에 맞게 서버 생성
    createServerByConfiguration(index) {
        // 총 개수를 확인해서 어떤 유형의 서버를 생성할지 결정
        let currentCount = 0;
        let selectedConfig = null;
        
        for (const config of this.serverConfigurations) {
            if (index < currentCount + config.count) {
                selectedConfig = config;
                break;
            }
            currentCount += config.count;
        }
        
        // 기본값 사용 (만약 모든 설정에 맞지 않을 경우)
        if (!selectedConfig) {
            selectedConfig = this.serverConfigurations[0];
        }
        
        // 선택된 구성으로 서버 생성
        const serverNumber = (index + 1).toString().padStart(3, '0');
        const region = this.getRandomItem(this.regions);
        const hostname = `${selectedConfig.prefix}-${region}-${serverNumber}`;
        
        // 시간대별 부하 가중치 적용 (현재 시간 기준)
        const timeWeightMultiplier = this.timePatterns.dailyPattern[this.currentHour] / 100;
        
        // 1. 리소스 사용량 생성
        let cpuBase = selectedConfig.cpu.base + this.getRandomInt(-selectedConfig.cpu.variation, selectedConfig.cpu.variation);
        let memoryBase = selectedConfig.memory.base + this.getRandomInt(-selectedConfig.memory.variation, selectedConfig.memory.variation);
        let diskBase = selectedConfig.disk.base + this.getRandomInt(-selectedConfig.disk.variation, selectedConfig.disk.variation);

        // 확률에 따라 리소스 사용량 급증 시뮬레이션
        if (Math.random() < this.highResourceUsageCriticalProb) {
            const resourceType = this.getRandomInt(1, 3); // 1:CPU, 2:Mem, 3:Disk
            if (resourceType === 1) cpuBase = 90 + this.getRandomInt(0, 8);
            else if (resourceType === 2) memoryBase = 90 + this.getRandomInt(0, 8);
            else diskBase = 90 + this.getRandomInt(0, 8);
        } else if (Math.random() < this.highResourceUsageWarningProb) {
            const resourceType = this.getRandomInt(1, 3);
            if (resourceType === 1) cpuBase = 70 + this.getRandomInt(0, 19);
            else if (resourceType === 2) memoryBase = 70 + this.getRandomInt(0, 19);
            else diskBase = 70 + this.getRandomInt(0, 19);
        }
        
        const cpu_usage = parseFloat(Math.min(Math.max(Math.floor(cpuBase * timeWeightMultiplier) + this.getRandomInt(-10, 10), 5), 98).toFixed(2));
        const memory_usage_percent = parseFloat(Math.min(Math.max(Math.floor(memoryBase * timeWeightMultiplier) + this.getRandomInt(-10, 10), 5), 98).toFixed(2));
        const disk_info = [{
            mount: '/data',
            total: '100GB', // 예시 값 (표시용)
            disk_total: 100 * 1024 * 1024 * 1024, // 계산용 (바이트)
            used: '0GB',    // 아래에서 계산
            available: '0GB', // 아래에서 계산
            disk_usage_percent: parseFloat(Math.min(Math.max(Math.floor(diskBase * timeWeightMultiplier) + this.getRandomInt(-5, 5), 5), 98).toFixed(2))
        }];
        disk_info[0].used = (disk_info[0].disk_usage_percent / 100 * 100).toFixed(1) + 'GB';
        disk_info[0].available = (100 - (disk_info[0].disk_usage_percent / 100 * 100)).toFixed(1) + 'GB';
        
        // 2. 오류 메시지 생성
        const errors = [];
        if (Math.random() < this.criticalErrorProb) {
            errors.push(this.generateErrorMessage(selectedConfig.prefix, 'Critical'));
        } else if (Math.random() < this.warningErrorProb) {
            const errorType = Math.random() < 0.5 ? 'Error' : 'Warning';
            errors.push(this.generateErrorMessage(selectedConfig.prefix, errorType));
        }
        if (selectedConfig.prefix === 'db' && Math.random() < 0.1) { // DB 서버는 가끔 추가 오류
            errors.push(this.generateErrorMessage('db', 'Warning', 'Slow query detected'));
        }


        // 3. 서비스 상태 생성
        const services = {};
        const numServices = this.getRandomInt(selectedConfig.serviceCount.min, selectedConfig.serviceCount.max);
        const availableServices = [...selectedConfig.services];
        let stoppedServiceInjected = false;

        for (let i = 0; i < numServices && availableServices.length > 0; i++) {
            const serviceIndex = this.getRandomInt(0, availableServices.length - 1);
            const serviceName = availableServices.splice(serviceIndex, 1)[0];
            
            let status = 'running';
            // 첫 번째 서비스에 대해서만 낮은 확률로 stopped 상태 주입 (단, criticalError가 이미 발생하지 않았다면)
            // 여러 서비스가 동시에 중단되는 상황은 ai_processor에서 critical로 처리
            if (i === 0 && !stoppedServiceInjected && errors.every(e => !e.toLowerCase().includes('critical')) && Math.random() < this.serviceStoppedProb) {
                status = 'stopped';
                stoppedServiceInjected = true; // 중복 방지
            }
            services[serviceName] = status;
        }
        
        // 4. 네트워크 트래픽 및 기타 정보
        const net_rx_bytes = this.getRandomInt(100000, 50000000); // 예시 범위
        const net_tx_bytes = this.getRandomInt(100000, 50000000); // 예시 범위
        
        const server = {
            hostname: hostname,
            ip: `10.${index % 25}.${Math.floor(index / 25)}.${(index % 50) + 10}`,
            os: this.getRandomItem(this.osTypes),
            cpu_usage: cpu_usage,
            memory_total: '16GB', // 예시 (표시용)
            memory_total_bytes: 16 * 1024 * 1024 * 1024, // 계산용 (바이트)
            memory_usage_percent: memory_usage_percent,
            memory_free: `${(100 - memory_usage_percent) / 100 * 16}GB`, // 예시
            disk: disk_info,
            services: services,
            errors: errors,
            net: {
                rx_bytes: net_rx_bytes,
                tx_bytes: net_tx_bytes,
                rx_packets: this.getRandomInt(net_rx_bytes / 1000, net_rx_bytes / 500),
                tx_packets: this.getRandomInt(net_tx_bytes / 1000, net_tx_bytes / 500),
                rx_errors: errors.length > 0 && Math.random() < 0.2 ? this.getRandomInt(1, 50) : 0, // 오류 있을 시 네트워크 오류 확률 증가
                tx_errors: errors.length > 0 && Math.random() < 0.1 ? this.getRandomInt(1, 20) : 0
            },
            uptime: `${this.getRandomInt(1, 365)}d ${this.getRandomInt(0,23)}h ${this.getRandomInt(0,59)}m`,
            load_avg: [parseFloat(Math.random().toFixed(2)), parseFloat(Math.random().toFixed(2)), parseFloat(Math.random().toFixed(2))],
            processes: this.getRandomInt(50, 300),
            last_updated: new Date().toISOString(),
            region: region,
            server_type: selectedConfig.prefix, // server_type 추가
            // status 필드는 ai_processor에서 결정하므로 여기서는 생성하지 않음
        };
        
        return server;
    }
    
    // 나머지 서버 데이터를 비동기적으로 생성
    generateRemainingServersAsync() {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        this.generatedCount = this.initialBatchSize;
        
        const batchSize = 5; // 한 번에 5개씩 생성
        const generateBatch = () => {
            const remainingCount = this.serverCount - this.generatedCount;
            
            if (remainingCount <= 0) {
                                this.isGenerating = false;
                return;
            }
            
            const batchCount = Math.min(batchSize, remainingCount);
                        
            // 배치 생성
            const newServers = [];
            for (let i = 0; i < batchCount; i++) {
                const server = this.createServerByConfiguration(this.generatedCount + i);
                newServers.push(server);
                
                // 이력 데이터 초기화 (메모리 누수 방지)
                if (!this.historicalData[server.hostname]) {
                    this.historicalData[server.hostname] = [];
                }
                this.historicalData[server.hostname].push({...server, timestamp: new Date().toISOString()});
                if (this.historicalData[server.hostname].length > this.maxHistoricalPoints) {
                    this.historicalData[server.hostname].shift();
                }
            }

            // 기존 데이터에 추가
            this.serverData = [...this.serverData, ...newServers];
            this.generatedCount += batchCount;
            
            // 전역 객체 업데이트
            window.serverData = this.serverData;
            
            // 이벤트 발생
            this.dispatchUpdateEvent();
            
            // 다음 배치 예약 (약간의 딜레이를 두어 UI 차단 방지)
            setTimeout(generateBatch, 50);
        };
        
        // 첫 배치 생성 시작
        setTimeout(generateBatch, 200);
    }
    
    // 데이터 업데이트 함수
    updateData() {
        // 하루 주기 업데이트
        this.currentHour = (this.currentHour + 1) % this.dayHours;
        
        // 모든 데이터가 생성되지 않았으면 업데이트 스킵
        if (this.isGenerating) {
                        return;
        }
        
                
        // 현재 시간대의 가중치 계산
        const timeWeightMultiplier = this.timePatterns.dailyPattern[this.currentHour] / 100;
        
        // 새 타임스탬프 생성
        const now = new Date();
        now.setHours(this.currentHour, 0, 0, 0);
        
        // 전체 서버에서 심각 상태와 경고 상태의 개수를 추적
        let criticalCount = 0;
        let warningCount = 0;
        
        this.serverData = this.serverData.map((server, index) => {
            const serverType = server.hostname.split('-')[0];
            const config = this.serverConfigurations.find(c => c.prefix === serverType) || this.serverConfigurations[0];
            
            // 서비스와 오류는 30% 확률로 재생성
            const shouldUpdateServices = Math.random() < 0.3;
            const shouldUpdateErrors = Math.random() < 0.3;
            
            // 서버 상태 결정 (기존 상태를 고려하여 급격한 변화 방지)
            const isCritical = server.cpu_usage >= 90 || server.memory_usage_percent >= 90 || server.disk[0].disk_usage_percent >= 90;
            const isWarning = !isCritical && (server.cpu_usage >= 70 || server.memory_usage_percent >= 70 || server.disk[0].disk_usage_percent >= 70);
            
            // 심각/경고 상태 서버 수 추적
            if (isCritical) criticalCount++;
            else if (isWarning) warningCount++;
            
            // 상태 변화 확률 계산 (현재 상태에 따라 다르게 설정)
            let changeToCritical = false;
            let changeToWarning = false;
            let changeToNormal = false;
            
            // 상태 전이 확률 계산
            if (isCritical) {
                // 심각 → 정상 또는 경고 (20% 확률로 상태 변경)
                if (Math.random() < 0.2) {
                    changeToNormal = Math.random() < 0.5;
                    changeToWarning = !changeToNormal;
                }
            } 
            else if (isWarning) {
                // 경고 → 정상 또는 심각 (30% 확률로 상태 변경)
                if (Math.random() < 0.3) {
                    changeToNormal = Math.random() < 0.7; // 70% 확률로 정상으로 복구
                    changeToCritical = !changeToNormal; // 30% 확률로 심각으로 악화
                }
            }
            else {
                // 정상 → 경고 또는 심각 
                // 전체 심각/경고 상태 서버 수에 따라 확률 조정
                const targetCritical = Math.floor(this.serverData.length * this.targetCriticalRatio);
                const targetWarning = Math.floor(this.serverData.length * this.targetWarningRatio);
                
                // 심각 상태가 목표보다 적으면 심각 상태로 변경 확률 증가
                if (criticalCount < targetCritical && Math.random() < 0.05) {
                    changeToCritical = true;
                }
                // 경고 상태가 목표보다 적으면 경고 상태로 변경 확률 증가
                else if (warningCount < targetWarning && Math.random() < 0.1) {
                    changeToWarning = true;
                }
            }
            
            // 현재 상태를 가져오고 실제 업데이트 수행
            const cpu_base = config.cpu.base;
            const cpu_variation = config.cpu.variation;
            
            // 기본 변동값 계산
            let baseChange = this.getRandomInt(-15, 15);
            
            // 시간 패턴을 고려한 변동
            const timeInfluence = cpu_base * (timeWeightMultiplier - 0.5) * 0.8; // -40% ~ +40% 변동 가능
            
            // 상태 변화에 따른 리소스 사용량 조정
            if (changeToCritical) {
                // 리소스 중 랜덤하게 하나를 심각 상태로 설정
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 1) {
                    baseChange = Math.max(90 - server.cpu_usage, baseChange); // CPU를 90% 이상으로
                }
            }
            else if (changeToWarning) {
                // 리소스 중 랜덤하게 하나를 경고 상태로 설정
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 1) {
                    baseChange = Math.max(70 - server.cpu_usage, baseChange); // CPU를 70% 이상으로
                }
            }
            else if (changeToNormal) {
                // 모든 리소스를 정상 범위로 조정
                if (server.cpu_usage >= 70) {
                    baseChange = -this.getRandomInt(10, 30); // CPU 사용량 크게 감소
                }
            }
            
            // 최종 CPU 변동값 계산
            let cpu_delta = parseFloat((baseChange + timeInfluence).toFixed(2));
            cpu_delta = Math.max(Math.min(cpu_delta, 20), -20); // 변동폭 제한
            
            // 새 CPU 사용량 계산
            let cpu_usage = parseFloat((server.cpu_usage + cpu_delta).toFixed(2));
            cpu_usage = Math.max(5, Math.min(98, cpu_usage)); // 5% ~ 98% 사이로 제한
            
            // 다른 리소스도 비슷한 패턴으로 업데이트
            let memory_delta = parseFloat((this.getRandomInt(-10, 10) + timeInfluence * 0.8).toFixed(2));
            
            // 상태 변화에 따른 메모리 사용량 조정
            if (changeToCritical) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 2) {
                    memory_delta = Math.max(90 - server.memory_usage_percent, memory_delta); // 메모리를 90% 이상으로
                }
            }
            else if (changeToWarning) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 2) {
                    memory_delta = Math.max(70 - server.memory_usage_percent, memory_delta); // 메모리를 70% 이상으로
                }
            }
            else if (changeToNormal) {
                if (server.memory_usage_percent >= 70) {
                    memory_delta = -this.getRandomInt(10, 30); // 메모리 사용량 크게 감소
                }
            }
            
            let memory_usage_percent = parseFloat((server.memory_usage_percent + memory_delta).toFixed(2));
            memory_usage_percent = Math.max(5, Math.min(98, memory_usage_percent));
            const memory_usage = Math.floor(server.memory_total_bytes * (memory_usage_percent / 100));
            
            let disk_delta = parseFloat((this.getRandomInt(-5, 7) + timeInfluence * 0.4).toFixed(2)); // 디스크는 천천히 증가 경향
            
            // 상태 변화에 따른 디스크 사용량 조정
            if (changeToCritical) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 3) {
                    disk_delta = Math.max(90 - server.disk[0].disk_usage_percent, disk_delta); // 디스크를 90% 이상으로
                }
            }
            else if (changeToWarning) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 3) {
                    disk_delta = Math.max(70 - server.disk[0].disk_usage_percent, disk_delta); // 디스크를 70% 이상으로
                }
            }
            else if (changeToNormal) {
                if (server.disk[0].disk_usage_percent >= 70) {
                    disk_delta = -this.getRandomInt(5, 20); // 디스크 사용량 감소
                }
            }
            
            let disk_usage_percent = parseFloat((server.disk[0].disk_usage_percent + disk_delta).toFixed(2));
            disk_usage_percent = Math.max(5, Math.min(98, disk_usage_percent));
            const disk_used = Math.floor(server.disk[0].disk_total * (disk_usage_percent / 100));
            
            // 네트워크 트래픽 업데이트 (시간대에 크게 영향 받음)
            const trafficMultiplier = serverType === 'web' || serverType === 'api' ? 2 : 1; // 웹/API 서버는 트래픽 변동 폭이 더 큼
            const rx_delta = this.getRandomInt(-10, 20) * 1024 * 1024 * timeWeightMultiplier * trafficMultiplier;
            const tx_delta = this.getRandomInt(-10, 20) * 1024 * 1024 * timeWeightMultiplier * trafficMultiplier;
            
            const rx_bytes = Math.max(1024 * 1024, server.net.rx_bytes + rx_delta); // 최소 1MB
            const tx_bytes = Math.max(1024 * 1024, server.net.tx_bytes + tx_delta); // 최소 1MB
            
            // 네트워크 오류 업데이트
            const rx_errors = shouldUpdateErrors && Math.random() < this.errorProbability ? 
                server.net.rx_errors + this.getRandomInt(0, 10) : 
                Math.max(0, server.net.rx_errors - this.getRandomInt(0, 5));
            
            const tx_errors = shouldUpdateErrors && Math.random() < this.errorProbability ? 
                server.net.tx_errors + this.getRandomInt(0, 5) : 
                Math.max(0, server.net.tx_errors - this.getRandomInt(0, 3));
            
            // 서비스 상태 업데이트
            let services = { ...server.services };
            if (shouldUpdateServices) {
                Object.keys(services).forEach(service => {
                    if (services[service] === 'stopped') {
                        // 중단된 서비스는 70% 확률로 복구
                        services[service] = Math.random() < 0.7 ? 'running' : 'stopped';
                    } else {
                        // 실행 중인 서비스는 20% 확률로 중단
                        services[service] = Math.random() < 0.2 ? 'stopped' : 'running';
                    }
                });
            }
            
            // 오류 메시지 업데이트
            let errors = [...server.errors];
            if (shouldUpdateErrors) {
                // 기존 오류 중 70%는 제거(해결됨)
                errors = errors.filter(() => Math.random() > 0.7);
                
                // 새 오류 추가
                if (Math.random() < this.errorProbability) {
                    const errorCount = this.getRandomInt(1, 2);
                    for (let i = 0; i < errorCount; i++) {
                        errors.push(this.generateErrorMessage(serverType));
                    }
                }
            }
            
            // 좀비 프로세스 업데이트
            const zombie_count = Math.random() < 0.1 ? this.getRandomInt(1, 6) : 0;
            
            // 업데이트된 서버 객체
            const updatedServer = {
                ...server,
                cpu_usage,
                load_avg_1m: parseFloat((cpu_usage / 100 * this.getRandomInt(80, 120) / 100).toFixed(2)),
                memory_usage,
                memory_usage_percent,
                disk: [{
                    ...server.disk[0],
                    disk_used,
                    disk_usage_percent
                }],
                net: {
                    ...server.net,
                    rx_bytes,
                    tx_bytes,
                    rx_errors,
                    tx_errors
                },
                services,
                errors,
                zombie_count,
                timestamp: now.toISOString()
            };
            
            // 이력 데이터에 추가
            if (!this.historicalData[server.hostname]) {
                this.historicalData[server.hostname] = [];
            }
            
            this.historicalData[server.hostname].push(updatedServer);
            
            // 최대 데이터 포인트 수 유지 (오래된 데이터 제거)
            if (this.historicalData[server.hostname].length > this.maxHistoricalPoints) {
                this.historicalData[server.hostname].shift();
            }
            
            return updatedServer;
        });
        
        // 전역 객체에 업데이트된 데이터 할당
        window.serverData = this.serverData;
        window.serverHistoricalData = this.historicalData; // 이력 데이터도 전역으로 제공
        
        // 이벤트 발생
        this.dispatchUpdateEvent();
    }
    
    // 데이터 업데이트 이벤트 발생
    dispatchUpdateEvent() {
        const event = new CustomEvent('serverDataUpdated', { detail: this.serverData });
        window.dispatchEvent(event);
        
        // 이력 데이터 업데이트 이벤트도 발생
        const historyEvent = new CustomEvent('serverHistoricalDataUpdated', { detail: this.historicalData });
        window.dispatchEvent(historyEvent);
    }
    
    // 데이터 업데이트 시작
    startDataUpdates() {
        // 초기 데이터 업데이트
        setTimeout(() => this.updateData(), 5000); // 5초 후 첫 업데이트
        
        // 주기적 업데이트 설정
        setInterval(() => this.updateData(), this.updateInterval);
    }
    
    // 서버 유형별 맞춤형 오류 메시지 생성
    generateErrorMessage(serverType, severity = 'Warning', customMessage = null) {
        const messages = {
            Critical: [
                `CRITICAL: Core service ${serverType.toUpperCase()}_SERVICE_01 failed to start. System integrity compromised. (systemctl status ${serverType.toLowerCase()}-service01 확인 필요)`,
                `CRITICAL: Unrecoverable hardware error detected on ${serverType}. Immediate action required. (dmesg | grep -i hardware 확인 필요)`,
                `CRITICAL: Security breach attempt detected on ${serverType}! System locked down. (journalctl -p err 확인 필요)`,
                `CRITICAL: Kernel panic - not syncing: Fatal exception in interrupt on ${serverType} (dmesg | tail -50 확인 필요)`
            ],
            Error: [
                `ERROR: ${serverType.toUpperCase()}_APP_MODULE_X crashed due to an unhandled exception. (journalctl -u ${serverType.toLowerCase()}-app 확인 필요)`,
                `ERROR: Failed to connect to remote DB from ${serverType}. Timeout occurred. (ping DB_HOST 및 telnet DB_HOST DB_PORT 확인 필요)`,
                `ERROR: Configuration file for ${serverType.toUpperCase()}_SERVICE_02 is corrupted. (cat /etc/conf.d/${serverType.toLowerCase()}-service02.conf 확인 필요)`,
                `ERROR: High number of I/O errors on /dev/sdX on ${serverType}. Disk may be failing. (smartctl -a /dev/sdX 확인 필요)`
            ],
            Warning: [
                `WARNING: High CPU load average on ${serverType} for the last 15 minutes. (top -b -n 1 확인 필요)`,
                `WARNING: Memory usage on ${serverType} is approaching critical levels (85%). (free -m 확인 필요)`,
                `WARNING: Disk space on /var/log on ${serverType} is running low (currently 80% full). (df -h /var/log 확인 필요)`,
                `WARNING: Unexpected spike in network latency for ${serverType}. (ping -c 5 GATEWAY_IP 확인 필요)`
            ]
        };

        if (customMessage) {
            return `${severity.toUpperCase()}: ${customMessage} on ${serverType}. (journalctl -f 확인 필요)`;
        }

        const severityMessages = messages[severity];
        if (!severityMessages) return `${severity.toUpperCase()}: Unknown issue on ${serverType}. (journalctl -f 확인 필요)`;
        
        return this.getRandomItem(severityMessages);
    }
    
    // 유틸리티 함수
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    
    getRandomUsage(min, max) {
        return parseFloat((Math.random() * (max - min) + min).toFixed(2));
    }
    
    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    getRandomItems(array, count) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, array.length));
    }
}

// 인스턴스 생성 및 초기화
const dummyDataGenerator = new DummyDataGenerator(); 