# 질주 본능 — 안드로이드 앱

WebView 기반 안드로이드 앱입니다. 기존 HTML5 게임을 그대로 안드로이드 디바이스에서 실행할 수 있습니다.

---

## 프로젝트 구조

```
JilJuBonNeung_Android/
├── settings.gradle
├── build.gradle               (프로젝트 루트)
├── gradle.properties
├── gradle/wrapper/gradle-wrapper.properties
├── .gitignore
├── README.md
└── app/
    ├── build.gradle
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/jiljubonneung/game/
        │   └── MainActivity.kt          ← WebView 로더
        ├── res/
        │   ├── values/strings.xml       ← 앱 이름: 질주 본능
        │   ├── values/themes.xml        ← 풀스크린 테마
        │   ├── values/colors.xml
        │   └── mipmap-*/ic_launcher.png ← 앱 아이콘 (엑센트 이미지)
        └── assets/                      ← WebView 가 로드하는 게임 파일
            ├── index.html               (메인 페이지)
            ├── game.html                (게임 화면)
            ├── cars.html
            ├── world.html
            ├── styles.css
            ├── game.js
            └── car_image/car_image_fix/
                ├── genesis_gv80_topview_2d_fix.png
                ├── tucson_topview_2d_fix.png
                ├── sonata_topview_2d_fix.png
                └── accent_topview_2d_fix.png
```

---

## 빌드 및 실행 방법

### 1. 사전 준비

- **Android Studio** (Hedgehog / Iguana / Koala 이상 권장) 설치
- 인터넷 연결 (최초 빌드 시 Gradle/SDK 자동 다운로드)

### 2. 프로젝트 열기

1. Android Studio 실행
2. **File > Open** 메뉴 선택
3. 이 프로젝트 폴더(`JilJuBonNeung_Android`) 선택
4. Gradle Sync 자동 시작 (처음 열 땐 Gradle 8.7 다운로드 시간 약 5~10분)
   - 만약 `gradle-wrapper.jar` 누락 오류가 나면, Android Studio 메뉴에서
     **File > New > Project from Existing Sources** 로 다시 열거나,
     **File > Sync Project with Gradle Files** 를 한 번 실행
   - 또는 터미널에서 `gradle wrapper` 실행 (Gradle 설치 시)

### 3. 안드로이드 디바이스에서 실행

**옵션 A: 실제 디바이스 (권장)**
1. 안드로이드 폰 → 설정 → 휴대전화 정보 → 빌드번호 7회 탭 (개발자 모드 활성화)
2. 설정 → 개발자 옵션 → USB 디버깅 ON
3. USB로 PC에 연결
4. Android Studio 상단 디바이스 선택 → 본인 폰 선택
5. ▶ Run 버튼 클릭

**옵션 B: 에뮬레이터**
1. Android Studio → Tools > Device Manager
2. Create Virtual Device → Pixel 7 등 선택 → API 34 시스템 이미지 다운로드
3. 에뮬레이터 실행 후 ▶ Run

### 4. APK 파일 만들기 (배포용)

- **Debug APK**: Android Studio → **Build > Build Bundle(s) / APK(s) > Build APK(s)**
  - 위치: `app/build/outputs/apk/debug/app-debug.apk`
- **Release APK** (서명 필요): **Build > Generate Signed Bundle / APK**

---

## 조작 방법 (앱)

게임 화면 안에서:

| 동작 | 입력 |
|------|------|
| 왼쪽 차선 | 왼쪽으로 슬라이드 (좌→우 반대) |
| 오른쪽 차선 | 오른쪽으로 슬라이드 |
| Speed Burst (게이지 MAX 시) | **위쪽으로 슬라이드** 또는 게이지 탭 |

> 안드로이드 앱은 키보드가 없으므로 **3방향 슬라이드 (왼쪽/오른쪽/위쪽)** 가 핵심 조작입니다.
> 위쪽 슬라이드 = Burst 발동 (3초 무적 + 초고속 + 모든 통과 100점).

---

## 주요 사양

| 항목 | 값 |
|------|-----|
| 패키지명 | `com.jiljubonneung.game` |
| 앱 이름 | 질주 본능 |
| 앱 아이콘 | `accent_topview_2d_fix.png` |
| 최소 SDK | 24 (Android 7.0 Nougat) |
| 타깃 SDK | 34 (Android 14) |
| 화면 회전 | Portrait (세로) 고정 |
| Status / Nav Bar | 풀스크린 숨김 (Immersive 모드) |
| WebView | JavaScript ON, Zoom OFF, Cache 자동 |

---

## 내부 동작 원리

1. 앱 실행 → `MainActivity` 시작
2. 풀스크린 모드 적용 (status bar / nav bar 숨김)
3. `WebView` 생성 후 `file:///android_asset/index.html` 로드
4. 사용자가 `index.html` 의 메뉴에서 "게임 시작" → `game.html` 로 이동
5. 게임 시작 → `game.js` 가 Canvas에 게임 렌더링
6. 터치 슬라이드 → 게임 내 키보드/터치 핸들러로 전달
7. 시스템 뒤로가기 버튼 → WebView 히스토리 뒤로 (없으면 앱 종료)

---

## 자주 발생하는 문제

| 문제 | 해결 |
|------|------|
| Gradle Sync 실패 | Android Studio 최신 버전 사용 / 인터넷 확인 |
| `gradle-wrapper.jar` 없음 | Android Studio 가 자동 생성하거나, `gradle wrapper` 실행 |
| 빌드 후 흰 화면만 표시 | `assets/` 폴더 안에 `index.html` 이 있는지 확인 |
| 차량 이미지 안 보임 | `assets/car_image/car_image_fix/*.png` 파일들 확인 |
| 슬라이드 인식 안 됨 | WebView 줌 비활성화 확인 (`builtInZoomControls = false`) |
| 화면 회전 발생 | `AndroidManifest.xml` 의 `screenOrientation="portrait"` 확인 |

---

## 게임 콘텐츠 업데이트

게임 로직(`game.js`, `game.html`, 이미지 등)을 수정하려면:

1. `app/src/main/assets/` 안의 파일을 수정
2. Android Studio에서 ▶ Run 다시 실행
3. 변경사항 즉시 반영

원본 웹 파일(`C:\Users\wnsal\OneDrive\바탕 화면\곡예운전게임\` 안의 파일들)을 직접 수정한 경우,
다음 PowerShell 명령으로 다시 복사하세요.

```powershell
$src = "C:\Users\wnsal\OneDrive\바탕 화면\곡예운전게임"
$assets = "$src\JilJuBonNeung_Android\app\src\main\assets"
Copy-Item "$src\index.html" "$assets\" -Force
Copy-Item "$src\game.html" "$assets\" -Force
Copy-Item "$src\cars.html" "$assets\" -Force
Copy-Item "$src\world.html" "$assets\" -Force
Copy-Item "$src\styles.css" "$assets\" -Force
Copy-Item "$src\game.js" "$assets\" -Force
Copy-Item "$src\car_image\car_image_fix\*.png" "$assets\car_image\car_image_fix\" -Force
```

---

*질주 본능 안드로이드 앱 / v1.0 / 2026-05-05*
