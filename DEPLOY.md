# JLPT 학습기록 기능 배포

대상 저장소는 https://github.com/kimjs37/jlpt-study 입니다. GitHub에 푸시하고 Pages 설정을 변경할 수 있는 계정과 Cloudflare 계정이 필요합니다. 사이트 방문에는 ChatGPT 또는 GitHub 로그인 없이 유저명을 입력하면 됩니다. 유저명 자체는 인증 수단이 아니므로 같은 이름을 아는 사람은 같은 기록을 조회하고 수정할 수 있습니다.

## 1. API와 DB 배포

1. 저장소의 `main`에서 `dev`를 생성합니다. 기존 `dev`가 있으면 해당 브랜치로 전환합니다.
2. ZIP 안의 `index.html`, `api/`, `.github/workflows/pages.yml`을 저장소의 같은 경로에 복사합니다.
3. Node.js가 설치된 터미널에서 아래를 실행합니다.

```bash
cd api
npx wrangler login
npx wrangler d1 create jlpt-study-progress
```

4. 출력된 데이터베이스 ID를 `api/wrangler.toml`의 `database_id`에 입력합니다. 동일한 이름의 DB가 이미 있으면 새로 만들기 전에 해당 DB의 용도를 확인합니다.
5. `api/`에서 마이그레이션을 적용하고 Worker를 배포합니다.

```bash
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

6. `index.html`의 `jlpt-api-url` 메타 태그에 배포된 Worker 주소와 `/api/progress`를 입력합니다. 예시는 `https://jlpt-study-progress.example.workers.dev/api/progress`입니다.

## 2. GitHub Pages 배포

1. 저장소 **Settings → Pages → Source**에서 **GitHub Actions**를 선택합니다.
2. **Settings → Environments → github-pages**에서 배포 브랜치가 제한되어 있으면 기존 규칙에 `dev`를 추가합니다.
3. 변경 파일을 `dev`에 커밋하고 푸시합니다. **Actions → Deploy production and dev to GitHub Pages**가 성공하면 다음 주소를 확인합니다.

| 주소 | 화면 |
| --- | --- |
| https://kimjs37.github.io/jlpt-study/ | `main`의 현재 화면 |
| https://kimjs37.github.io/jlpt-study/dev/ | `dev`의 학습기록 연동 화면 |

워크플로를 `main`에도 배치하면 이후 `main` 푸시에도 두 경로가 다시 배포됩니다.

## 3. 동작 확인

`/dev/`에서 유저명으로 기록을 불러온 뒤 문제를 하나 풀고 다음 문제로 이동합니다. 다른 브라우저에서 동일한 유저명을 입력해 통계, 오답 노트, 문제 위치를 확인합니다. 기존 화면과 개발 화면이 같은 GitHub Pages 도메인에 있으므로 같은 브라우저의 기존 기록은 새 유저명에서 **이전 브라우저 기록 가져오기**로 옮길 수 있습니다.
