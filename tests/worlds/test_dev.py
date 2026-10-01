import pytest

from personal_world.worlds.dev import assert_loopback


def test_dev_server_refuses_non_loopback():
    assert_loopback("127.0.0.1")
    assert_loopback("::1")
    for host in ("0.0.0.0", "192.168.1.5", "example.com", ""):
        with pytest.raises(SystemExit):
            assert_loopback(host)
