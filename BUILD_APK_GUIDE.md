# 질주 본능 — APK 빌드 가이드 (GitHub Actions)

이 PC에 Android Studio를 설치하지 않고도 GitHub Actions를 통해 **클라우드에서 APK를 자동 빌드**할 수 있습니다.

---

## 필요한 것

- GitHub 계정 (무료)
- 인터넷 연결
- (선택) Git CLI 또는 GitHub Desktop — 없어도 웹 업로드만으로 가능

---

## 절차

### 1단계: GitHub에 새 저장소 만들기

1. <https://github.com/new> 접속
2. Repository name: 예) `jiljubonneung` (자유)
3. **Public** 또는 **Private** 선택 (Private도 무료 빌드 가능)
4. **Create repository** 클릭

### 2단계: 파일 업로드 (3가지 방법 중 택1)

#### 방법 A — 웹에서 드래그&드롭 (가장 쉬움, Git 불필요)

1. 새 저장소 페이지에서 **"uploading an existing file"** 링크 클릭
2. 윈도우 탐색기에서 `곡예운전게임` 폴더 안의 **모든 파일과 폴더를 통째로 드래그&드롭**
   - ⚠️ `JilJuBonNeung_Android/build/`, `JilJuBonNeung_Android/.gradle/` 폴더가 있으면 제외
3. 하단의 **Commit changes** 버튼 클릭

> 단점: GitHub 웹은 한 번에 100파일 정도까지만 업로드됩니다. 차량 이미지·음원 파일까지 포함하면 분할 업로드가 필요할 수 있습니다.

#### 방법 B — GitHub Desktop (GUI, 권장)

1. <https://desktop.github.com/> 에서 GitHub Desktop 설치
2. **Add Existing Repository** → `곡예운전게임` 폴더 선택
3. **Publish repository** 클릭 → 위에서 만든 저장소에 연결
4. 모든 파일이 자동 업로드됨

#### 방법 C — Git CLI (개발자 친화적)

```powershell
cd "C:\Users\wnsal\OneDrive\바탕 화면\곡예운전게임"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<본인_계정>/<저장소이름>.git
git push -u origin main
```

### 3단계: 빌드 자동 시작 확인

1. 업로드(push)가 끝나면 GitHub 저장소 페이지의 상단 메뉴에서 **Actions** 탭 클릭
2. **"Build Android APK"** 워크플로우가 자동으로 실행되고 있어야 함
3. 진행 중이면 노란 점, 완료되면 초록 체크 (보통 4~7분 소요)

> 자동으로 시작되지 않으면 **Actions** 탭 → 좌측 "Build Android APK" 클릭 → **Run workflow** 버튼으로 수동 실행 가능

### 4단계: 빌드된 APK 다운로드

1. **Actions** 탭 → 완료된 워크플로우 클릭
2. 페이지 하단의 **Artifacts** 섹션에서:
   - **JilJuBonNeung-debug-apk** ← 일반 설치용 (서명 자동, 디버그용)
   - **JilJuBonNeung-release-unsigned-apk** ← 서명 미적용 릴리스 (스토어 업로드용 베이스)
3. 클릭하여 ZIP 다운로드 → 압축 해제 → `app-debug.apk` 획득

### 5단계: 안드로이드 폰에 설치

1. APK 파일을 안드로이드 폰으로 전송 (메일·드라이브·USB 등)
2. 폰에서 APK 파일 탭
3. "출처를 알 수 없는 앱 설치 허용" 권한 ON (안드로이드 알림에 따라)
4. 설치 완료 → **질주 본능** 앱 실행

---

## 워크플로우 상세

`.github/workflows/build-android.yml` 파일이 다음 작업을 자동으로 수행합니다.

| 단계 | 내용 |
|------|------|
| 1 | Ubuntu Linux 가상 머신 시작 |
| 2 | JDK 17 (Temurin) 설치 |
| 3 | Android SDK 설치 |
| 4 | Gradle 8.7 설치 + 라이선스 자동 동의 |
| 5 | `gradle wrapper` 자동 생성 (gradlew 없을 때만) |
| 6 | `./gradlew assembleDebug` 실행 → Debug APK |
| 7 | `./gradlew assembleRelease` 실행 → Unsigned Release APK |
| 8 | APK를 Artifact로 업로드 (30일 보관) |

---

## 트리거 조건

워크플로우가 자동 실행되는 조건:

- **`JilJuBonNeung_Android/` 안의 파일이 변경되어 push 될 때** — 가장 일반적
- `build-android.yml` 워크플로우 파일이 변경될 때
- **수동 실행** — Actions 탭에서 "Run workflow" 버튼

> 웹 콘텐츠(`game.js`, `game.html` 등 루트 파일)만 수정한 경우, 안드로이드 빌드는 트리거되지 않습니다. 안드로이드용으로 반영하려면 `JilJuBonNeung_Android/app/src/main/assets/` 안의 동일 파일도 함께 push 하세요.

---

## 자주 발생하는 문제

| 문제 | 해결 |
|------|------|
| Actions 탭이 안 보임 | 저장소 Settings → Actions → "Allow all actions" 활성화 |
| 워크플로우 실행 실패: SDK license | 자동 동의 단계 포함되어 있음. 다시 실행 시 보통 해결 |
| APK가 폰에 설치되지 않음 | "출처를 알 수 없는 앱" 권한 허용 필요 |
| 음원·이미지가 안 들리거나 안 보임 | `assets/music/`, `assets/car_image/` 폴더가 함께 push 되었는지 확인 |
| 빌드 시간이 너무 오래 걸림 | 첫 빌드만 ~7분, 이후 캐시로 ~3분 |

---

## 릴리스 APK에 서명을 넣고 싶다면

Play Store나 일반 배포용으로는 **서명된** Release APK가 필요합니다. 워크플로우 확장이 필요하므로 별도 가이드 요청 시 추가해드립니다. 현재 워크플로우는 디버그 APK만으로도 본인 폰에서 정상 설치·실행됩니다.

---

*질주 본능 / GitHub Actions 빌드 가이드 / 2026-05-05*
