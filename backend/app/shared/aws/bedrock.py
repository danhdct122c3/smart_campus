"""Amazon Bedrock client wrapper – invoke Claude for AI Assistant (WF6)."""

import json
import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=settings.aws_region)


class BedrockError(Exception):
    """Raised when a Bedrock invocation fails."""


def invoke_claude(
    prompt: str,
    system_prompt: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.0,
    model_id: str | None = None,
) -> str:
    """
    Invoke Claude via Amazon Bedrock and return the text response.

    Args:
        prompt: The user message / question.
        system_prompt: Optional system-level instruction for Claude.
        max_tokens: Maximum tokens in the response.
        temperature: 0.0 = deterministic (best for SQL generation).
        model_id: Override the model from settings.

    Returns:
        The text content of Claude's response.

    Raises:
        BedrockError on API failure.
    """
    client = get_bedrock_client()
    model = model_id or settings.bedrock_model_id

    messages = [{"role": "user", "content": prompt}]

    body: dict = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }
    if system_prompt:
        body["system"] = system_prompt

    try:
        response = client.invoke_model(
            modelId=model,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
    except ClientError as exc:
        raise BedrockError(f"Bedrock invocation failed: {exc}") from exc

    result = json.loads(response["body"].read())
    content = result.get("content", [])
    if not content:
        raise BedrockError("Bedrock returned empty content.")

    return content[0].get("text", "")
