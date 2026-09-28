SHELL := /bin/bash

.PHONY: doctor gate-% gate-upto gate-all api-test web-test web-build web-types web-e2e up down db-wait

doctor:
	bash scripts/doctor.sh

gate-%:
	bash scripts/gate.sh $*

gate-upto:
	@if [ -z "$(N)" ]; then echo "usage: make gate-upto N=3" >&2; exit 2; fi
	@ok=0; \
	for i in $$(seq 0 $(N)); do \
	  echo "===== gate-$$i ====="; \
	  bash scripts/gate.sh "$$i" || { ok=1; break; }; \
	done; \
	exit $$ok

gate-all:
	@ok=0; \
	for i in $$(seq 0 8); do \
	  echo "===== gate-$$i ====="; \
	  bash scripts/gate.sh "$$i" || { ok=1; break; }; \
	done; \
	exit $$ok

api-test:
	@if [ -f api/pyproject.toml ]; then cd api && pytest; \
	else echo "api/ is empty — API tests arrive in Phase 2 (gate-2)"; fi

web-test:
	@if [ -f web/package.json ]; then cd web && npm run test -- run; \
	else echo "web/ is empty — web tests arrive in Phase 4 (gate-4)"; fi

web-build:
	@if [ -f web/package.json ]; then cd web && npm run build; \
	else echo "web/ is empty — web build arrives in Phase 4 (gate-4)"; fi

web-types:
	@if [ -f web/package.json ]; then cd web && npm run types; \
	else echo "web/ is empty — web types arrive in Phase 4 (gate-4)"; fi

web-e2e:
	@if [ -f web/package.json ]; then cd web && npx playwright test; \
	else echo "web/ is empty — web e2e arrives in Phase 4 (gate-4)"; fi

up:
	docker compose up -d db

down:
	docker compose down

db-wait:
	bash scripts/wait_db.sh 60
