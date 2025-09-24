# from repo root (/opt/wmx)
docker compose -f infra/docker/docker-compose.yml build api
docker compose -f infra/docker/docker-compose.yml up -d api
docker compose -f infra/docker/docker-compose.yml logs -f api | sed -n '1,120p'
