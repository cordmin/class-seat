# 학급 자리배치 프로그램 — EXE 빌드 가이드
제작: KYUNGMINAI

---

## 📁 파일 구성

```
seatapp/
├── main.py          ← Python 앱 진입점
├── seat.html        ← 자리배치 프로그램 본체 (HTML)
├── seat_app.spec    ← PyInstaller 빌드 설정
├── requirements.txt ← 필요 패키지 목록
├── build.bat        ← 원클릭 빌드 스크립트 (Windows)
└── README.md        ← 이 파일
```

---

## 🚀 빌드 방법 (Windows)

### 사전 조건
- **Python 3.9 이상** 설치  
  → https://www.python.org/downloads/  
  설치 시 **"Add Python to PATH"** 반드시 체크!
- 인터넷 연결 (패키지 다운로드용)

### 빌드 실행
1. 이 폴더에서 `build.bat` 더블클릭
2. 자동으로 패키지 설치 → html2canvas 번들 → EXE 빌드
3. 완료되면 `dist\학급자리배치프로그램.exe` 생성

> 빌드는 최초 1회만 하면 됩니다.  
> 이후엔 `dist\학급자리배치프로그램.exe` 파일만 배포하세요.

---

## 🖥️ 실행 환경

| 항목 | 내용 |
|------|------|
| OS | Windows 10 / 11 (64bit) |
| 런타임 | 없음 (단일 exe에 모두 포함) |
| 추가 설치 | 불필요 |
| 인터넷 | 불필요 (오프라인 동작) |

> ※ pywebview는 Windows의 Edge WebView2(내장)를 사용합니다.  
> Windows 10 1803 이상에서는 별도 설치 없이 동작합니다.

---

## 🛠️ 수동 빌드 (build.bat 없이)

```bat
pip install pywebview pyinstaller
pyinstaller seat_app.spec --noconfirm
```

---

## 💡 아이콘 변경

1. `icon.ico` 파일 준비 (256×256 권장)
2. `seat_app.spec` 에서 아래 줄 주석 해제:
   ```python
   # icon='icon.ico',  →  icon='icon.ico',
   ```
3. 다시 빌드

---

## ⚠️ 주의사항

- 빌드된 exe는 **Windows 전용**입니다.
- macOS/Linux에서 빌드하려면 `seat_app.spec`의  
  `hiddenimports`에서 `winforms` 관련 항목을 제거하세요.
- 백신 프로그램이 PyInstaller exe를 오탐할 수 있습니다.  
  (정상 동작이며, 소스 코드로 직접 확인 가능합니다.)
