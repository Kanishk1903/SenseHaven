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
	@if [ -f api/pyproject.toml ]; then cd api && .venv/bin/pytest; \
	else echo "api/ is empty — API tests arrive in Phase 2 (gate-2)"; fi

contract-export:
	cd api && PYTHONPATH=.. .venv/bin/python -W ignore -c "import json; from api.app.main import create_app; print(json.dumps(create_app().openapi(), indent=2))" > ../contracts/openapi.json
	@echo "wrote contracts/openapi.json"

ml-setup:
	cd ml && if [ ! -x .venv/bin/python ]; then python3 -m venv .venv && .venv/bin/pip install -q --upgrade pip && .venv/bin/pip install -q -r requirements.txt && .venv/bin/pip freeze > requirements.lock; else echo "ml venv exists"; fi && bash ../scripts/fetch_models.sh

ml-data:
	cd ml && .venv/bin/python -m src.fetch_data

ml-features:
	cd ml && .venv/bin/python -m src.extract_features

ml-train:
	cd ml && .venv/bin/python -m src.train

ml-eval:
	cd ml && .venv/bin/python -m src.evaluate

ml-export:
	cd ml && .venv/bin/python -m src.calibrate_index && .venv/bin/python -m src.export_json

ml-vectors:
	cd ml && .venv/bin/python -m src.make_vectors && .venv/bin/python -m src.check_vectors

ml-test:
	cd ml && .venv/bin/pytest -q

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
