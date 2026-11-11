#!/usr/bin/env bash
# React 빌드 결과를 EC2 nginx 폴더로 올린다.
#   HOST=3.104.196.178 KEY=~/.ssh/fastapi-stock-key-pair.pem ./deploy-web.sh
# API 서버(fastapi-stock)는 그쪽 저장소의 GitHub Actions / deploy/deploy.sh 로 배포한다.
set -euo pipefail

HOST="${HOST:?HOST=서버IP 를 지정하세요}"
KEY="${KEY:?KEY=키파일경로 를 지정하세요}"
SSH_USER="${SSH_USER:-ubuntu}"
cd "$(dirname "$0")"

npm run build
tar -C dist -czf - . | ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$HOST" \
  'set -e; D=/var/www/fastapi-stock-react; sudo mkdir -p $D; sudo chown "$USER" $D; find $D -mindepth 1 -delete; tar -C $D -xzf -'
echo "✅ 업로드 완료: http://$HOST/"
