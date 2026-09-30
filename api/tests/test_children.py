"""P2.4 — children CRUD, settings deep-merge + config_version, contract parity, tenant isolation."""
import json
import pathlib

import pytest

from api.app.schemas.child_settings import ChildSettings
from api.app.services.settings import apply_settings_patch, default_settings

REQ = {"X-Requested-With": "senseheaven"}

CONTRACT = json.loads((pathlib.Path(__file__).resolve().parents[2] / "contracts" / "settings_schema.json").read_text())


def make_child(parent_client, name="Aarav") -> dict:
    response = parent_client.post("/api/v1/children", json={"name": name}, headers=REQ)
    assert response.status_code == 201
    return response.json()


def test_create_child_defaults_match_contract(parent_client):
    child = make_child(parent_client)
    contract_defaults = {k: v["default"] for k, v in CONTRACT["properties"].items()}
    assert child["settings"] == contract_defaults


def test_list_and_get_child(parent_client):
    child = make_child(parent_client)
    listed = parent_client.get("/api/v1/children").json()
    assert [c["name"] for c in listed] == ["Aarav"]
    fetched = parent_client.get(f"/api/v1/children/{child['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["avatar_key"] == "orb-1"


def test_get_unknown_child_404(parent_client):
    import uuid

    response = parent_client.get(f"/api/v1/children/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_cross_tenant_child_is_404_not_403(parent_client, other_client):
    child = make_child(parent_client)
    response = other_client.get(f"/api/v1/children/{child['id']}")
    assert response.status_code == 404


def test_patch_child_fields(parent_client):
    child = make_child(parent_client)
    response = parent_client.patch(
        f"/api/v1/children/{child['id']}", json={"name": "Ira", "birth_year": 2019, "avatar_key": "orb-3"},
        headers=REQ,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Ira"
    assert response.json()["birth_year"] == 2019


def test_settings_patch_bumps_config_version_once_per_patch(parent_client):
    child = make_child(parent_client)
    first = parent_client.patch(f"/api/v1/children/{child['id']}/settings", json={"calm_threshold": 80}, headers=REQ)
    assert first.json()["config_version"] == 2
    second = parent_client.patch(f"/api/v1/children/{child['id']}/settings", json={"stress_threshold": 30}, headers=REQ)
    assert second.json()["config_version"] == 3
    assert second.json()["calm_threshold"] == 80  # deep merge keeps prior changes


def test_settings_patch_cross_field_rejected(parent_client):
    child = make_child(parent_client)
    response = parent_client.patch(
        f"/api/v1/children/{child['id']}/settings",
        json={"stress_threshold": 35, "calm_threshold": 40},
        headers=REQ,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_settings_patch_out_of_range_rejected(parent_client):
    child = make_child(parent_client)
    response = parent_client.patch(
        f"/api/v1/children/{child['id']}/settings", json={"good_bonus_min": 0}, headers=REQ
    )
    assert response.status_code == 422


def test_settings_patch_unknown_key_rejected(parent_client):
    child = make_child(parent_client)
    response = parent_client.patch(
        f"/api/v1/children/{child['id']}/settings", json={"not_a_real_field": True}, headers=REQ
    )
    assert response.status_code == 422


def test_settings_patch_bad_package_pattern_rejected(parent_client):
    child = make_child(parent_client)
    response = parent_client.patch(
        f"/api/v1/children/{child['id']}/settings", json={"blocked_packages": ["9lives"]}, headers=REQ
    )
    assert response.status_code == 422


def test_settings_patch_lists_replace(parent_client):
    child = make_child(parent_client)
    response = parent_client.patch(
        f"/api/v1/children/{child['id']}/settings", json={"blocked_packages": ["com.youtube"]}, headers=REQ
    )
    assert response.json()["blocked_packages"] == ["com.youtube"]


def test_delete_child_soft(parent_client):
    child = make_child(parent_client)
    deleted = parent_client.delete(f"/api/v1/children/{child['id']}", headers=REQ)
    assert deleted.status_code == 204
    assert parent_client.get(f"/api/v1/children/{child['id']}").status_code == 404
    assert parent_client.get("/api/v1/children").json() == []


def test_settings_service_merge_is_pure():
    base = default_settings()
    before = dict(base)
    apply_settings_patch(base, {"cooldown_min": 8})
    assert base == before  # current dict untouched


def test_model_parity_with_contract():
    """The Pydantic twin must stay in sync with contracts/settings_schema.json."""
    model_schema = ChildSettings.model_json_schema()
    props = model_schema["properties"]
    assert set(props) == set(CONTRACT["properties"]), "field set drifted from the contract"
    effective_defaults = ChildSettings().model_dump()
    for name, contract_prop in CONTRACT["properties"].items():
        model_prop = props[name]
        assert effective_defaults[name] == contract_prop.get("default"), name
        assert model_prop.get("minimum") == contract_prop.get("minimum"), name
        assert model_prop.get("maximum") == contract_prop.get("maximum"), name
        expected_type = contract_prop["type"]
        actual = model_prop.get("type") or model_prop.get("anyOf")
        if expected_type in ("integer", "boolean"):
            assert actual == expected_type, name
        if expected_type == "array":
            assert actual == "array", name


def test_model_enforces_cross_field_rule():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ChildSettings(stress_threshold=35, calm_threshold=40)
