"""The shipped room recipes are valid, placeholder-only templates."""
from pathlib import Path

import pytest
import yaml

from personal_world.worlds.models import Provider

RECIPES = Path(__file__).resolve().parents[2] / "config" / "recipes"


@pytest.mark.parametrize("name", ["candy", "project-home"])
def test_recipe_provider_validates_and_holds_only_placeholders(name):
    doc = yaml.safe_load((RECIPES / name / "recipe.yaml").read_text())
    p = Provider(**doc["provider"])
    assert p.kind == "room0" and p.auth.secret_ref.startswith("env:")
    assert p.base_url.endswith(".example.test") and p.public_url.endswith(".example.test") and p.principal_id == "your-person-id"
    text = (RECIPES / name / "recipe.yaml").read_text()
    for secretish in ("Bearer ", "password", "api_key"):
        assert secretish not in text


def test_the_two_recipes_state_their_governance():
    c = Provider(**yaml.safe_load((RECIPES / "candy" / "recipe.yaml").read_text())["provider"])
    ph = Provider(**yaml.safe_load((RECIPES / "project-home" / "recipe.yaml").read_text())["provider"])
    assert c.governed_by_project_home() is False and c.group == "life"
    assert ph.governed_by_project_home() is True and ph.group == "machine"
