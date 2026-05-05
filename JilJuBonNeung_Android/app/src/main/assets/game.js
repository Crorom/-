/* =====================================================
   질주 본능 — 게임 로직 (Canvas)
   기획서 #2 (GDD_02_게임플레이.md) + #3 (GDD_03_추가기능.md) 기반
   ===================================================== */

(function () {
    'use strict';

    // ====================================================
    // 1. 설정 상수
    // ====================================================
    const LANES = 3;
    const IMG_BASE = 'car_image/car_image_fix/';
    const PLAYER_CAR_PATH = IMG_BASE + 'genesis_gv80_topview_2d_fix.png';

    // [GDD #3 §5] 모든 장애물 차량 속도 ×1.0 통일
    const OBSTACLE_DEFS = [
        { name: 'tucson', path: IMG_BASE + 'tucson_topview_2d_fix.png', speedMul: 1.0 },
        { name: 'sonata', path: IMG_BASE + 'sonata_topview_2d_fix.png', speedMul: 1.0 },
        { name: 'accent', path: IMG_BASE + 'accent_topview_2d_fix.png', speedMul: 1.0 },
    ];

    const SPEED_BASE = 1.0;
    const SPEED_MAX = 2.0;
    const SPEED_BOOST = 1.2; // Near-Miss 시 ×1.2 누적

    // [GDD #4] BGM
    const BGM_PATH = 'music/BGM_1.mp3';

    // [GDD #4] SFX
    const SFX_NEAR_FAST_PATH = 'music/SFX_1.mp3'; // 속도 > 1.5x
    const SFX_NEAR_SLOW_PATH = 'music/SFX_2.mp3'; // 속도 ≤ 1.5x
    const SFX_GAMEOVER_PATH  = 'music/SFX_3.mp3'; // 게임 오버
    const SFX_THRESHOLD = 1.5;

    // [GDD #3 §1] Speed Burst
    const BURST_DURATION = 3.0;          // 초
    const BURST_SPEED_MULTIPLIER = 2.0;  // 현재 MAX의 2배 → 4.0배

    const SPAWN_PATTERNS = [
        [true,  false, false],
        [false, true,  false],
        [false, false, true ],
        [true,  false, true ],
        [true,  true,  false],
        [false, true,  true ],
    ];

    // ====================================================
    // 2. Canvas 초기화
    // ====================================================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0;
    let laneWidth = 0;
    let laneCenters = [];
    let dpr = 1;

    function resize() {
        const wrap = canvas.parentElement;
        const r = wrap.getBoundingClientRect();
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
        canvas.style.width = r.width + 'px';
        canvas.style.height = r.height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // 이미지 다운스케일 시 뭉개짐 최소화 (고품질 보간)
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
            ctx.imageSmoothingQuality = 'high';
        }

        W = r.width;
        H = r.height;
        laneWidth = W / LANES;
        laneCenters = [
            laneWidth * 0.5,
            laneWidth * 1.5,
            laneWidth * 2.5,
        ];

        if (player) {
            player.w = laneWidth * 0.65;
            player.h = laneWidth * 1.6;
            player.x = laneCenters[player.lane] - player.w / 2;
            player.y = H - player.h - H * 0.05;
            player.targetX = player.x;
        }
    }

    // ====================================================
    // 3. 이미지 로딩
    // ====================================================
    const images = {};

    // ====================================================
    // 3-1. BGM 오디오 [GDD #4]
    // ====================================================
    const bgm = new Audio(BGM_PATH);
    bgm.loop   = true;
    bgm.volume = (parseInt(localStorage.getItem('jiljuBgm') || '60', 10)) / 100;

    let bgmMuted = localStorage.getItem('jiljuMute') === '1';

    function bgmPlay() {
        if (bgmMuted) return;
        bgm.play().catch(() => {});
    }

    function bgmStop() {
        bgm.pause();
        bgm.currentTime = 0;
    }

    function updateBgmRate() {
        const eff = effectiveSpeedMul();
        // 기본속도(1.0)→rate 1.0, 최고속도(2.0)→rate 1.17, Burst(4.0)→rate 1.5 상한
        const rate = 1.0 + (eff - 1.0) / (4.0 - 1.0) * 0.5;
        bgm.playbackRate = Math.min(2.0, Math.max(0.5, rate));
    }

    // [GDD #4] SFX 프리로드 (원본은 재생하지 않고 cloneNode로 중첩 재생)
    const sfxNearFast = new Audio(SFX_NEAR_FAST_PATH);
    const sfxNearSlow = new Audio(SFX_NEAR_SLOW_PATH);
    const sfxGameOver = new Audio(SFX_GAMEOVER_PATH);
    sfxNearFast.preload = 'auto';
    sfxNearSlow.preload = 'auto';
    sfxGameOver.preload = 'auto';

    let sfxVolume = (parseInt(localStorage.getItem('jiljuSfx') || '80', 10)) / 100;

    function playSfx(audio) {
        if (sfxVolume <= 0) return;
        // cloneNode → 동일 효과음의 빠른 연속 재생 허용
        const clone = audio.cloneNode();
        clone.volume = sfxVolume;
        clone.play().catch(() => {});
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed: ' + src));
            img.src = src;
        });
    }

    async function loadAssets() {
        images.player = await loadImage(PLAYER_CAR_PATH);
        for (const def of OBSTACLE_DEFS) {
            images[def.name] = await loadImage(def.path);
        }
    }

    // ====================================================
    // 4. 게임 상태
    // ====================================================
    let player = null;
    let obstacles = [];
    let speedMul = SPEED_BASE;
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('jiljuBest') || '0', 10);

    let isPlaying = false;
    let isPaused = false;
    let isGameOver = false;

    // [GDD #3 §1] Burst 상태
    let isBurst = false;
    let burstRemaining = 0;       // 초

    let lastTime = 0;
    let spawnTimer = 0;
    let lastPattern = null; // 직전 row의 패턴 (호환성 체크용)

    let roadOffset = 0;
    let shakeAmount = 0;

    // ====================================================
    // 5. 플레이어 / 충돌 영역
    // ====================================================
    function createPlayer() {
        return {
            lane: 1,
            w: laneWidth * 0.65,
            h: laneWidth * 1.6,
            x: 0,
            y: 0,
            targetX: 0,
        };
    }

    /** Crash Zone: 사각형 히트박스 (이미지 외곽 5%씩 내측 여백) */
    function getCrashRect(obj) {
        return {
            x: obj.x + obj.w * 0.05,
            y: obj.y + obj.h * 0.05,
            w: obj.w * 0.90,
            h: obj.h * 0.90,
        };
    }

    /**
     * [GDD #3 §6 + 조정] Near-Miss Zone: 장애물 앞부분(아래쪽 면)에서만 확장
     * 1.2배 → 1.5배로 확대 (Crash Zone 높이의 0.5배만큼 아래로 추가 영역)
     */
    function getNearRect(obj) {
        const c = getCrashRect(obj);
        const extension = c.h * 0.5;
        return {
            x: c.x,
            y: c.y + c.h,
            w: c.w,
            h: extension,
        };
    }

    function aabb(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // ====================================================
    // 6. 입력 처리
    // ====================================================
    function moveLane(dir) {
        if (!isPlaying || isPaused || isGameOver || !player) return;
        const newLane = player.lane + dir;
        if (newLane < 0 || newLane >= LANES) return;

        player.lane = newLane;
        player.targetX = laneCenters[newLane] - player.w / 2;

        checkNearMissOnLaneChange();
    }

    /** [GDD #3 §2-3] Speed Burst 발동 시도 */
    function tryBurst() {
        if (!isPlaying || isPaused || isGameOver) return;
        if (isBurst) return;
        if (speedMul < SPEED_MAX - 0.001) return; // 게이지 MAX 아니면 무시

        activateBurst();
    }

    function activateBurst() {
        isBurst = true;
        burstRemaining = BURST_DURATION;
        // speedMul 자체는 변경하지 않음 (해제 후 1.0 복귀를 위해 단순화).
        // 실제 화면 스크롤 속도는 effectiveSpeedMul()로 계산.
        document.getElementById('burstOverlay').classList.remove('hidden');
        document.getElementById('speedGauge').classList.add('bursting');
        document.getElementById('speedGauge').classList.remove('max-ready');
        updateBurstCountdownText();
    }

    function endBurst() {
        isBurst = false;
        burstRemaining = 0;
        speedMul = SPEED_BASE; // [GDD #3 §4-3] 해제 후 ×1.0 복귀
        document.getElementById('burstOverlay').classList.add('hidden');
        document.getElementById('speedGauge').classList.remove('bursting');
        updateSpeedGauge();
    }

    function effectiveSpeedMul() {
        return isBurst ? SPEED_MAX * BURST_SPEED_MULTIPLIER : speedMul;
    }

    function updateBurstCountdownText() {
        const txt = Math.max(1, Math.ceil(burstRemaining));
        document.getElementById('burstCountdown').textContent = txt;
    }

    // 키보드
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
            moveLane(-1);
            e.preventDefault();
        } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
            moveLane(1);
            e.preventDefault();
        } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
            tryBurst();
            e.preventDefault();
        }
    });

    // 터치 스와이프 (좌/우/위)
    let touchStartX = null, touchStartY = null;
    canvas.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const absX = Math.abs(dx), absY = Math.abs(dy);

        if (absY > absX && dy < -30) {
            // 위 슬라이드 → Burst
            tryBurst();
        } else if (absX > 30 && absX > absY) {
            moveLane(dx > 0 ? 1 : -1);
        }
        touchStartX = touchStartY = null;
    }, { passive: true });

    document.getElementById('btnLeft').addEventListener('click', () => moveLane(-1));
    document.getElementById('btnRight').addEventListener('click', () => moveLane(1));

    // 속도 게이지 직접 클릭/탭
    document.getElementById('speedGauge').addEventListener('click', () => tryBurst());

    // ====================================================
    // 7. 장애물 스폰
    // ====================================================
    /** 패턴의 빈 차선 인덱스 배열 반환 */
    function emptyLanesOf(pattern) {
        const arr = [];
        for (let i = 0; i < LANES; i++) if (!pattern[i]) arr.push(i);
        return arr;
    }

    /**
     * 이전 row와 호환되는 패턴 선택
     * 핵심 규칙: 이전 row의 빈 차선 중 최소 1개는 새 row에서도 비어 있어야 함
     * → 한 차선만으로 두 row를 모두 통과 가능 (4대 동시 막힘 현상 방지)
     */
    function chooseSafePattern() {
        if (!lastPattern) {
            return SPAWN_PATTERNS[Math.floor(Math.random() * SPAWN_PATTERNS.length)];
        }
        const prevEmpty = emptyLanesOf(lastPattern);
        const candidates = SPAWN_PATTERNS.filter((p) => {
            const curEmpty = emptyLanesOf(p);
            return curEmpty.some((e) => prevEmpty.includes(e));
        });
        if (candidates.length === 0) {
            return SPAWN_PATTERNS[Math.floor(Math.random() * SPAWN_PATTERNS.length)];
        }
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /**
     * 거리 기반 스폰 가능 여부
     * 가장 위에 있는 장애물(=가장 최근 스폰)이 충분히 아래로 이동했는지 확인
     * → 빠른 속도에서도 row 간 최소 거리 보장
     */
    function canSpawnNow() {
        if (obstacles.length === 0) return true;
        const h = laneWidth * 1.6;
        const startY = -h - 10;
        // 차량 높이의 1.7배 이상 거리 확보
        const minGap = h * 1.7;

        let topMostY = Infinity;
        for (const ob of obstacles) {
            if (ob.y < topMostY) topMostY = ob.y;
        }
        return topMostY >= startY + minGap;
    }

    function spawnObstacleRow() {
        const pattern = chooseSafePattern();
        lastPattern = pattern;

        const w = laneWidth * 0.65;
        const h = laneWidth * 1.6;

        for (let lane = 0; lane < LANES; lane++) {
            if (!pattern[lane]) continue;
            const def = OBSTACLE_DEFS[Math.floor(Math.random() * OBSTACLE_DEFS.length)];
            obstacles.push({
                carName: def.name,
                speedMul: def.speedMul,
                lane: lane,
                w: w,
                h: h,
                x: laneCenters[lane] - w / 2,
                y: -h - 10,
                nearMissTriggered: false,
                scored: false,
            });
        }
    }

    /** 현재 속도 단계에 따른 스폰 간격 (초) */
    function getSpawnInterval() {
        if (isBurst) return 0.7;       // Burst 중에는 더 자주
        if (speedMul >= 1.6) return 1.2;
        if (speedMul >= 1.4) return 1.6;
        if (speedMul >= 1.2) return 2.0;
        return 2.5;
    }

    // ====================================================
    // 8. 점수 시스템 (속도 단계별)
    // ====================================================
    /** [GDD #3 §8] 현재 속도 단계 (1~5) */
    function getCurrentTier() {
        if (speedMul >= 2.0)  return 5;
        if (speedMul >= 1.6)  return 4;
        if (speedMul >= 1.4)  return 3;
        if (speedMul >= 1.2)  return 2;
        return 1;
    }

    /** 일반 통과 점수: 1 / 2 / 3 / 4 / 5 */
    function getTierSafePoints() {
        return getCurrentTier();
    }

    /** Near-Miss 점수: 5 / 10 / 15 / 20 / 25 */
    function getTierNearPoints() {
        return getCurrentTier() * 5;
    }

    // ====================================================
    // 9. Near-Miss 판정 & 발동
    // ====================================================
    function checkNearMissOnLaneChange() {
        const playerCrash = getCrashRect(player);

        for (const ob of obstacles) {
            if (ob.nearMissTriggered || ob.scored) continue;
            const obCrash = getCrashRect(ob);
            const obNear  = getNearRect(ob);

            const inNear  = aabb(playerCrash, obNear);
            const inCrash = aabb(playerCrash, obCrash);

            if (inNear && !inCrash) {
                triggerNearMiss(ob);
            }
        }
    }

    /** Near-Miss 발동: 속도 부스트 + 팝업 (점수는 이후 obstacle 통과 시 정산) */
    function triggerNearMiss(ob) {
        if (ob.nearMissTriggered) return;
        ob.nearMissTriggered = true;

        // [GDD #4] 부스트 적용 전 속도로 SFX 선택
        // SFX_THRESHOLD(1.5)배 초과면 SFX_1, 이하면 SFX_2
        const speedAtMoment = effectiveSpeedMul();
        playSfx(speedAtMoment > SFX_THRESHOLD ? sfxNearFast : sfxNearSlow);

        // [GDD #3 §1-1] Burst 중에는 속도 부스트 적용 X (이미 4배)
        if (!isBurst) {
            speedMul = Math.min(SPEED_MAX, speedMul * SPEED_BOOST);
        }

        shakeAmount = 14;

        // 팝업: 곧 받을 점수 미리 안내
        const points = isBurst ? 100 : getTierNearPoints();
        showNearMissPopup(points);
    }

    function showNearMissPopup(points) {
        const popup = document.getElementById('nearMissPopup');
        popup.textContent = `NEAR MISS! +${points}`;
        popup.classList.remove('show');
        void popup.offsetWidth; // 강제 reflow
        popup.classList.add('show');
    }

    /** 점수 팝업 (+N) — 동적으로 화면에 잠깐 표시 */
    function showScoreFloat(ob, points, big) {
        const wrapper = document.getElementById('scoreFloatContainer');
        const el = document.createElement('div');
        el.className = 'score-float' + (big ? ' big' : '');
        el.textContent = '+' + points;
        // 화면 좌표로 변환 (캔버스가 화면 전체이므로 그대로 사용)
        el.style.left = (ob.x + ob.w / 2) + 'px';
        el.style.top = (ob.y + ob.h / 2) + 'px';
        wrapper.appendChild(el);
        setTimeout(() => el.remove(), 750);
    }

    // ====================================================
    // 10. 게임 업데이트
    // ====================================================
    function update(dt) {
        if (!isPlaying || isPaused || isGameOver) return;

        // Burst 타이머
        if (isBurst) {
            burstRemaining -= dt;
            updateBurstCountdownText();
            if (burstRemaining <= 0) {
                endBurst();
            }
        }

        const eff = effectiveSpeedMul();
        const scrollSpeed = (H * 0.55) * eff; // 기준: 화면 절반/초 @ 1.0배

        roadOffset = (roadOffset + scrollSpeed * dt) % 80;

        // 플레이어 차선 이동 애니메이션
        if (Math.abs(player.x - player.targetX) > 0.5) {
            const moveSpeed = laneWidth * 10;
            const dir = Math.sign(player.targetX - player.x);
            player.x += dir * moveSpeed * dt;
            if ((dir > 0 && player.x > player.targetX) ||
                (dir < 0 && player.x < player.targetX)) {
                player.x = player.targetX;
            }
        }

        // 장애물 이동
        for (const ob of obstacles) {
            ob.y += scrollSpeed * ob.speedMul * dt;
        }

        // [GDD #3 §1-1, §9] 충돌 판정 — Burst 중에는 무적
        if (!isBurst) {
            const playerCrash = getCrashRect(player);
            for (const ob of obstacles) {
                const obCrash = getCrashRect(ob);
                if (aabb(playerCrash, obCrash)) {
                    gameOver();
                    return;
                }
            }
        }

        // [GDD #3 §7] 점수 발생: 플레이어 중앙이 장애물 앞부분(아래 면)을 넘었을 때
        const playerCenterY = player.y + player.h / 2;
        for (const ob of obstacles) {
            if (ob.scored) continue;
            const obCrash = getCrashRect(ob);
            const obFrontY = obCrash.y + obCrash.h; // 진행 방향 앞부분 = Crash Zone 하단

            if (obFrontY > playerCenterY) {
                ob.scored = true;
                let points;
                let isNearMissScore = false;

                if (isBurst) {
                    points = 100;
                } else if (ob.nearMissTriggered) {
                    points = getTierNearPoints();
                    isNearMissScore = true;
                } else {
                    points = getTierSafePoints();
                }
                score += points;
                showScoreFloat(ob, points, isBurst || isNearMissScore);
            }
        }

        // 화면 밖 장애물 제거
        obstacles = obstacles.filter((ob) => ob.y <= H);

        // 스폰: 시간 + 거리 두 조건 모두 만족 시에만 스폰
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            if (canSpawnNow()) {
                spawnObstacleRow();
                spawnTimer = getSpawnInterval();
            } else {
                // 거리 부족 → 짧게 다시 시도
                spawnTimer = 0.1;
            }
        }

        // 흔들림 감쇠
        if (shakeAmount > 0) {
            shakeAmount = Math.max(0, shakeAmount - 60 * dt);
        }

        // [GDD #4] BGM 재생속도 속도 동기화
        if (!bgmMuted) updateBgmRate();

        // HUD 갱신
        document.getElementById('scoreText').textContent = score.toLocaleString();
        updateSpeedGauge();
    }

    function updateSpeedGauge() {
        const fill = document.getElementById('speedFill');
        const gauge = document.getElementById('speedGauge');
        let pct;

        if (isBurst) {
            pct = 100;
        } else {
            const ratio = (speedMul - SPEED_BASE) / (SPEED_MAX - SPEED_BASE);
            pct = Math.min(1, Math.max(0, ratio)) * 100;
        }
        fill.style.height = pct + '%';

        // MAX 도달 시 max-ready 클래스 (Burst 중이 아닐 때만)
        if (!isBurst && speedMul >= SPEED_MAX - 0.001) {
            gauge.classList.add('max-ready');
        } else {
            gauge.classList.remove('max-ready');
        }
    }

    // ====================================================
    // 11. 그리기
    // ====================================================
    function draw() {
        let sx = 0, sy = 0;
        if (shakeAmount > 0) {
            sx = (Math.random() - 0.5) * shakeAmount * 2;
            sy = (Math.random() - 0.5) * shakeAmount * 2;
        }

        ctx.save();
        ctx.translate(sx, sy);

        drawRoad();

        // 장애물
        for (const ob of obstacles) {
            const img = images[ob.carName];
            if (img) ctx.drawImage(img, ob.x, ob.y, ob.w, ob.h);
        }

        // 플레이어 — Burst 중 황금빛 글로우 효과
        if (player && images.player) {
            if (isBurst) {
                ctx.save();
                ctx.shadowColor = '#ffe600';
                ctx.shadowBlur = 30;
                ctx.drawImage(images.player, player.x, player.y, player.w, player.h);
                ctx.restore();
            } else {
                ctx.drawImage(images.player, player.x, player.y, player.w, player.h);
            }
        }

        ctx.restore();
    }

    function drawRoad() {
        ctx.fillStyle = '#1c1c2c';
        ctx.fillRect(0, 0, W, H);

        const shoulder = W * 0.04;
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, shoulder, H);
        ctx.fillRect(W - shoulder, 0, shoulder, H);

        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 4;
        ctx.setLineDash([30, 30]);
        ctx.lineDashOffset = -roadOffset;

        for (let i = 1; i < LANES; i++) {
            const x = laneWidth * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(shoulder + 1, 0);
        ctx.lineTo(shoulder + 1, H);
        ctx.moveTo(W - shoulder - 1, 0);
        ctx.lineTo(W - shoulder - 1, H);
        ctx.stroke();
    }

    // ====================================================
    // 12. 메인 루프
    // ====================================================
    function frame(now) {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    // ====================================================
    // 13. 게임 오버 / 리셋
    // ====================================================
    function gameOver() {
        if (isGameOver) return;
        isGameOver = true;
        isPlaying = false;
        shakeAmount = 18;

        // Burst 강제 해제
        if (isBurst) endBurst();

        // [GDD #4] BGM 정지 + 게임 오버 효과음
        bgmStop();
        playSfx(sfxGameOver);

        let isNew = false;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('jiljuBest', String(bestScore));
            isNew = true;
        }

        document.getElementById('finalScore').textContent = score.toLocaleString();
        document.getElementById('bestScore').textContent = bestScore.toLocaleString();
        document.getElementById('newRecord').style.display = isNew ? 'block' : 'none';

        setTimeout(() => {
            document.getElementById('gameOverScreen').classList.remove('hidden');
        }, 500);
    }

    function resetGame() {
        obstacles = [];
        speedMul = SPEED_BASE;
        score = 0;
        isGameOver = false;
        isPaused = false;
        isPlaying = true;
        spawnTimer = 0.6;
        shakeAmount = 0;
        isBurst = false;
        burstRemaining = 0;
        lastPattern = null;

        player = createPlayer();
        player.x = laneCenters[player.lane] - player.w / 2;
        player.y = H - player.h - H * 0.05;
        player.targetX = player.x;

        // 동적 score-float 잔재 제거
        document.getElementById('scoreFloatContainer').innerHTML = '';

        document.getElementById('scoreText').textContent = '0';
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('settingsPopup').classList.add('hidden');
        document.getElementById('optionsPopup').classList.add('hidden');
        document.getElementById('burstOverlay').classList.add('hidden');
        document.getElementById('speedGauge').classList.remove('max-ready', 'bursting');
        updateSpeedGauge();
    }

    // ====================================================
    // 14. UI / 팝업 이벤트
    // ====================================================
    const $ = (id) => document.getElementById(id);

    $('btnSettings').addEventListener('click', () => {
        if (!isPlaying || isGameOver) return;
        isPaused = true;
        bgm.pause(); // [GDD #4] 일시정지
        $('settingsPopup').classList.remove('hidden');
    });

    $('btnResume').addEventListener('click', () => {
        isPaused = false;
        $('settingsPopup').classList.add('hidden');
        bgmPlay(); // [GDD #4] 재개
    });

    $('btnGiveUp').addEventListener('click', () => {
        $('settingsPopup').classList.add('hidden');
        isPaused = false;
        gameOver();
    });

    $('btnOptions').addEventListener('click', () => {
        $('settingsPopup').classList.add('hidden');
        $('optionsPopup').classList.remove('hidden');
    });

    $('btnBackToSettings').addEventListener('click', () => {
        $('optionsPopup').classList.add('hidden');
        $('settingsPopup').classList.remove('hidden');
    });

    $('btnRestart').addEventListener('click', () => {
        resetGame();
        bgm.currentTime = 0; // [GDD #4] 처음부터 재생
        bgmPlay();
    });

    $('btnStart').addEventListener('click', () => {
        $('startScreen').classList.add('hidden');
        resetGame();
        bgm.currentTime = 0; // [GDD #4] 게임 시작 시 BGM 재생
        bgmPlay();
    });

    // 음량 슬라이더
    const bgmSlider = $('bgmSlider');
    const sfxSlider = $('sfxSlider');
    const bgmVal = $('bgmVal');
    const sfxVal = $('sfxVal');

    bgmSlider.value = localStorage.getItem('jiljuBgm') || '60';
    sfxSlider.value = localStorage.getItem('jiljuSfx') || '80';
    bgmVal.textContent = bgmSlider.value + '%';
    sfxVal.textContent = sfxSlider.value + '%';

    bgmSlider.addEventListener('input', () => {
        bgmVal.textContent = bgmSlider.value + '%';
        localStorage.setItem('jiljuBgm', bgmSlider.value);
        bgm.volume = parseInt(bgmSlider.value, 10) / 100; // [GDD #4] 즉시 적용
    });

    sfxSlider.addEventListener('input', () => {
        sfxVal.textContent = sfxSlider.value + '%';
        localStorage.setItem('jiljuSfx', sfxSlider.value);
        sfxVolume = parseInt(sfxSlider.value, 10) / 100; // [GDD #4] 즉시 적용
    });

    // [GDD #4] 뮤트 토글 — 옵션 팝업의 🎵 아이콘 클릭
    const btnMuteEl = $('btnMute');
    if (bgmMuted) btnMuteEl.textContent = '🔇'; // 초기 상태 반영

    btnMuteEl.addEventListener('click', () => {
        bgmMuted = !bgmMuted;
        localStorage.setItem('jiljuMute', bgmMuted ? '1' : '0');
        if (bgmMuted) {
            bgm.pause();
            btnMuteEl.textContent = '🔇';
        } else {
            if (isPlaying && !isPaused) bgm.play().catch(() => {});
            btnMuteEl.textContent = '🎵';
        }
    });

    // ====================================================
    // 15. 초기화
    // ====================================================
    window.addEventListener('resize', resize);

    loadAssets()
        .then(() => {
            resize();
            lastTime = performance.now();
            requestAnimationFrame(frame);
        })
        .catch((err) => {
            console.error(err);
            alert('이미지 로딩에 실패했습니다.\n같은 폴더에 차량 이미지 파일이 있는지 확인하세요.\n\n' + err.message);
        });

})();
