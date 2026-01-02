# ps-cli

백준(BOJ) 문제 해결을 위한 통합 CLI 도구입니다. Ink 기반의 인터랙티브 터미널 UI로 문제 가져오기, 로컬 테스트, 제출까지 지원하는 개발 환경을 제공합니다.

## 주요 기능

- **문제 가져오기**: Solved.ac API와 BOJ 크롤링을 통한 문제 정보 및 예제 데이터 자동 생성
- **로컬 테스트**: 여러 언어(JS/TS, Python, C++) 지원 및 자동 테스트 실행
- **제출**: BOJ 자동 제출 및 결과 확인
- **통계**: Solved.ac API를 활용한 사용자 통계 조회
- **Watch 모드**: 파일 저장 시 자동 테스트 실행

## 명령어

```bash
ps fetch <문제번호>    # 문제 가져오기
ps test                # 로컬 테스트 실행
ps run                  # 코드 실행 (단일 입력)
ps submit               # BOJ 제출
ps stats                # 통계 보기
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
