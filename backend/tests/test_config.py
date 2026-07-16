import importlib

import pytest

from app import config as config_module


@pytest.fixture
def reload_config(monkeypatch):
    """Reload app.config with a controlled environment.

    load_dotenv is neutralised so the repo's .env / .env.dev (which set
    REDIS_URL) cannot leak into the test and mask the fallback branch.
    """
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)

    def _reload():
        return importlib.reload(config_module)

    yield _reload
    importlib.reload(config_module)


def test_session_uses_redis_when_url_set(reload_config, monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    cfg = reload_config()

    assert cfg.Config.SESSION_TYPE == "redis"
    assert cfg.Config.SESSION_REDIS is not None


def test_session_falls_back_to_filesystem_without_url(reload_config, monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cfg = reload_config()

    assert cfg.Config.SESSION_TYPE == "filesystem"
    assert not hasattr(cfg.Config, "SESSION_REDIS")
