"""A feed is somebody else's text: only a web address becomes a link."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.providers.native_discovery import (  # noqa: E402
    ContentItem,
    DiscoverySource,
    NativeDiscovery,
    web_link_or_none,
)


@pytest.mark.parametrize(
    "value",
    [
        "javascript:alert(1)",
        " JaVaScRiPt:alert(1)",
        "data:text/html,x",
        "file:///etc/hosts",
        "vbscript:x",
        "//example.invalid/x",
        "/relative",
        "http://",
        "",
        None,
        42,
    ],
)
def test_non_web_values_are_dropped(value):
    assert web_link_or_none(value) is None


@pytest.mark.parametrize(
    "value", ["https://example.invalid/a", "http://example.invalid/a?b=1#c"]
)
def test_web_addresses_are_kept(value):
    assert web_link_or_none(value) == value


def test_content_item_never_carries_a_script_link():
    item = ContentItem(
        id="x", title="t", source="s", content_type="article", url="javascript:alert(1)"
    )
    assert item.url is None
    assert item.to_dict()["url"] is None


def test_feed_link_with_a_script_scheme_comes_out_inert(tmp_path, monkeypatch):
    feed = (
        b"<rss><channel>"
        b"<item><title>ok</title><link>https://example.invalid/a</link></item>"
        b"<item><title>bad</title><link>javascript:alert(1)</link></item>"
        b"</channel></rss>"
    )

    class _Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return feed

    import urllib.request

    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: _Resp())
    d = NativeDiscovery(config_path=tmp_path / "discovery.json")
    source = DiscoverySource(
        id="f", name="Feed", source_type="rss", config={"url": "https://example.invalid/feed"}
    )
    items = d._discover_rss(source)
    assert [i.title for i in items] == ["ok", "bad"]
    assert [i.url for i in items] == ["https://example.invalid/a", None]
