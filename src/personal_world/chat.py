"""Chat capability: provider-neutral local-AI conversation.

Architecture target (docs/DESIGN-HANDOFF.md, ROADMAP "Now"):
Personal World UI -> Chat API -> small context builder ->
provider-neutral ChatContract -> local model endpoint.

The local AI is optional and replaceable. With no provider configured
the capability reports ``not_configured`` and the core still boots;
the dashboard degrades to an honest "AI not connected" state rather
than a fake conversation.

Adapters in this module never log or persist secret material; keys
arrive through env indirection (the framework's secret rule). Chat
context is built from safe read APIs only -- the chat path can observe
the world but never mutates privileged state.

One merged adapter surface (A5): this module is the single home for all
providers and the chat helpers. `chat.py` (context/prompt helpers,
Ollama, OpenAI-compat) and `chat_registry.py` (Ollama/OpenAI-compat/
OpenAI/Anthropic/OpenCode + registry) were merged here; the duplicate
module was retired.

Supports:
  - Ollama (local, any model)
  - OpenAI-compatible (llama.cpp, vLLM, LiteLLM, OpenWebUI)
  - OpenAI direct (GPT-4, GPT-4o, etc.)
  - Anthropic Claude (via messages API)
  - OpenCode Go CLI
  - Any future provider that speaks OpenAI-style chat

Providers are configured in connections.json under the "reasoning"
capability. The active provider can be switched at runtime via the
API. Preferences persist per-user.
"""

import json
import os
import subprocess
import urllib.request
from typing import Any

from .envelope import Result, fail, ok

CHAT_TIMEOUT_SECONDS = 120
"""Local models on modest hardware can take a while; cold start of a
quantized 8B model is commonly tens of seconds. Generous but bounded."""

MAX_CONTEXT_CHARS = 8000
"""Upper bound on the injected world-context block so a bloated world
state cannot silently exceed a small local model's context window."""


class ChatContract:
    """Provider-neutral conversation contract.

    Implementations accept an OpenAI-style message list
    (``[{"role": ..., "content": ...}]``) and return a Result whose
    data carries ``reply`` plus provider-specific diagnostics.
    """

    def health(self) -> Result:
        """Cheap reachability probe. Contract seam used by
        registry health_check lambdas; default to observe()."""
        return self.observe()

    def chat(self, messages: list[dict[str, str]]) -> Result:
        raise NotImplementedError

    def observe(self) -> Result:
        raise NotImplementedError


class OllamaChat(ChatContract):
    """Chat over Ollama's native /api/chat (OpenAI-style messages in).

    Thinking-model diagnostics (qwen3 et al.) are returned separately
    in ``thinking`` and never concatenated into the visible reply.
    """

    def __init__(self, base_url: str, model: str, timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.display_name = f"Ollama ({model})"

    def observe(self) -> Result:
        try:
            with urllib.request.urlopen(
                f"{self.base_url}/api/tags", timeout=5
            ) as resp:
                payload = json.loads(resp.read().decode())
            models = [m.get("name", "") for m in payload.get("models", [])]
            present = any(m == self.model or m.split(":")[0] == self.model
                          for m in models)
            if not present:
                return fail(
                    "unhealthy",
                    data={"base_url": self.base_url, "model": self.model},
                    warnings=[f"model '{self.model}' not in local library"],
                )
            return ok("healthy", data={
                "base_url": self.base_url,
                "model": self.model,
                "models": models,
            })
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"ollama: {e}"],
            )

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({
            "model": self.model,
            "messages": messages,
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"ollama chat: {e}"],
            )
        message = payload.get("message") or {}
        content = (message.get("content") or "").strip()
        if not content:
            return Result(
                ok=False,
                status="unavailable",
                warnings=["ollama returned an empty reply"],
            )
        return ok("healthy", data={
            "reply": content,
            "thinking": message.get("thinking"),
            "model": payload.get("model", self.model),
            "eval_count": payload.get("eval_count"),
            "prompt_eval_count": payload.get("prompt_eval_count"),
        })

    def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> Result:
        """Chat with optional tool-calling support.

        Returns either:
        - data.reply (final text response)
        - data.tool_calls (list of tool calls the model wants to make)
        """
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if tools:
            body["tools"] = tools
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"ollama chat: {e}"],
            )
        message = payload.get("message") or {}

        # Check for tool calls
        tool_calls = message.get("tool_calls")
        if tool_calls and isinstance(tool_calls, list) and len(tool_calls) > 0:
            return ok("healthy", data={
                "tool_calls": tool_calls,
                "model": payload.get("model", self.model),
            })

        # Plain text response
        content = (message.get("content") or "").strip()
        if not content:
            return Result(
                ok=False,
                status="unavailable",
                warnings=["ollama returned an empty reply"],
            )
        return ok("healthy", data={
            "reply": content,
            "thinking": message.get("thinking"),
            "model": payload.get("model", self.model),
        })


class OpenAICompatChat(ChatContract):
    """Chat over any OpenAI-compatible /v1/chat/completions endpoint
    (llama.cpp server, LiteLLM, vLLM, OpenWebUI's API bridge)."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key_env: str | None = None,
        timeout: int = CHAT_TIMEOUT_SECONDS,
        display_name: str | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout
        self.display_name = display_name or f"OpenAI-compat ({model})"

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key_env and os.environ.get(self.api_key_env):
            h["Authorization"] = f"Bearer {os.environ[self.api_key_env]}"
        return h

    @staticmethod
    def _chat_url(base_url: str) -> str:
        base = base_url.rstrip("/")
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"

    def observe(self) -> Result:
        try:
            base = self.base_url.rstrip("/")
            if base.endswith("/v1"):
                url = f"{base}/models"
            else:
                url = f"{base}/v1/models"
            req = urllib.request.Request(url, headers=self._headers())
            with urllib.request.urlopen(req, timeout=5) as resp:
                payload = json.loads(resp.read().decode())
            ids = [m.get("id", "") for m in payload.get("data", [])]
            present = self.model in ids if ids else True
            if not present:
                return fail(
                    "unhealthy",
                    data={"base_url": self.base_url, "model": self.model},
                    warnings=[f"model '{self.model}' not offered by endpoint"],
                )
            return ok("healthy", data={
                "base_url": self.base_url,
                "model": self.model,
                "models": ids,
            })
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"openai-compat: {e}"],
            )

    def _post(self, body: dict[str, Any]) -> Result:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            self._chat_url(self.base_url),
            data=data,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"openai-compat chat: {e}"],
            )

    def chat(self, messages: list[dict[str, str]]) -> Result:
        payload = self._post({
            "model": self.model,
            "messages": messages,
            "stream": False,
        })
        if isinstance(payload, Result):
            return payload
        choices = payload.get("choices") or []
        content = ""
        if choices:
            content = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return Result(
                ok=False,
                status="unavailable",
                warnings=["endpoint returned an empty reply"],
            )
        return ok("healthy", data={
            "reply": content,
            "thinking": None,
            "model": payload.get("model", self.model),
            "eval_count": payload.get("usage", {}).get("completion_tokens"),
            "prompt_eval_count": payload.get("usage", {}).get("prompt_tokens"),
        })

    def chat_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> Result:
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if tools:
            body["tools"] = tools
        payload = self._post(body)
        if isinstance(payload, Result):
            return payload
        choices = payload.get("choices") or []
        if not choices:
            return Result(ok=False, status="unavailable", warnings=["no choices returned"])
        message = choices[0].get("message") or {}
        tool_calls = message.get("tool_calls")
        if tool_calls and isinstance(tool_calls, list) and len(tool_calls) > 0:
            return ok("healthy", data={
                "tool_calls": tool_calls,
                "model": payload.get("model", self.model),
            })
        content = (message.get("content") or "").strip()
        if not content:
            return Result(ok=False, status="unavailable", warnings=["empty reply"])
        return ok("healthy", data={
            "reply": content,
            "model": payload.get("model", self.model),
        })


class OpenAIChat(ChatContract):
    """Chat with OpenAI's API directly (GPT-4, GPT-4o, etc.)."""

    def __init__(self, model: str, api_key_env: str = "OPENAI_API_KEY",
                 timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout
        self.display_name = f"OpenAI ({model})"

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        key = os.environ.get(self.api_key_env)
        if key:
            h["Authorization"] = f"Bearer {key}"
        return h

    def observe(self) -> Result:
        key = os.environ.get(self.api_key_env)
        if not key:
            return fail("unavailable", warnings=[f"{self.api_key_env} not set"])
        try:
            req = urllib.request.Request("https://api.openai.com/v1/models", headers=self._headers())
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode())
            ids = [m.get("id", "") for m in payload.get("data", [])]
            present = any(self.model in m for m in ids)
            if not present:
                return fail("unhealthy", warnings=[f"model '{self.model}' not available"])
            return ok("healthy", data={"model": self.model, "available_models": len(ids)})
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai: {e}"])

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({"model": self.model, "messages": messages, "stream": False}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
                                     headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai chat: {e}"])
        choices = payload.get("choices") or []
        content = ""
        if choices:
            content = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return Result(ok=False, status="unavailable", warnings=["openai returned an empty reply"])
        return ok("healthy", data={"reply": content, "thinking": None,
                                    "model": payload.get("model", self.model)})

    def chat_with_tools(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> Result:
        body: dict[str, Any] = {"model": self.model, "messages": messages, "stream": False}
        if tools:
            body["tools"] = tools
        data = json.dumps(body).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=data, headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai: {e}"])
        choices = payload.get("choices") or []
        if not choices:
            return Result(ok=False, status="unavailable", warnings=["no choices"])
        message = choices[0].get("message") or {}
        tool_calls = message.get("tool_calls")
        if tool_calls and isinstance(tool_calls, list) and len(tool_calls) > 0:
            return ok("healthy", data={"tool_calls": tool_calls, "model": payload.get("model", self.model)})
        content = (message.get("content") or "").strip()
        if not content:
            return Result(ok=False, status="unavailable", warnings=["empty reply"])
        return ok("healthy", data={"reply": content, "model": payload.get("model", self.model)})


class AnthropicChat(ChatContract):
    """Chat with Anthropic's Claude API."""

    def __init__(self, model: str, api_key_env: str = "ANTHROPIC_API_KEY",
                 timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout
        self.display_name = f"Claude ({model})"

    def _headers(self) -> dict:
        h = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }
        key = os.environ.get(self.api_key_env)
        if key:
            h["x-api-key"] = key
        return h

    def observe(self) -> Result:
        key = os.environ.get(self.api_key_env)
        if not key:
            return fail("unavailable", warnings=[f"{self.api_key_env} not set"])
        return ok("healthy", data={"model": self.model, "provider": "anthropic"})

    def chat(self, messages: list[dict[str, str]]) -> Result:
        # Anthropic uses a different message format
        system = ""
        claude_messages = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                claude_messages.append({"role": m["role"], "content": m["content"]})

        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 2048,
            "messages": claude_messages,
        }
        if system:
            body["system"] = system

        data = json.dumps(body).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=data,
                                     headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"claude chat: {e}"])

        content_blocks = payload.get("content", [])
        text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
        reply = "\n".join(text_parts).strip()
        if not reply:
            return Result(ok=False, status="unavailable", warnings=["claude returned an empty reply"])
        return ok("healthy", data={"reply": reply, "thinking": None,
                                    "model": payload.get("model", self.model)})

    def chat_with_tools(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None) -> Result:
        system = ""
        claude_messages = []
        for m in messages:
            if m.get("role") == "system":
                system = m.get("content", "")
            elif m.get("role") == "tool":
                claude_messages.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": m.get("tool_call_id", ""), "content": m.get("content", "")}]})
            else:
                claude_messages.append({"role": m["role"], "content": m.get("content", "")})

        body: dict[str, Any] = {"model": self.model, "max_tokens": 2048, "messages": claude_messages}
        if system:
            body["system"] = system
        if tools:
            anthropic_tools = []
            for t in tools:
                func = t.get("function", {})
                anthropic_tools.append({
                    "name": func.get("name", ""),
                    "description": func.get("description", ""),
                    "input_schema": func.get("parameters", {}),
                })
            body["tools"] = anthropic_tools

        data = json.dumps(body).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=data, headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"anthropic: {e}"])

        content_blocks = payload.get("content", [])
        tool_uses = [b for b in content_blocks if b.get("type") == "tool_use"]
        if tool_uses:
            tool_calls = []
            for tu in tool_uses:
                tool_calls.append({
                    "function": {"name": tu.get("name", ""), "arguments": json.dumps(tu.get("input", {}))},
                    "id": tu.get("id", ""),
                })
            return ok("healthy", data={"tool_calls": tool_calls, "model": payload.get("model", self.model)})

        text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
        reply = "\n".join(text_parts).strip()
        if not reply:
            return Result(ok=False, status="unavailable", warnings=["empty reply"])
        return ok("healthy", data={"reply": reply, "model": payload.get("model", self.model)})


class OpenCodeChat(ChatContract):
    """Chat via OpenCode Go CLI (opencode run).

    Uses the opencode CLI to send messages to any model available
    through OpenCode Go's provider system. This is the simplest
    integration — no API server needed, just the CLI binary.
    """

    def __init__(self, model: str = "opencode-go/mimo-v2.5",
                 timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.model = model
        self.timeout = timeout
        self.display_name = f"OpenCode ({model.split('/')[-1]})"

    def observe(self) -> Result:
        try:
            proc = subprocess.run(
                ["opencode", "models"],
                capture_output=True, text=True, timeout=10,
            )
            if proc.returncode != 0:
                return fail("unavailable", warnings=["opencode CLI not working"])
            models = proc.stdout.strip().split("\n")
            present = any(self.model in m for m in models)
            if not present:
                return fail("unhealthy", warnings=[f"model '{self.model}' not found in opencode"])
            return ok("healthy", data={"model": self.model, "available": len(models)})
        except FileNotFoundError:
            return fail("unavailable", warnings=["opencode CLI not installed"])
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"opencode: {e}"])

    def chat(self, messages: list[dict[str, str]]) -> Result:
        # Build the prompt from messages
        prompt_parts = []
        for m in messages:
            if m["role"] == "system":
                prompt_parts.append(f"System: {m['content']}")
            elif m["role"] == "user":
                prompt_parts.append(m["content"])
            elif m["role"] == "assistant":
                prompt_parts.append(f"Assistant: {m['content']}")
        prompt = "\n\n".join(prompt_parts)

        try:
            proc = subprocess.run(
                ["opencode", "run", "--model", self.model, "--format", "json"],
                input=prompt,
                capture_output=True, text=True, timeout=self.timeout,
            )
        except subprocess.TimeoutExpired:
            return Result(ok=False, status="unavailable",
                          warnings=["opencode timed out"])
        except FileNotFoundError:
            return Result(ok=False, status="unavailable",
                          warnings=["opencode CLI not installed"])
        except Exception as e:
            return Result(ok=False, status="unavailable",
                          warnings=[f"opencode run failed: {e}"])

        if proc.returncode != 0:
            return Result(ok=False, status="unavailable",
                          warnings=[f"opencode exited {proc.returncode}: {proc.stderr[:200]}"])

        # Parse JSON events from stdout
        reply = ""
        thinking = None
        model_used = self.model
        for line in proc.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "text":
                text = event.get("part", {}).get("text", "")
                if text:
                    reply += text
            elif event.get("type") == "step_finish":
                tokens = event.get("part", {}).get("tokens", {})

        reply = reply.strip()
        if not reply:
            return Result(ok=False, status="unavailable",
                          warnings=["opencode returned no text"])

        return ok("healthy", data={
            "reply": reply,
            "thinking": thinking,
            "model": model_used,
        })


# --- Provider builders ---

_PROVIDER_BUILDERS: dict[str, type[ChatContract]] = {
    "ollama": OllamaChat,
    "openai_compat": OpenAICompatChat,
    "openai": OpenAIChat,
    "anthropic": AnthropicChat,
    "opencode": OpenCodeChat,
}


def build_chat_provider(connection: dict[str, Any]) -> tuple[str, ChatContract] | None:
    """Construct a chat provider from one connections.json entry.

    Returns (name, impl) or None for unknown/under-specified entries.
    Supported shapes::

        {"type": "ollama", "name": "local-qwen",
         "base_url": "http://127.0.0.1:11434", "model": "qwen3:8b"}
        {"type": "openai_compat", "name": "llamacpp",
         "base_url": "http://127.0.0.1:8080", "model": "...",
         "api_key_env": "MY_KEY_ENV"}
        {"type": "openai", "name": "gpt", "model": "gpt-4o",
         "api_key_env": "OPENAI_API_KEY"}
        {"type": "anthropic", "name": "claude", "model": "claude-sonnet",
         "api_key_env": "ANTHROPIC_API_KEY"}
        {"type": "opencode", "name": "oc", "model": "opencode-go/mimo-v2.5"}
    """
    ptype = connection.get("type")
    name = connection.get("name")
    base = connection.get("base_url")
    model = connection.get("model")

    if ptype == "ollama":
        if not base or not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        return name or "ollama", OllamaChat(base, model, timeout=timeout)

    if ptype == "openai_compat":
        if not base or not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenAICompatChat(base, model, connection.get("api_key_env"),
                                timeout=timeout, display_name=connection.get("display_name"))
        return name or "openai-compat", impl

    if ptype == "openai":
        if not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenAIChat(model, connection.get("api_key_env", "OPENAI_API_KEY"), timeout=timeout)
        return name or "openai", impl

    if ptype == "anthropic":
        if not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = AnthropicChat(model, connection.get("api_key_env", "ANTHROPIC_API_KEY"), timeout=timeout)
        return name or "anthropic", impl

    if ptype == "opencode":
        model = connection.get("model", "opencode-go/mimo-v2.5")
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenCodeChat(model, timeout=timeout)
        return name or "opencode", impl

    return None


class ChatProviderRegistry:
    """Manages multiple chat providers with runtime switching."""

    def __init__(self) -> None:
        self._providers: dict[str, ChatContract] = {}
        self._active: str | None = None

    def register(self, name: str, provider: ChatContract) -> None:
        self._providers[name] = provider
        if self._active is None:
            self._active = name

    def set_active(self, name: str) -> Result:
        if name not in self._providers:
            return fail("not_found", warnings=[f"provider '{name}' not registered"])
        self._active = name
        return ok("healthy", data={"active": name})

    def get_active(self) -> ChatContract | None:
        if self._active:
            return self._providers.get(self._active)
        return None

    def get(self, name: str) -> ChatContract | None:
        return self._providers.get(name)

    def list_providers(self) -> list[dict[str, Any]]:
        result = []
        for name, impl in self._providers.items():
            r = impl.observe()
            result.append({
                "name": name,
                "display_name": getattr(impl, "display_name", name),
                "active": name == self._active,
                "status": r.status,
                "ok": r.ok,
            })
        return result


def trim_context(context: str, limit: int = MAX_CONTEXT_CHARS) -> str:
    """Bound the world-context block. Truncation is announced in the
    block itself so the model (and the human) can see it happened."""
    if len(context) <= limit:
        return context
    kept = context[:limit]
    return kept + f"\n[…context truncated at {limit} chars…]"


def build_chat_messages(
    user_message: str,
    world_context: str,
    history: list[dict[str, str]] | None = None,
    tool_descriptions: str | None = None,
) -> list[dict[str, str]]:
    """System prompt + optional short history + the new user message.

    The system prompt establishes the Personal World persona, injects
    the trimmed world-context block, and forbids the model from
    inventing state it was not shown. History is capped to the last six
    turns to stay inside small local-model context windows.

    SUGGESTIONS, not authority: the prompt teaches ONE tiny fenced
    proposal block the assistant MAY use when it notices a Journal
    entry that may need correcting (assistant-drafted correction
    proposals). The block is a CONTRIBUTION the human reviews — it is
    never executed, and ordinary chat confirmation is never
    authorization. Everything about the block is validated after the
    round-trip; anything malformed degrades to ordinary text.
    """
    tool_block = ""
    if tool_descriptions:
        tool_block = (
            "\n\n## Available tools\n"
            "You can answer questions about the world using these capabilities. "
            "When someone asks about something covered by a tool, answer from "
            "the context block. If the context doesn't have the answer, say so.\n\n"
            f"{tool_descriptions}\n"
        )
    system = (
        "You are the Project Worlds assistant: a calm, factual companion "
        "embedded in a personal control plane. You answer questions "
        "about the state of the world using ONLY the context block below. "
        "If the context does not contain the answer, say so plainly "
        "instead of inventing status, names, or numbers. Status vocabulary "
        "is fixed: healthy, warning, unknown, needs_attention, unavailable, "
        "stale, disabled, not_configured. Keep replies short, warm, and "
        "structured; prefer lists over prose paragraphs when listing.\n\n"
        "You may notice a recent Journal entry that looks wrong compared "
        "to later entries. If — and only if — the context clearly "
        "supports it, offer to prepare a correction: explain why in one "
        "sentence in your reply, then append a proposal block in "
        "EXACTLY this shape (one line per field, no extra fields):\n"
        "```\n"
        "PW-PROPOSAL journal_correction\n"
        "entry_ts: <the entry's exact timestamp from the context>\n"
        "proposed_text: <one corrected sentence>\n"
        "reason: <short reason>\n"
        "evidence_summary: <one sentence citing which later entries "
        "support this>\n"
        "```\n"
        "The proposal is a DRAFT for review — never a change. "
        "If evidence is weak or ambiguous, phrase the suggestion "
        "accordingly or do not propose. Never invent timestamps or "
        "evidence.\n\n"
        "--- Personal World context (observed, read-only) ---\n"
        f"{trim_context(world_context)}\n"
        "--- end context ---"
        f"{tool_block}"
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    if history:
        for m in history[-6:]:
            if m.get("role") in ("user", "assistant") and m.get("content"):
                messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


#: The fenced proposal header the system prompt teaches.
PROPOSAL_HEADER = "PW-PROPOSAL journal_correction"
#: Hard caps mirroring the Journal write path (supersede: 2000/200).
PROPOSAL_TEXT_MAX = 2000
PROPOSAL_REASON_MAX = 200
PROPOSAL_EVIDENCE_MAX = 300
PROPOSAL_FIELDS = ("entry_ts", "proposed_text", "reason", "evidence_summary")


def extract_proposal(reply: str) -> tuple[str | None, str]:
    """Split a reply into (proposal dict as JSON string or None,
    visible reply text).

    Strict and fail-closed: a block is accepted ONLY when the header
    is exact and all four fields are present, non-empty, and within
    their caps — otherwise the whole block degrades to ordinary text
    (it stays visible in the reply; no proposal is surfaced). The
    returned JSON is a flat object with the validated fields.
    """
    fence_start = reply.find("```")
    while fence_start != -1:
        fence_end = reply.find("```", fence_start + 3)
        if fence_end == -1:
            break
        block = reply[fence_start + 3:fence_end].strip("\n")
        lines = [ln.rstrip() for ln in block.split("\n") if ln.strip()]
        if lines and lines[0].strip() == PROPOSAL_HEADER:
            fields: dict[str, str] = {}
            for ln in lines[1:]:
                if ":" not in ln:
                    fields = None  # type: ignore[assignment]
                    break
                key, _, value = ln.partition(":")
                key = key.strip()
                if key not in PROPOSAL_FIELDS or key in fields:
                    fields = None  # type: ignore[assignment]
                    break
                fields[key] = value.strip()
            if (
                fields
                and all(f in fields and fields[f] for f in PROPOSAL_FIELDS)
                and len(fields["proposed_text"]) <= PROPOSAL_TEXT_MAX
                and len(fields["reason"]) <= PROPOSAL_REASON_MAX
                and len(fields["evidence_summary"]) <= PROPOSAL_EVIDENCE_MAX
            ):
                proposal = {
                    "kind": "journal_correction",
                    **fields,
                }
                # The visible reply drops the machine block; the
                # suggestion sentence stays.
                visible = (
                    reply[:fence_start].rstrip()
                    + ("\n\n" if reply[fence_end + 3:].lstrip() else "")
                    + reply[fence_end + 3:].lstrip()
                ).strip()
                return json.dumps(proposal), visible
            # Malformed proposal block: degrade to ordinary text (the
            # block simply remains part of the reply; no proposal).
            return None, reply
        fence_start = reply.find("```", fence_end + 3)
    return None, reply


def chat_once(
    provider: ChatContract,
    messages: list[dict[str, str]],
) -> Result:
    """One provider round-trip with fail-closed error mapping."""
    try:
        return provider.chat(messages)
    except Exception as e:  # provider crash must never reach the API surface
        return Result(ok=False, status="unavailable",
                      warnings=[f"chat provider failed: {e}"])