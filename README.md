# ps-cli

**대화형** 인터페이스와 **사용자 친화적인 디자인**을 갖춘 백준 문제 해결 CLI 도구입니다.
검색부터 제출까지, 모든 과정을 직관적이고 아름다운 터미널 환경에서 해결하세요.

Nerd Font 사용을 권장합니다.

## 설치

```bash
npm install -g @rhseung/ps-cli
# 또는
bun install -g @rhseung/ps-cli
```

## 빠른 시작

```bash
# 0. 도움말 보기
ps --help

# 1. 프로젝트 초기화
ps init

# 2. 문제 가져오기
ps fetch 1000

# 3. 코드 작성 후 테스트
ps test

# 4. 제출
ps submit

# 5. 커밋 및 아카이빙
ps archive
```

## 명령어

### `init` - 프로젝트 초기화

프로젝트를 대화형으로 초기화하고 설정을 구성합니다.

**사용법:**

```bash
ps init
```

**설명:**

- 단계별로 설정을 물어봅니다
- 아카이브 디렉토리, solving 디렉토리, 아카이빙 전략, 기본 언어, 에디터 등을 설정할 수 있습니다

---

### `fetch` - 문제 가져오기

백준 문제를 가져와서 로컬에 파일을 생성합니다.

**사용법:**

```bash
ps fetch <문제번호> [옵션]
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--language`, `-l`: 언어 선택 (python, javascript, typescript, cpp)
  - 기본값: python 또는 설정 파일의 `general.default-language`

**예제:**

```bash
ps fetch 1000
ps fetch 1000 --language python
ps fetch 1000 -l cpp
```

**설명:**

- Solved.ac API와 BOJ 크롤링을 통해 문제 정보 수집
- 문제 설명, 입출력 형식, 예제 입출력 파일 자동 생성
- 선택한 언어의 솔루션 템플릿 파일 생성
- README.md에 문제 정보, 통계, 태그 등 포함

---

### `test` - 로컬 테스트

예제 입출력으로 테스트를 실행합니다.

**사용법:**

```bash
ps test [문제번호] [옵션]
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--language`, `-l`: 언어 선택 (지정 시 자동 감지 무시)
  - 지원 언어: python, javascript, typescript, cpp
- `--watch`, `-w`: watch 모드 (파일 변경 시 자동 재테스트)
  - solution._, testcases/\*\*/_.txt 파일 변경 감지

**예제:**

```bash
ps test                    # 현재 디렉토리에서 테스트
ps test 1000               # 1000번 문제 테스트
ps test --watch            # watch 모드로 테스트
ps test 1000 --watch       # 1000번 문제를 watch 모드로 테스트
ps test --language python  # Python으로 테스트
```

**설명:**

- 현재 디렉토리 또는 지정한 문제 번호의 테스트 실행
- solution.\* 파일을 자동으로 찾아 언어 감지
- testcases/{번호}/input.txt와 testcases/{번호}/output.txt 파일을 기반으로 테스트
- 문제의 시간 제한을 자동으로 적용

---

### `run` - 코드 실행

테스트 없이 코드를 실행합니다.

**사용법:**

```bash
ps run [문제번호] [옵션]
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--language`, `-l`: 언어 선택 (지정 시 자동 감지 무시)
  - 지원 언어: python, javascript, typescript, cpp
- `--input`, `-i`: 입력 파일 지정
  - 숫자만 입력 시 testcases/{숫자}/input.txt로 자동 변환 (예: `--input 1`)
  - 전체 경로도 지원 (예: testcases/1/input.txt)

**예제:**

```bash
ps run                  # 현재 디렉토리에서 표준 입력으로 실행
ps run 1000             # 1000번 문제 표준 입력으로 실행
ps run --language python # Python으로 표준 입력으로 실행
ps run --input 1         # 테스트 케이스 1번 사용
ps run --input testcases/1/input.txt # 전체 경로로 입력 파일 지정
```

**설명:**

- 현재 디렉토리 또는 지정한 문제 번호의 코드 실행
- solution.\* 파일을 자동으로 찾아 언어 감지
- --input 옵션으로 입력 파일 지정 가능 (예: `--input 1` 또는 `--input testcases/1/input.txt`)
- 옵션 없이 실행 시 표준 입력으로 입력 받기
- 테스트 케이스 검증 없이 단순 실행

---

### `submit` - 제출

백준 제출 페이지를 열고 소스 코드를 클립보드에 복사합니다.

**사용법:**

```bash
ps submit [문제번호] [옵션]
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--language`, `-l`: 언어 선택 (지정 시 자동 감지 무시)
  - 지원 언어: python, javascript, typescript, cpp

**예제:**

```bash
ps submit                    # 현재 디렉토리에서 제출
ps submit 1000                # 1000번 문제 제출
ps submit --language python   # Python으로 제출
```

**설명:**

- 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론
- solution.\* 파일을 자동으로 찾아 언어 감지
- 소스 코드를 클립보드에 자동 복사
- 제출 페이지를 브라우저로 자동 열기

---

### `archive` - 아카이빙

solving 디렉토리의 문제를 archive 디렉토리로 이동하고 (선택적으로) Git 커밋을 생성합니다.

**사용법:**

```bash
ps archive [문제번호]
```

**예제:**

```bash
ps archive 1000              # 1000번 문제 아카이빙
ps archive                   # 현재 디렉토리에서 문제 번호 자동 감지
```

**설명:**

- solving 디렉토리에서 문제를 찾아 archive 디렉토리로 이동
- 설정에 따라 Git add 및 commit 실행
- 기본 커밋 메시지: "solve: {id} - {title}"
- `archive.auto-commit` 이 `true` 인 경우, **archive 디렉토리로 이동 후** Git 커밋을 시도하며, 커밋 실패 시 다시 원래 위치로 되돌림 (롤백)
- `archive.auto-commit` 이 `false` 인 경우, Git 커밋 없이 디렉토리만 이동

---

### `open` - 문제 페이지 또는 에디터 열기

백준 문제 페이지 또는 에디터를 엽니다.

**사용법:**

```bash
ps open [문제번호] [옵션]
ps open --workbook <문제집ID>
ps open -w <문제집ID>
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--workbook`, `-w`: 문제집 ID를 지정하여 해당 문제집 페이지를 엽니다
- `--editor`, `-e`: 문제 파일을 에디터로 엽니다

**예제:**

```bash
ps open 1000                 # 1000번 문제 브라우저로 열기
ps open                      # 현재 문제 브라우저로 열기
ps open -e                   # 현재 문제 에디터로 열기
ps open 1000 -e              # 1000번 문제 에디터로 열기
ps open --workbook 25052     # 문제집 25052 열기
```

**설명:**

- 문제 번호를 인자로 전달하거나 문제 디렉토리에서 실행하면 자동으로 문제 번호를 추론
- `--workbook` 또는 `-w` 옵션으로 문제집 페이지를 열 수 있습니다
- `--editor` 또는 `-e` 옵션으로 문제의 솔루션 파일이나 디렉토리를 에디터로 열 수 있습니다
- 에디터는 `ps config set editor.command <명령어>`로 설정할 수 있습니다 (기본값: `code`)

---

### `search` - 문제 검색

solved.ac에서 문제를 검색하거나 백준 문제집의 문제 목록을 표시합니다.

**사용법:**

```bash
ps search <쿼리> [옵션]
ps search --workbook <문제집ID>
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--workbook`: 문제집 ID를 지정하여 해당 문제집의 문제 목록을 표시

**예제:**

```bash
ps search "*g1...g5"           # Gold 1-5 문제 검색
ps search "tier:g1...g5"       # Gold 1-5 문제 검색 (tier: 문법)
ps search "#dp"                 # DP 태그 문제 검색
ps search "tag:dp"              # DP 태그 문제 검색 (tag: 문법)
ps search "*g1...g5 #dp"        # Gold 1-5 티어의 DP 태그 문제 검색
ps search --workbook 25052      # 문제집 25052의 문제 목록 표시
```

**설명:**

- solved.ac 검색어 문법을 지원합니다
- 문제 목록에서 해결 상태를 아이콘으로 확인할 수 있습니다
  - **해결됨(``)**: 이미 해결되어 아카이브된 문제
  - **해결 중(``)**: 현재 해결 중인 문제
- 문제 선택 시 인터랙티브 메뉴를 통해 다양한 작업을 수행할 수 있습니다
  - `󰖟 브라우저에서 열기 (open)`
  - `󰇚 문제 가져오기 (fetch)`
  - ` 로컬 테스트 실행 (test)` (해결 중/완료인 경우)
  - `󰭹 코드 제출하기 (submit)` (해결 중/완료인 경우)
  - ` 문제 아카이브 (archive)` (해결 중인 경우)
- 페이지네이션을 통해 여러 페이지의 결과를 탐색할 수 있습니다
- `--workbook` 옵션으로 백준 문제집의 문제 목록을 볼 수 있습니다

---

### `stats` - 통계 조회

Solved.ac에서 사용자 통계를 조회합니다.

**사용법:**

```bash
ps stats [핸들] [옵션]
```

**옵션:**

- `--help`, `-h`: 도움말 표시
- `--handle`, `-h`: Solved.ac 핸들
  - 설정에 저장된 값 사용 가능
  - 인자로 전달하거나 플래그로 지정 가능

**예제:**

```bash
ps stats myhandle              # myhandle의 통계 조회
ps stats --handle myhandle     # 플래그로 핸들 지정
ps stats                       # 설정에 저장된 핸들 사용
```

**설명:**

- 티어, 레이팅, 해결한 문제 수 등 표시
- 그라데이션으로 시각적으로 표시
- 핸들 우선순위: 인자 > 플래그 > 설정 파일

---

### `config` - 설정 관리

프로젝트 설정(.ps-cli/config.yaml)을 관리합니다.

**사용법:**

```bash
ps config <명령어> [키] [값] [옵션]
```

**명령어:**

- `get [키]`: 설정 값 조회 (키 없으면 대화형 선택)
- `set [키] [값]`: 설정 값 설정 (키/값 없으면 대화형 선택)
- `list`: 모든 설정 조회
- `clear`: .ps-cli 폴더 및 모든 설정 삭제

**옵션:**

- `--help`, `-h`: 도움말 표시

**예제:**

```bash
ps config get                         # 대화형으로 키 선택 후 값 조회
ps config get general.default-language         # 기본 언어 값 조회
ps config set                         # 대화형으로 키 선택 후 값 설정
ps config set editor.command cursor            # 에디터를 cursor로 설정
ps config list                         # 모든 설정 조회
ps config clear                        # .ps-cli 폴더 및 모든 설정 삭제
```

**설명:**

- 설정은 현재 프로젝트의 .ps-cli 디렉토리 내에 저장됩니다
- 대화형 모드로 키와 값을 선택할 수 있습니다

## 설정

프로젝트 루트의 `.ps-cli/config.yaml` 파일에 저장됩니다.

### 주요 설정

- `general.default-language`: 기본 언어 (python, javascript, typescript, cpp)
- `general.solved-ac-handle`: Solved.ac 핸들
- `editor.command`: 에디터 명령어 (code, cursor, vim 등)
- `editor.auto-open`: fetch 후 자동으로 에디터 열기 (true/false)
- `paths.solving`: 푸는 중인 문제 디렉토리 (기본값: solving)
- `paths.archive`: 아카이브된 문제 디렉토리 (기본값: problems)
- `paths.archive-strategy`: 아카이빙 전략 (flat, by-range, by-tier, by-tag)
- `archive.auto-commit`: archive 실행 시 Git 커밋 자동 실행 여부 (true/false, 기본값: true)
- `archive.commit-message`: archive 시 사용할 Git 커밋 메시지 템플릿 (`{id}`, `{title}` 사용 가능, 기본값: `solve: {id} - {title}`)
- `markdown.include-tag`: README에 알고리즘 분류(태그) 포함 여부 (true/false, 기본값: true)

### 아카이빙 전략

문제가 많아질 때를 대비해 아카이빙 전략을 선택할 수 있습니다:

- `flat`: 평면적으로 나열 (기본값)

  ```txt
  problems/1000/
  problems/1001/
  ```

- `by-range`: 1000번대별로 묶기

  ```txt
  problems/01000/1000/
  problems/01000/1001/
  problems/02000/2000/
  ```

- `by-tier`: 티어별로 묶기

  ```txt
  problems/bronze-v/1000/
  problems/silver-i/1001/
  ```

- `by-tag`: 태그별로 묶기

  ```txt
  problems/구현/1000/
  problems/그래프-이론/1001/
  ```

**참고:** solving 디렉토리는 항상 평면적으로 나열됩니다.

## 워크플로우

1. **초기화**: `ps init`으로 프로젝트 설정
2. **가져오기**: `ps fetch 1000`으로 문제 가져오기
3. **작성**: `solving/1000/`에서 코드 작성
4. **테스트**: `ps test`로 로컬 테스트
5. **제출**: `ps submit`으로 제출
6. **아카이빙**: `ps archive`로 archive 디렉토리로 이동

## 개발

로컬에서 개발하거나 테스트할 때는 글로벌로 설치된 `ps` 명령어와 충돌을 피하기 위해 다음 방법을 사용할 수 있습니다:

### 방법 1: 절대 경로로 직접 실행 (외부 폴더 테스트 가능)

```bash
# 빌드
bun run build

# 프로젝트 디렉토리에서 절대 경로로 실행
/path/to/ps-cli/dist/index.js init
/path/to/ps-cli/dist/index.js fetch 1000

# 또는 프로젝트 디렉토리로 이동 후
cd /path/to/ps-cli
node dist/index.js init
```

### 방법 2: npm link 사용 (주의 필요)

```bash
# 프로젝트 디렉토리에서
bun run build
bun link

# 외부 폴더에서 테스트
cd /path/to/test-project
ps init  # 로컬 버전이 사용됨

# 테스트 후 링크 해제
npm unlink -g @rhseung/ps-cli
```

**주의:** `npm link`를 사용하면 글로벌 설치된 버전이 링크된 버전으로 대체됩니다.

## 라이선스

MIT
