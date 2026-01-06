# ps-cli

백준(BOJ) 문제 해결을 위한 통합 CLI 도구입니다. Ink 기반의 인터랙티브 터미널 UI로 문제 가져오기, 로컬 테스트, 제출까지 지원하는 개발 환경을 제공합니다.

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

### `help` - 도움말 표시

도움말을 표시합니다.

```bash
ps help
ps --help
```

## 기술 스택

- **Ink**: React 기반 터미널 UI
- **TypeScript**: 타입 안전성
- **Meow**: CLI 인자 파싱
- **Execa**: 프로세스 실행
- **Cheerio**: HTML 파싱
- **tsup**: 빌드 도구

## 개발 상태

🚧 개발 중
