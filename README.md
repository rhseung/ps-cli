# ps-cli

백준 문제 해결을 위한 CLI 도구입니다.

## 설치

```bash
npm install -g @rhseung/ps-cli
# 또는
bun install -g @rhseung/ps-cli
```

## 빠른 시작

```bash
# 1. 프로젝트 초기화
ps init

# 2. 문제 가져오기
ps fetch 1000

# 3. 코드 작성 후 테스트
ps test

# 4. 제출
ps submit
```

## 명령어

### `init` - 프로젝트 초기화

프로젝트를 초기화하고 설정을 구성합니다.

```bash
ps init
```

### `fetch` - 문제 가져오기

백준 문제를 가져와서 로컬에 파일을 생성합니다.

```bash
ps fetch 1000
ps fetch 1000 --language python
```

### `test` - 로컬 테스트

예제 입출력으로 테스트를 실행합니다.

```bash
ps test
ps test 1000
ps test --watch  # 파일 변경 시 자동 재테스트
```

### `run` - 코드 실행

테스트 없이 코드를 실행합니다.

```bash
ps run
ps run 1000
```

### `submit` - 제출

백준 제출 페이지를 열고 소스 코드를 클립보드에 복사합니다.

```bash
ps submit
ps submit 1000
```

### `solve` - 아카이빙

solving 디렉토리의 문제를 problem 디렉토리로 이동하고 Git 커밋을 생성합니다.

```bash
ps solve 1000
```

### `open` - 문제 페이지 열기

백준 문제 페이지를 브라우저로 엽니다.

```bash
ps open 1000
```

### `search` - 문제 검색

solved.ac에서 문제를 검색합니다.

```bash
ps search "*g1...g5"
ps search --workbook 12345
```

### `stats` - 통계 조회

Solved.ac 사용자 통계를 조회합니다.

```bash
ps stats
ps stats myhandle
```

### `config` - 설정 관리

프로젝트 설정을 관리합니다.

```bash
ps config list
ps config set default-language python
ps config get archive-strategy
```

## 설정

프로젝트 루트의 `.ps-cli.json` 파일에 저장됩니다.

### 주요 설정

- `default-language`: 기본 언어 (python, javascript, typescript, cpp)
- `editor`: 에디터 명령어 (code, cursor, vim 등)
- `auto-open-editor`: fetch 후 자동으로 에디터 열기 (true/false)
- `solved-ac-handle`: Solved.ac 핸들
- `problem-dir`: 아카이브된 문제 디렉토리 (기본값: problems)
- `solving-dir`: 푸는 중인 문제 디렉토리 (기본값: solving)
- `archive-strategy`: 아카이빙 전략

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
6. **아카이빙**: `ps solve`로 problem 디렉토리로 이동

## 라이선스

MIT
