# 곡예운전 — 게임 기획서 #4
## BGM & SFX 시스템 (배경 음악 & 효과음)

> 문서 버전: v1.2  
> 작성일: 2026-05-05  
> 분류: 기획서 시리즈 04 / 사운드 시스템

---

## 목차

1. [개요](#1-개요)
2. [적용 파일 및 경로](#2-적용-파일-및-경로)
3. [재생 시점 및 반복 조건](#3-재생-시점-및-반복-조건)
4. [일시정지 및 정지 조건](#4-일시정지-및-정지-조건)
5. [볼륨 정책 및 슬라이더](#5-볼륨-정책-및-슬라이더)
6. [음소거 (뮤트) 토글](#6-음소거-뮤트-토글)
7. [속도 연동 BGM 재생속도 변화](#7-속도-연동-bgm-재생속도-변화)
8. [SFX 시스템 (효과음)](#8-sfx-시스템-효과음)
9. [구현 방법 (HTML5 Audio API)](#9-구현-방법-html5-audio-api)
10. [안드로이드 WebView 대응](#10-안드로이드-webview-대응)
11. [향후 확장](#11-향후-확장)

---

## 1. 개요

게임 진행 중 몰입감과 스피드감을 높이기 위해 **BGM_1**을 배경 음악으로 사용한다.  
게임이 시작되면 즉시 재생되며, 트랙이 끝나도 처음으로 돌아가 **무한 반복**된다.  
게임 속도가 올라갈수록 BGM 재생속도(playbackRate)도 함께 빨라져 속도감을 극대화한다.

또한 핵심 게임플레이 이벤트에 효과음(SFX)을 입혀 청각적 피드백을 강화한다.

| 이벤트 | SFX |
|--------|-----|
| Near-Miss (속도 ≤ 1.5배) | `SFX_2.mp3` |
| Near-Miss (속도 > 1.5배) | `SFX_1.mp3` |
| 게임 오버 | `SFX_3.mp3` |

---

## 2. 적용 파일 및 경로

| 항목 | 내용 |
|------|------|
| **파일명** | `BGM_1.mp3` |
| **위치 (웹)** | `music/BGM_1.mp3` |
| **위치 (안드로이드)** | `assets/music/BGM_1.mp3` |
| **형식** | MP3 (HTML5 Audio 호환) |
| **적용 페이지** | `game.html` (게임 플레이 화면) 전용 |

> ⚠️ `index.html`, `cars.html`, `world.html` 등 메뉴·서브 페이지에서는 BGM을 재생하지 않는다.

---

## 3. 재생 시점 및 반복 조건

| 상태 | BGM 동작 |
|------|----------|
| `game.html` 로드 | 재생 대기 (브라우저 자동재생 정책 대응) |
| 플레이어가 **START 버튼** 터치/클릭 | **즉시 처음부터 재생** (사용자 인터랙션 직후 → 자동재생 허용) |
| 트랙 종료 시 | **처음으로 루프** (`loop = true`) |
| Speed Burst 발동 중 | 동일 트랙 유지 + 재생속도 최대값으로 상승 |
| Near-Miss 효과음 | BGM 위에 효과음 중첩 재생 (BGM 중단 없음) |
| **다시 시작** 버튼 클릭 | BGM **처음부터 재생** (`currentTime = 0`) |

---

## 4. 일시정지 및 정지 조건

| 상태 | BGM 동작 |
|------|----------|
| ⚙ 버튼 → 설정 팝업 진입 | BGM **일시정지** (`audio.pause()`) |
| 일시정지 해제 (게임 돌아가기) | BGM **재개** (`audio.play()`) |
| **게임 포기** 클릭 | `gameOver()` 호출 → BGM **정지** + 위치 초기화 |
| 게임 오버 (충돌) | BGM **정지** + `currentTime = 0` |
| 음소거(🔇) 상태에서는 | 재개/시작 호출 시에도 재생하지 않음 |
| 페이지 이탈 | BGM **자동 정지** (Audio 객체 언로드) |

---

## 5. 볼륨 정책 및 슬라이더

### 5-1. 기본값

| 항목 | 값 | 비고 |
|------|-----|------|
| BGM 기본 볼륨 | `60%` | localStorage `jiljuBgm` 키로 저장/복원 |
| 효과음 기본 볼륨 | `80%` | localStorage `jiljuSfx` 키로 저장/복원 |
| 볼륨 범위 | 0 ~ 100% | |

### 5-2. 슬라이더 위치

- 설정 버튼(⚙) → **옵션** 화면에 슬라이더 존재
- `배경 음악` 슬라이더: 드래그 즉시 `bgm.volume`에 반영
- `효과음` 슬라이더: 효과음 Audio 객체 볼륨에 반영 (현재 효과음 미구현, 향후 연동)
- 슬라이더 값은 `localStorage`에 저장되어 재접속 시 복원

### 5-3. 구현 포인트

```js
bgmSlider.addEventListener('input', () => {
    bgm.volume = parseInt(bgmSlider.value, 10) / 100;
    localStorage.setItem('jiljuBgm', bgmSlider.value);
});
```

---

## 6. 음소거 (뮤트) 토글

### 6-1. UI 위치

- 옵션 팝업 제목의 **🎵 아이콘** 클릭 → 음소거 토글
- 음소거 상태: **🔇** 표시 (빨간 테두리 등 시각적 피드백)
- 음소거 해제: **🎵** 표시

### 6-2. 동작 규칙

| 동작 | 결과 |
|------|------|
| 🎵 클릭 | BGM 즉시 정지, 아이콘 → 🔇 |
| 🔇 클릭 | 게임 진행 중이면 BGM 재개, 아이콘 → 🎵 |
| 음소거 상태에서 게임 시작/재시작 | BGM 재생하지 않음 |
| 음소거 상태 | `localStorage` `jiljuMute` 키로 저장/복원 |

### 6-3. 구현 포인트

```js
btnMute.addEventListener('click', () => {
    bgmMuted = !bgmMuted;
    localStorage.setItem('jiljuMute', bgmMuted ? '1' : '0');
    if (bgmMuted) {
        bgm.pause();
        btnMute.textContent = '🔇';
    } else {
        if (isPlaying && !isPaused) bgm.play();
        btnMute.textContent = '🎵';
    }
});
```

---

## 7. 속도 연동 BGM 재생속도 변화

### 7-1. 개념

게임 속도(`speedMul`)가 올라갈수록 `bgm.playbackRate`도 함께 상승하여,
시각적 속도감과 청각적 속도감을 동기화한다.

### 7-2. 속도 단계별 재생속도 매핑

| 게임 상태 | `effectiveSpeedMul()` | BGM `playbackRate` |
|-----------|----------------------|---------------------|
| 기본 속도 (시작) | 1.0 | **1.00** |
| 중간 속도 | 1.5 | **1.08** |
| 최고 속도 (MAX) | 2.0 | **1.17** |
| Speed Burst 발동 | 4.0 (2배×2배) | **1.50** (상한) |

> 공식: `rate = 1.0 + (eff − 1.0) / (4.0 − 1.0) × 0.5`  
> 하한 0.5, 상한 2.0으로 클리핑

### 7-3. 적용 시점

- 매 프레임 `update()` 함수 내에서 계산
- 음소거 상태일 때는 계산·적용 생략 (불필요한 연산 방지)

### 7-4. 구현 포인트

```js
function updateBgmRate() {
    const eff = effectiveSpeedMul();
    const rate = 1.0 + (eff - 1.0) / (4.0 - 1.0) * 0.5;
    bgm.playbackRate = Math.min(2.0, Math.max(0.5, rate));
}

// update() 함수 내 HUD 갱신 직전:
if (!bgmMuted) updateBgmRate();
```

---

## 8. SFX 시스템 (효과음)

### 8-1. 파일 구성

| 파일명 | 용도 | 트리거 조건 |
|--------|------|-------------|
| `SFX_1.mp3` | Near-Miss (고속) | Near-Miss 발동 시 **속도 > 1.5배** |
| `SFX_2.mp3` | Near-Miss (저속) | Near-Miss 발동 시 **속도 ≤ 1.5배** |
| `SFX_3.mp3` | 게임 오버 | 충돌 / 게임 포기 시점 |

> 경로(웹): `music/SFX_*.mp3`  
> 경로(안드로이드): `assets/music/SFX_*.mp3`

### 8-2. 속도 판정 기준

- 비교 대상: `effectiveSpeedMul()`의 **부스트 적용 직전 값**
- 임계값: `SFX_THRESHOLD = 1.5`
- Speed Burst 중에는 effective ≈ 4.0 → 항상 SFX_1(고속) 재생

| 상황 | effective speed | 재생 SFX |
|------|-----------------|----------|
| 게임 시작 직후 | 1.0 | SFX_2 |
| Near-Miss 1~2회 누적 | 1.2~1.45 | SFX_2 |
| Near-Miss 3회 이상 누적 | ≥ 1.5 (정확히 1.5는 SFX_2) | SFX_1 |
| MAX 속도 | 2.0 | SFX_1 |
| Speed Burst 발동 중 | 4.0 | SFX_1 |

### 8-3. 동시 재생 처리 (cloneNode 방식)

Near-Miss는 짧은 간격으로 연속 발생 가능 → 단일 Audio 인스턴스로는 끊김 발생.  
**`cloneNode()`로 즉석 인스턴스를 만들어 재생**하면 동일 효과음의 중첩 재생이 가능하다.

```js
function playSfx(audio) {
    if (sfxVolume <= 0) return;
    const clone = audio.cloneNode();
    clone.volume = sfxVolume;
    clone.play().catch(() => {});
}
```

### 8-4. 볼륨 정책

| 항목 | 값 | 비고 |
|------|-----|------|
| SFX 기본 볼륨 | `80%` | localStorage `jiljuSfx` 키 |
| 슬라이더 위치 | 옵션 팝업 → "효과음" 슬라이더 | 드래그 즉시 `sfxVolume`에 반영 |
| 0% 시 | `playSfx()` 조기 반환 → 재생 안 함 |
| 🎵 뮤트 토글 | **BGM에만 적용** (SFX는 슬라이더로 별도 제어) |

### 8-5. 트리거 위치

| 함수 | SFX |
|------|-----|
| `triggerNearMiss(ob)` | 부스트 적용 **직전**에 `playSfx(speedAtMoment > 1.5 ? sfxNearFast : sfxNearSlow)` |
| `gameOver()` | `bgmStop()` 직후 `playSfx(sfxGameOver)` |

---

## 9. 구현 방법 (HTML5 Audio API)

### 9-1. Audio 객체 생성 (game.js 상단)

```js
const BGM_PATH = 'music/BGM_1.mp3';

const bgm = new Audio(BGM_PATH);
bgm.loop   = true;
bgm.volume = (parseInt(localStorage.getItem('jiljuBgm') || '60', 10)) / 100;

let bgmMuted = localStorage.getItem('jiljuMute') === '1';
if (bgmMuted) /* 아이콘 초기 상태는 DOM 로드 후 처리 */;
```

### 9-2. 헬퍼 함수

```js
function bgmPlay() {
    if (bgmMuted) return;
    bgm.play().catch(() => {});   // 자동재생 거부 시 에러 무시
}

function bgmStop() {
    bgm.pause();
    bgm.currentTime = 0;
}

function updateBgmRate() {
    const eff = effectiveSpeedMul();
    const rate = 1.0 + (eff - 1.0) / (4.0 - 1.0) * 0.5;
    bgm.playbackRate = Math.min(2.0, Math.max(0.5, rate));
}
```

### 9-3. 게임 이벤트 연결

```js
// START 버튼
$('btnStart').addEventListener('click', () => {
    $('startScreen').classList.add('hidden');
    resetGame();
    bgm.currentTime = 0;
    bgmPlay();
});

// 다시 시작
$('btnRestart').addEventListener('click', () => {
    resetGame();
    bgm.currentTime = 0;
    bgmPlay();
});

// 설정 (일시정지)
$('btnSettings').addEventListener('click', () => {
    isPaused = true;
    bgm.pause();
    $('settingsPopup').classList.remove('hidden');
});

// 게임 돌아가기 (재개)
$('btnResume').addEventListener('click', () => {
    isPaused = false;
    $('settingsPopup').classList.add('hidden');
    bgmPlay();
});
```

### 9-4. gameOver() 내부

```js
function gameOver() {
    // ... 기존 코드 ...
    bgmStop();
    playSfx(sfxGameOver); // [GDD #4 §8] 게임 오버 효과음
    // ...
}
```

### 9-5. triggerNearMiss() 내부

```js
function triggerNearMiss(ob) {
    if (ob.nearMissTriggered) return;
    ob.nearMissTriggered = true;

    // [GDD #4 §8-2] 부스트 적용 직전 속도로 SFX 선택
    const speedAtMoment = effectiveSpeedMul();
    playSfx(speedAtMoment > SFX_THRESHOLD ? sfxNearFast : sfxNearSlow);

    // ... 기존 부스트/팝업 처리 ...
}
```

---

## 10. 안드로이드 WebView 대응

- `MainActivity.kt`에 `mediaPlaybackRequiresUserGesture = false` 설정이 이미 존재
  - WebView에서 사용자 제스처 없이도 오디오 재생 가능
  - 단, UX 일관성을 위해 **게임 시작 버튼 터치 시점에 재생** 권장
- 안드로이드 빌드 시 `assets/music/BGM_1.mp3`, `SFX_1.mp3`, `SFX_2.mp3`, `SFX_3.mp3` 파일 추가 필요
- `game.html`, `game.js`를 `app/src/main/assets/`에도 동일하게 반영

---

## 11. 향후 확장

| 기능 | 우선순위 | 비고 |
|------|----------|------|
| BGM_2 — 고속 구간 전환 트랙 | 낮음 | `speedMul >= SPEED_MAX` 도달 시 크로스페이드 전환 |
| Burst 발동 전용 SFX | 낮음 | Burst 시작 시 별도 효과음 |
| 차선 변경 SFX | 낮음 | 가벼운 슬라이드 사운드 |
| 충돌(폭발) SFX | 낮음 | SFX_3 외에 추가적인 충돌음 |
| 마스터 볼륨 / 전체 뮤트 | 중 | 🎵 토글이 SFX까지 제어하도록 변경 옵션 |
