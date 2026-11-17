#!/bin/bash
# =============================================================================
# healthcheck.sh — CareerPipeline 서버 헬스체크 & 자동 재기동 스크립트
# 사용법: crontab에 등록하여 주기적으로 실행
#   */5 * * * * /home/ubuntu/data/CareerPipeline/healthcheck.sh >> /home/ubuntu/data/logs/healthcheck.log 2>&1
# =============================================================================

# ── 설정 ─────────────────────────────────────────────────────────────────────
APP_DIR="/home/ubuntu/data/CareerPipeline"      # 서버 실제 경로로 변경
APP_NAME="server.js"
PORT=3000
URL="http://127.0.0.1:${PORT}/health"   # 서버는 127.0.0.1에만 바인딩
LOG_FILE="/home/ubuntu/data/logs/healthcheck.log"
MAX_RETRIES=3        # 재시도 횟수
RETRY_INTERVAL=10    # 재시도 간격(초)
# ─────────────────────────────────────────────────────────────────────────────

TIMESTAMP="[$(date '+%Y-%m-%d %H:%M:%S')]"

# 로그 디렉토리 자동 생성
mkdir -p "$(dirname "$LOG_FILE")"

# ── 헬스체크 함수 ─────────────────────────────────────────────────────────────
check_health() {
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null)
  echo "$HTTP_CODE"
}

# ── 서버 재기동 함수 ──────────────────────────────────────────────────────────
restart_server() {
  echo "$TIMESTAMP ⚡ 서버 재기동 시작..."

  # 기존 프로세스 종료
  PID=$(pgrep -f "$APP_NAME")
  if [ -n "$PID" ]; then
    echo "$TIMESTAMP 🔴 기존 프로세스 종료 (PID: $PID)"
    kill -15 "$PID"
    sleep 3
    # 강제 종료 (아직 살아있으면)
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID"
      echo "$TIMESTAMP 🔴 강제 종료 완료"
    fi
  else
    echo "$TIMESTAMP ⚠️  실행 중인 프로세스를 찾지 못했습니다 (이미 죽어있음)"
  fi

  # 서버 재시작
  cd "$APP_DIR" || { echo "$TIMESTAMP ❌ 디렉토리 이동 실패: $APP_DIR"; exit 1; }
  nohup node "$APP_NAME" >> /home/ubuntu/data/logs/server.log 2>&1 &
  NEW_PID=$!
  echo "$TIMESTAMP 🟢 서버 재시작 완료 (새 PID: $NEW_PID)"

  # 재시작 후 5초 대기 후 최종 확인
  sleep 5
  VERIFY_CODE=$(check_health)
  if [ "$VERIFY_CODE" = "200" ]; then
    echo "$TIMESTAMP ✅ 재기동 성공 — 서버 응답 정상 (HTTP $VERIFY_CODE)"
  else
    echo "$TIMESTAMP ❌ 재기동 후에도 응답 이상 (HTTP $VERIFY_CODE) — 수동 점검 필요"
  fi
}

# ── 메인 로직 ─────────────────────────────────────────────────────────────────
echo "$TIMESTAMP ── 헬스체크 시작 ──────────────────────"

FAIL_COUNT=0

for i in $(seq 1 $MAX_RETRIES); do
  CODE=$(check_health)

  if [ "$CODE" = "200" ]; then
    echo "$TIMESTAMP ✅ 서버 정상 (HTTP $CODE)"
    exit 0
  fi

  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "$TIMESTAMP ⚠️  응답 이상 (HTTP $CODE) — 시도 $i/$MAX_RETRIES"

  if [ "$i" -lt "$MAX_RETRIES" ]; then
    echo "$TIMESTAMP    ${RETRY_INTERVAL}초 후 재시도..."
    sleep $RETRY_INTERVAL
  fi
done

# 모든 재시도 실패 시 재기동
echo "$TIMESTAMP ❌ ${MAX_RETRIES}회 연속 실패 → 자동 재기동 실행"
restart_server
echo "$TIMESTAMP ── 헬스체크 종료 ──────────────────────"

