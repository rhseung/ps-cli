# ps-cli

백준(BOJ) 문제 해결을 위한 통합 CLI 도구입니다. Ink 기반의 인터랙티브 터미널 UI로 문제 가져오기, 로컬 테스트, 제출까지 지원하는 개발 환경을 제공합니다.

## 설치

### npm 사용

```bash
npm install -g ps-cli
```

### bun 사용

```bash
bun install -g ps-cli
```

또는 `bunx`를 사용하여 직접 실행:

```bash
bunx ps-cli fetch 1000
```

## 요구사항

- Node.js >= 18.0.0

## 주요 기능

- **문제 가져오기**: Solved.ac API와 BOJ 크롤링을 통한 문제 정보 및 예제 데이터 자동 생성
- **로컬 테스트**: 여러 언어(JS/TS, Python, C++) 지원 및 자동 테스트 실행
- **제출**: BOJ 자동 제출 및 결과 확인
- **통계**: Solved.ac API를 활용한 사용자 통계 조회
- **Watch 모드**: 파일 저장 시 자동 테스트 실행

## 명령어

### `fetch` - 문제 가져오기

백준 문제를 가져와서 로컬에 파일을 생성합니다.

```bash
ps fetch <문제번호> [옵션]
```

**기능:**

- Solved.ac API와 BOJ 크롤링을 통해 문제 정보 수집
- 문제 설명, 입출력 형식, 예제 입출력 파일 자동 생성
- 선택한 언어의 솔루션 템플릿 파일 생성
- README.md에 문제 정보, 통계, 태그 등 포함

**옵션:**

- `--language, -l`: 언어 선택 (python, javascript, typescript, cpp)
  - 기본값: python

**예제:**

```bash
ps fetch 1000
ps fetch 1000 --language python
ps fetch 1000 -l cpp
```

### `test` - 로컬 테스트 실행

예제 입출력 기반으로 로컬 테스트를 실행합니다.

```bash
ps test [문제번호] [옵션]
```

**기능:**

- 현재 디렉토리 또는 지정한 문제 번호의 테스트 실행
- `solution.*` 파일을 자동으로 찾아 언어 감지
- `input*.txt`와 `output*.txt` 파일을 기반으로 테스트
- 문제의 시간 제한을 자동으로 적용
- `--watch` 옵션으로 파일 변경 시 자동 재테스트

**옵션:**

- `--language, -l`: 언어 선택 (지정 시 자동 감지 무시)
- `--watch, -w`: watch 모드 (파일 변경 시 자동 재테스트)

**예제:**

```bash
ps test                    # 현재 디렉토리에서 테스트
ps test 1000               # 1000번 문제 테스트
ps test --watch            # watch 모드로 테스트
ps test 1000 --watch       # 1000번 문제를 watch 모드로 테스트
```

### `run` - 코드 실행

코드를 실행합니다 (테스트 없이).

```bash
ps run [문제번호] [옵션]
```

**기능:**

- 현재 디렉토리 또는 지정한 문제 번호의 코드 실행
- `solution.*` 파일을 자동으로 찾아 언어 감지
- `input.txt` 또는 `input1.txt`를 표준 입력으로 사용
- 테스트 케이스 검증 없이 단순 실행

**옵션:**

- `--language, -l`: 언어 선택 (지정 시 자동 감지 무시)
- `--input, -i`: 입력 파일 지정 (기본값: input.txt 또는 input1.txt)

**예제:**

```bash
ps run                    # 현재 디렉토리에서 실행
ps run 1000               # 1000번 문제 실행
ps run --language python  # Python으로 실행
ps run --input input2.txt # 특정 입력 파일 사용
```

### `submit` - BOJ 제출

현재 문제의 솔루션 파일을 BOJ에 제출합니다.

```bash
ps submit [문제번호] [옵션]
```

**기능:**

- 현재 디렉토리 또는 지정한 문제 번호의 솔루션 파일 제출
- `solution.*` 파일을 자동으로 찾아 언어 감지
- 제출 후 채점 결과를 자동으로 확인

**옵션:**

- `--language, -l`: 언어 선택 (지정 시 자동 감지 무시)
- `--dry-run`: 실제 제출 없이 검증만 수행

**예제:**

```bash
ps submit                    # 현재 디렉토리에서 제출
ps submit 1000               # 1000번 문제 제출
ps submit --language python  # Python으로 제출
ps submit --dry-run          # 제출 전 검증만 수행
```

**참고:** 제출 기능을 사용하려면 먼저 BOJ 세션 쿠키를 설정해야 합니다:

```bash
ps config boj-session-cookie "boj_session=your_session_cookie"
```

### `stats` - 사용자 통계 조회

Solved.ac에서 사용자 통계를 조회합니다.

```bash
ps stats [핸들] [옵션]
```

**기능:**

- 티어, 레이팅, 해결한 문제 수 등 표시
- 그라데이션으로 시각적으로 표시

**옵션:**

- `--handle, -h`: Solved.ac 핸들 (설정에 저장된 값 사용 가능)

**예제:**

```bash
ps stats myhandle
ps stats --handle myhandle
```

**참고:** 핸들을 설정에 저장하면 매번 입력할 필요가 없습니다:

```bash
ps config solved-ac-handle myhandle
ps stats  # 설정된 핸들 사용
```

### `config` - 설정 관리

사용자 설정을 관리합니다.

```bash
ps config <키> [값]
ps config <키> --get
ps config --list
```

**설정 키:**

- `boj-session-cookie`: BOJ 세션 쿠키 (제출 기능용)
- `default-language`: 기본 언어 (python, javascript, typescript, cpp)
- `code-open`: 코드 공개 여부 (true/false)
- `editor`: 에디터 명령어 (예: code, vim, nano)
- `auto-open-editor`: fetch 후 자동으로 에디터 열기 (true/false)
- `solved-ac-handle`: Solved.ac 핸들 (stats 명령어용)

**옵션:**

- `--get`: 설정 값 조회
- `--list`: 모든 설정 조회
- `--help, -h`: 도움말 표시

**예제:**

```bash
ps config boj-session-cookie "boj_session=xxx"
ps config default-language python
ps config solved-ac-handle myhandle
ps config solved-ac-handle --get
ps config --list
```

### `help` - 도움말 표시

도움말을 표시합니다.

```bash
ps help
ps --help
ps <명령어> --help
```

## 기술 스택

- **Ink**: React 기반 터미널 UI
- **TypeScript**: 타입 안전성
- **Meow**: CLI 인자 파싱
- **Execa**: 프로세스 실행
- **Cheerio**: HTML 파싱
- **tsup**: 빌드 도구

## 사용 예제

### 전체 워크플로우

```bash
# 1. 문제 가져오기
ps fetch 1000 --language python

# 2. 문제 디렉토리로 이동
cd problems/1000

# 3. 코드 작성 (solution.py 편집)

# 4. 로컬 테스트
ps test

# 5. Watch 모드로 개발 (파일 저장 시 자동 테스트)
ps test --watch

# 6. 단일 입력으로 실행 테스트
ps run

# 7. BOJ에 제출
ps submit
```

### 설정 예제

```bash
# BOJ 세션 쿠키 설정 (제출 기능용)
ps config boj-session-cookie "boj_session=your_cookie_here"

# 기본 언어 설정
ps config default-language python

# Solved.ac 핸들 설정
ps config solved-ac-handle myhandle

# fetch 후 자동으로 VS Code 열기
ps config editor code
ps config auto-open-editor true
```

## 라이선스

MIT
