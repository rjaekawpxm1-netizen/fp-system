# 서버 백그라운드 작업 배포 및 종단 검증

## 적용 순서

1. Supabase SQL Editor에서 `202609230001_generation_jobs.sql`을 적용한다.
2. Vault에 `app_base_url`, `job_worker_secret`을 등록한다.
3. `202609230002_generation_jobs_watchdog.sql`을 적용한다.
4. Vercel과 로컬 `.env`에 아래 환경변수를 설정한다.

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=<Anthropic key>
API_DAILY_QUOTA=200
JOB_WORKER_SECRET=<충분히 긴 임의 문자열>
APP_BASE_URL=https://fp-system.vercel.app
```

서비스 롤 키와 worker secret에는 `REACT_APP_` 접두사를 붙이지 않는다. 로컬에서는
`APP_BASE_URL=http://localhost:3000`을 사용한다.

Vercel 대시보드의 Settings → Functions에서 Fluid Compute 활성화 여부와 실제
`maxDuration`을 확인한다. 현재 `api/jobs.js`는 보수적으로 60초를 지정한다.

## 종단 검증

1. 기능 생성을 시작하고 탭을 닫는다. 3분 후 다시 열어 진행률 또는 도메인 확인 화면이 복원되는지 확인한다.
2. 도메인을 확인한 뒤 다른 탭으로 이동한다. 돌아왔을 때 작업이 완료되거나 진행률이 이어지는지 확인한다.
3. FP 산정을 시작하고 창을 닫는다. 다시 열어 완료된 FP표가 조회되는지 확인한다.
4. `generation_jobs`에서 각 작업의 `step`, `state.results`, `updated_at`이 스텝마다 갱신되는지 확인한다.
5. Vercel 로그에서 `/api/jobs?action=tick` 호출이 한 번에 AI 호출 하나만 수행하는지 확인한다.
6. `cron.job_run_details`와 `net._http_response`에서 watchdog 호출 성공 여부를 확인한다.

마이그레이션과 환경변수가 적용되지 않은 로컬 코드 검증만으로는 실제 탭 종료 후 체인 지속 여부를 확인할 수 없다.
