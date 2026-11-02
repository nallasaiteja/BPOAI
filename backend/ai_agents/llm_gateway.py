import os
import time
import json
import logging
from typing import Dict, Any
from django.conf import settings
from core.models import AIUsageLog

logger = logging.getLogger(__name__)

class LLMGateway:
    """
    Central gateway for interacting with Google Gemini AI models.
    Handles prompt execution, token accounting, cost tracking, and structured JSON output parsing.
    """

    @classmethod
    def call_llm(cls, agent_name: str, system_prompt: str, user_prompt: str, response_format_json: bool = True) -> Dict[str, Any]:
        api_key = (
            os.getenv('GEMINI_API_KEY') or 
            os.getenv('GOOGLE_API_KEY') or 
            getattr(settings, 'GEMINI_API_KEY', '')
        ).strip()
        model = os.getenv('GEMINI_MODEL', getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')).strip()
        start_time = time.time()

        if api_key and not api_key.startswith('your-'):
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=api_key)
                config = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.2,
                )
                if response_format_json:
                    config.response_mime_type = "application/json"

                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config
                )
                duration_ms = int((time.time() - start_time) * 1000)
                raw_content = response.text or "{}"

                usage = getattr(response, 'usage_metadata', None)
                prompt_tokens = getattr(usage, 'prompt_token_count', 0) if usage else 0
                completion_tokens = getattr(usage, 'candidates_token_count', 0) if usage else 0
                total_tokens = getattr(usage, 'total_token_count', 0) if usage else (prompt_tokens + completion_tokens)

                # Gemini 2.0 Flash pricing: ~$0.075 per 1M input, $0.30 per 1M output (or free tier)
                cost = (prompt_tokens * 0.000000075) + (completion_tokens * 0.00000030)

                AIUsageLog.objects.create(
                    agent_name=agent_name,
                    provider='gemini',
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    cost_usd=cost,
                    execution_time_ms=duration_ms,
                    success=True
                )

                if response_format_json:
                    clean_text = raw_content.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.startswith("```"):
                        clean_text = clean_text[3:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    return json.loads(clean_text.strip())
                return {"text": raw_content}

            except Exception as e:
                logger.error(f"Gemini API call failed for {agent_name}: {e}. Falling back to rule-based engine.")
                AIUsageLog.objects.create(
                    agent_name=agent_name,
                    provider='gemini',
                    model=model,
                    cost_usd=0,
                    execution_time_ms=int((time.time() - start_time) * 1000),
                    success=False,
                    error_message=str(e)
                )

        # Fallback deterministic reasoning when Gemini API key is missing or offline
        return cls._generate_deterministic_fallback(agent_name, user_prompt)

    @classmethod
    def _generate_deterministic_fallback(cls, agent_name: str, user_prompt: str) -> Dict[str, Any]:
        """
        Guarantees that the BPO pipeline executes reliably even in sandbox or offline environments.
        """
        return {"status": "fallback_triggered", "agent": agent_name}
