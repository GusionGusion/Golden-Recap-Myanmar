# =========================================================
# Golden Recap MM - AI Gateway
# Backend/ai.py
# =========================================================

import os
import json
import time
import re
import base64

from typing import (
    Optional,
    Dict,
    Any,
    List,
)


# =========================================================
# OPTIONAL AI CLIENTS
# =========================================================

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None


try:
    from openai import OpenAI
except Exception:
    OpenAI = None


# =========================================================
# CONFIG
# =========================================================

DEFAULT_GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.8-flash",
)


DEFAULT_OPENAI_MODEL = os.getenv(
    "OPENAI_MODEL",
    "gpt-6-luna",
)


DEFAULT_OPENROUTER_MODEL = os.getenv(
    "OPENROUTER_MODEL",
    "openai/gpt-6-luna",
)


MAX_RETRIES = 3


OPENROUTER_BASE_URL = (
    "https://openrouter.ai/api/v1"
)


# =========================================================
# GOLDEN RECAP MM - AI ROUTER CONFIG
# =========================================================

AI_MODE = os.getenv(
    "AI_MODE",
    "production",
).lower().strip()


# =========================================================
# TEXT TASK CONFIG
# =========================================================

TRANSLATION_PROVIDER = os.getenv(
    "TRANSLATION_PROVIDER",
    "openrouter",
).lower().strip()


TRANSLATION_MODEL = os.getenv(
    "TRANSLATION_MODEL",
    "openai/gpt-6-luna",
)


CAPTION_PROVIDER = os.getenv(
    "CAPTION_PROVIDER",
    "openrouter",
).lower().strip()


CAPTION_MODEL = os.getenv(
    "CAPTION_MODEL",
    "openai/gpt-6-luna",
)


# =========================================================
# SCENE ANALYSIS CONFIG
# =========================================================

SCENE_PRIMARY_PROVIDER = "gemini"


SCENE_PRIMARY_MODEL = DEFAULT_GEMINI_MODEL


SCENE_FALLBACK_PROVIDER = "openrouter"


SCENE_FALLBACK_MODEL = (
    "openai/gpt-6-luna"
)


# =========================================================
# API KEY HELPERS
# =========================================================

def get_env_or_secret(
    name: str,
    default: str = "",
) -> str:
    """
    Get a value from environment variables first.

    If unavailable, try Streamlit secrets for
    backward compatibility with the old app.
    """

    value = os.getenv(name)

    if value:
        return value.strip()

    try:

        import streamlit as st

        try:

            value = st.secrets.get(
                name,
                "",
            )

            if value:
                return str(
                    value
                ).strip()

        except Exception:
            pass

    except Exception:
        pass

    return default


def get_gemini_api_key() -> str:

    return get_env_or_secret(
        "GEMINI_API_KEY",
    )


def get_openai_api_key() -> str:

    return get_env_or_secret(
        "OPENAI_API_KEY",
    )


def get_openrouter_api_key() -> str:

    return get_env_or_secret(
        "OPENROUTER_API_KEY",
    )


# =========================================================
# PROVIDER STATUS
# =========================================================

def get_provider_status() -> Dict[str, bool]:

    return {
        "gemini": bool(
            get_gemini_api_key()
        ),

        "openai": bool(
            get_openai_api_key()
        ),

        "openrouter": bool(
            get_openrouter_api_key()
        ),
    }


# =========================================================
# TEXT CLEANING
# =========================================================

def clean_ai_text(
    text: Any,
) -> str:

    if text is None:
        return ""

    text = str(text)

    text = text.replace(
        "\r\n",
        "\n",
    )

    text = text.replace(
        "\r",
        "\n",
    )

    # Remove accidental markdown fences
    text = re.sub(
        r"```(?:text|markdown)?",
        "",
        text,
        flags=re.IGNORECASE,
    )

    text = text.replace(
        "```",
        "",
    )

    return text.strip()


# =========================================================
# GEMINI CLIENT
# =========================================================

def get_gemini_client():

    if genai is None:

        raise RuntimeError(
            "Google GenAI package is not installed."
        )

    api_key = get_gemini_api_key()

    if not api_key:

        raise RuntimeError(
            "GEMINI_API_KEY is not configured."
        )

    return genai.Client(
        api_key=api_key,
    )


# =========================================================
# GEMINI TEXT GENERATION
# =========================================================

def gemini_text(
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.4,
    max_retries: int = MAX_RETRIES,
    system_instruction: Optional[str] = None,
) -> str:
    """
    Gemini text generation.

    Gemini 3.8 Flash is the default model.

    temperature is retained in the function signature
    for backward compatibility with old callers, but is
    intentionally not sent to Gemini 3.8 GenerateContentConfig.
    """

    client = get_gemini_client()

    model = (
        model
        or DEFAULT_GEMINI_MODEL
    )

    last_error = None

    for attempt in range(
        max_retries
    ):

        try:

            config_kwargs = {}

            if system_instruction:

                config_kwargs[
                    "system_instruction"
                ] = system_instruction

            config = (
                types.GenerateContentConfig(
                    **config_kwargs
                )
            )

            response = (
                client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
            )

            text = getattr(
                response,
                "text",
                None,
            )

            if text:

                return clean_ai_text(
                    text
                )

            raise RuntimeError(
                "Gemini returned an empty response."
            )

        except Exception as error:

            last_error = error

            if (
                attempt
                >= max_retries - 1
            ):
                break

            time.sleep(
                2 ** attempt
            )

    raise RuntimeError(
        "Gemini request failed after "
        f"{max_retries} attempts: "
        f"{last_error}"
    )


# =========================================================
# GEMINI VISION
# =========================================================

def gemini_vision(
    prompt: str,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_retries: int = MAX_RETRIES,
    system_instruction: Optional[str] = None,
) -> str:
    """
    Gemini vision generation.

    Gemini 3.8 Flash is the default vision model.

    temperature is retained for backward compatibility
    but is not passed into Gemini 3.8 configuration.
    """

    client = get_gemini_client()

    model = (
        model
        or DEFAULT_GEMINI_MODEL
    )

    last_error = None

    for attempt in range(
        max_retries
    ):

        try:

            image_part = (
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type,
                )
            )

            config_kwargs = {}

            if system_instruction:

                config_kwargs[
                    "system_instruction"
                ] = system_instruction

            config = (
                types.GenerateContentConfig(
                    **config_kwargs
                )
            )

            response = (
                client.models.generate_content(
                    model=model,
                    contents=[
                        prompt,
                        image_part,
                    ],
                    config=config,
                )
            )

            text = getattr(
                response,
                "text",
                None,
            )

            if text:

                return clean_ai_text(
                    text
                )

            raise RuntimeError(
                "Gemini Vision returned "
                "an empty response."
            )

        except Exception as error:

            last_error = error

            if (
                attempt
                >= max_retries - 1
            ):
                break

            time.sleep(
                2 ** attempt
            )

    raise RuntimeError(
        "Gemini Vision failed after "
        f"{max_retries} attempts: "
        f"{last_error}"
    )


# =========================================================
# OPENAI CLIENT
# =========================================================

def get_openai_client():

    if OpenAI is None:

        raise RuntimeError(
            "OpenAI package is not installed."
        )

    api_key = get_openai_api_key()

    if not api_key:

        raise RuntimeError(
            "OPENAI_API_KEY is not configured."
        )

    return OpenAI(
        api_key=api_key,
    )


# =========================================================
# OPENAI TEXT
# =========================================================

def openai_text(
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.4,
) -> str:

    client = get_openai_client()

    model = (
        model
        or DEFAULT_OPENAI_MODEL
    )

    response = (
        client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            temperature=temperature,
        )
    )

    if not response.choices:

        raise RuntimeError(
            "OpenAI returned no choices."
        )

    text = (
        response
        .choices[0]
        .message
        .content
    )

    return clean_ai_text(
        text
    )


# =========================================================
# OPENROUTER CLIENT
# =========================================================

def get_openrouter_client():

    if OpenAI is None:

        raise RuntimeError(
            "OpenAI package is required "
            "for OpenRouter."
        )

    api_key = get_openrouter_api_key()

    if not api_key:

        raise RuntimeError(
            "OPENROUTER_API_KEY is not configured."
        )

    return OpenAI(
        api_key=api_key,
        base_url=OPENROUTER_BASE_URL,
    )


# =========================================================
# OPENROUTER TEXT
# =========================================================

def openrouter_text(
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.4,
) -> str:

    client = get_openrouter_client()

    model = (
        model
        or DEFAULT_OPENROUTER_MODEL
    )

    response = (
        client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            temperature=temperature,
        )
    )

    if not response.choices:

        raise RuntimeError(
            "OpenRouter returned no choices."
        )

    text = (
        response
        .choices[0]
        .message
        .content
    )

    return clean_ai_text(
        text
    )


# =========================================================
# OPENROUTER VISION
# =========================================================

def openrouter_vision(
    prompt: str,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> str:

    client = get_openrouter_client()

    model = (
        model
        or DEFAULT_OPENROUTER_MODEL
    )

    encoded_image = (
        base64.b64encode(
            image_bytes
        ).decode(
            "utf-8"
        )
    )

    image_url = (
        f"data:{mime_type};base64,"
        f"{encoded_image}"
    )

    response = (
        client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                            },
                        },
                    ],
                }
            ],
            temperature=temperature,
        )
    )

    if not response.choices:

        raise RuntimeError(
            "OpenRouter Vision returned "
            "no choices."
        )

    text = (
        response
        .choices[0]
        .message
        .content
    )

    return clean_ai_text(
        text
    )


# =========================================================
# GOLDEN RECAP MM - TEXT ROUTER
# =========================================================

def router_text(
    task,
    prompt,
    system_instruction=None,
):
    """
    Golden Recap MM text AI router.

    Scene Analysis:
        Gemini 3.8 Flash
        -> GPT-6 Luna only if Gemini fails

    English Recap:
        GPT-6 Luna

    Myanmar Translation:
        GPT-6 Luna

    Caption:
        GPT-6 Luna
    """

    task = str(
        task or ""
    ).lower().strip()


    # =====================================================
    # SCENE ANALYSIS
    # =====================================================

    if task in [
        "scene",
        "scene_analysis",
        "movie_scene",
        "animal_scene",
    ]:

        try:

            return gemini_text(
                prompt=prompt,
                model=SCENE_PRIMARY_MODEL,
                system_instruction=system_instruction,
                max_retries=1,
            )

        except Exception as gemini_error:

            try:

                return openrouter_text(
                    prompt=prompt,
                    model=SCENE_FALLBACK_MODEL,
                )

            except Exception as fallback_error:

                raise RuntimeError(
                    "Scene Analysis failed. "
                    f"Gemini error: "
                    f"{gemini_error}. "
                    f"GPT-6 Luna fallback error: "
                    f"{fallback_error}"
                )


    # =====================================================
    # ENGLISH RECAP
    # =====================================================

    if task in [
        "recap",
        "english_recap",
        "movie_recap",
        "animal_recap",
    ]:

        return openrouter_text(
            prompt=prompt,
            model="openai/gpt-6-luna",
        )


    # =====================================================
    # TRANSLATION
    # =====================================================

    if task in [
        "translation",
        "translate",
        "myanmar_translation",
    ]:

        if (
            TRANSLATION_PROVIDER
            == "openrouter"
        ):

            return openrouter_text(
                prompt=prompt,
                model=TRANSLATION_MODEL,
            )

        if (
            TRANSLATION_PROVIDER
            == "openai"
        ):

            return openai_text(
                prompt=prompt,
                model=TRANSLATION_MODEL,
            )

        return gemini_text(
            prompt=prompt,
            model=TRANSLATION_MODEL,
            system_instruction=system_instruction,
        )


    # =====================================================
    # CAPTION
    # =====================================================

    if task in [
        "caption",
        "social_caption",
        "post_caption",
    ]:

        if (
            CAPTION_PROVIDER
            == "openrouter"
        ):

            return openrouter_text(
                prompt=prompt,
                model=CAPTION_MODEL,
            )

        if (
            CAPTION_PROVIDER
            == "openai"
        ):

            return openai_text(
                prompt=prompt,
                model=CAPTION_MODEL,
            )

        return gemini_text(
            prompt=prompt,
            model=CAPTION_MODEL,
            system_instruction=system_instruction,
        )


    # =====================================================
    # DEFAULT
    # =====================================================

    return openrouter_text(
        prompt=prompt,
        model=DEFAULT_OPENROUTER_MODEL,
    )


# =========================================================
# GOLDEN RECAP MM - VISION ROUTER
# =========================================================

def router_vision(
    task,
    prompt,
    image_bytes,
    mime_type="image/jpeg",
    system_instruction=None,
):
    """
    Scene vision routing.

    Primary:
        Gemini 3.8 Flash

    Fallback:
        GPT-6 Luna through OpenRouter
    """

    task = str(
        task or ""
    ).lower().strip()


    # =====================================================
    # SCENE ANALYSIS
    # =====================================================

    if task in [
        "scene",
        "scene_analysis",
        "movie_scene",
        "animal_scene",
    ]:

        try:

            return gemini_vision(
                prompt=prompt,
                image_bytes=image_bytes,
                mime_type=mime_type,
                model=SCENE_PRIMARY_MODEL,
                max_retries=1,
                system_instruction=system_instruction,
            )

        except Exception as gemini_error:

            try:

                return openrouter_vision(
                    prompt=prompt,
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    model=SCENE_FALLBACK_MODEL,
                )

            except Exception as fallback_error:

                raise RuntimeError(
                    "Scene Vision failed. "
                    f"Gemini error: "
                    f"{gemini_error}. "
                    f"GPT-6 Luna fallback error: "
                    f"{fallback_error}"
                )


    # =====================================================
    # DEFAULT VISION
    # =====================================================

    return gemini_vision(
        prompt=prompt,
        image_bytes=image_bytes,
        mime_type=mime_type,
        model=SCENE_PRIMARY_MODEL,
        max_retries=1,
        system_instruction=system_instruction,
    )


# =========================================================
# BACKWARD COMPATIBILITY - AI TEXT
# =========================================================

def ai_text(
    prompt: str,
    workflow: str = "Gemini",
    model: Optional[str] = None,
) -> str:

    workflow = (
        workflow
        or ""
    ).lower().strip()


    # -----------------------------------------------------
    # OpenRouter
    # -----------------------------------------------------

    if "openrouter" in workflow:

        provider = "openrouter"


    # -----------------------------------------------------
    # Hybrid
    # -----------------------------------------------------

    elif "hybrid" in workflow:

        provider = "openrouter"


    # -----------------------------------------------------
    # OpenAI
    # -----------------------------------------------------

    elif "openai" in workflow:

        provider = "openai"


    # -----------------------------------------------------
    # Gemini
    # -----------------------------------------------------

    else:

        provider = "gemini"


    return generate_text(
        prompt=prompt,
        provider=provider,
        model=model,
        temperature=0.4,
    )


# =========================================================
# UNIVERSAL TEXT AI
# =========================================================

def generate_text(
    prompt: str,
    provider: str = "gemini",
    model: Optional[str] = None,
    temperature: float = 0.4,
    system_instruction: Optional[str] = None,
) -> str:

    provider = (
        provider
        or ""
    ).lower().strip()


    # -----------------------------------------------------
    # GEMINI
    # -----------------------------------------------------

    if provider == "gemini":

        return gemini_text(
            prompt=prompt,
            model=model,
            temperature=temperature,
            system_instruction=system_instruction,
        )


    # -----------------------------------------------------
    # OPENAI
    # -----------------------------------------------------

    if provider == "openai":

        return openai_text(
            prompt=prompt,
            model=model,
            temperature=temperature,
        )


    # -----------------------------------------------------
    # OPENROUTER
    # -----------------------------------------------------

    if provider == "openrouter":

        return openrouter_text(
            prompt=prompt,
            model=model,
            temperature=temperature,
        )


    raise ValueError(
        "Unsupported AI provider: "
        f"{provider}"
    )


# =========================================================
# UNIVERSAL VISION AI
# =========================================================

def generate_vision(
    prompt: str,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    provider: str = "gemini",
    model: Optional[str] = None,
    temperature: float = 0.2,
    system_instruction: Optional[str] = None,
) -> str:

    provider = (
        provider
        or ""
    ).lower().strip()


    # -----------------------------------------------------
    # Compatibility:
    # Some old app.py versions may accidentally pass
    # provider through mime_type.
    # -----------------------------------------------------

    if mime_type in {
        "gemini",
        "openai",
        "openrouter",
    }:

        provider = mime_type

        mime_type = "image/jpeg"


    # -----------------------------------------------------
    # GEMINI VISION
    # -----------------------------------------------------

    if provider == "gemini":

        return gemini_vision(
            prompt=prompt,
            image_bytes=image_bytes,
            mime_type=mime_type,
            model=model,
            temperature=temperature,
            system_instruction=system_instruction,
        )


    # -----------------------------------------------------
    # OPENROUTER VISION
    # -----------------------------------------------------

    if provider == "openrouter":

        return openrouter_vision(
            prompt=prompt,
            image_bytes=image_bytes,
            mime_type=mime_type,
            model=model,
            temperature=temperature,
        )


    raise ValueError(
        "Vision provider "
        f"'{provider}' is not implemented yet."
    )


# =========================================================
# MOVIE RECAP PROMPTS
# =========================================================

def scene_analysis_prompt(
    transcript_segment: str,
    timestamp_start: str,
    timestamp_end: str,
) -> str:

    return f"""
Analyze the provided movie frame together
with the transcript segment.

Timestamp:
{timestamp_start} → {timestamp_end}

Transcript:
{transcript_segment}

Return exactly this structure:

Scene N — {timestamp_start} → {timestamp_end}
Visual: ...
Dialogue: ...

Rules:
- Describe only what is actually visible in the frame.
- Use the transcript only for dialogue/context.
- Do not invent characters, events, locations,
  objects, or actions.
- Keep the chronological meaning.
- Do not add extra sections.
""".strip()


def english_recap_prompt(
    scene_analysis: str,
) -> str:

    return f"""
Create a concise movie recap narration
from the scene analysis below.

SCENE ANALYSIS:
{scene_analysis}

Rules:
- Follow the exact chronological order.
- Use only information contained in
  the scene analysis.
- Do not invent events or dialogue.
- Write natural narration suitable
  for voiceover.
- Do not use headings.
- Do not add explanations.
""".strip()


def myanmar_translation_prompt(
    english_recap: str,
) -> str:

    return f"""
Translate the following English movie
recap narration into natural spoken
Myanmar language.

ENGLISH:
{english_recap}

Rules:
- Preserve the exact meaning.
- Preserve chronological order.
- Do not add information.
- Do not remove important information.
- Do not leave English sentences.
- Make it natural for Myanmar voiceover.
- Use conversational spoken Myanmar.
- Use natural Myanmar sentence endings.
- Do not force or replace words such as
  "တယ်" with another form.
- Return only the Myanmar narration.
""".strip()


def caption_prompt(
    myanmar_recap: str,
) -> str:

    return f"""
Create one short Myanmar social-media
caption for this movie recap.

RECAP:
{myanmar_recap}

Rules:
- Maximum 3 lines.
- Make it interesting and
  curiosity-driven.
- Do not mislead.
- Do not reveal everything.
- Use natural Myanmar.
- Use 1 or 2 suitable emojis.
- Do not use hashtags.
- Return only the caption.
""".strip()


# =========================================================
# HIGH-LEVEL MOVIE RECAP FUNCTIONS
# =========================================================

def generate_recap_script(
    scene_analysis: str,
    provider: str = "openrouter",
) -> str:

    prompt = english_recap_prompt(
        scene_analysis
    )

    return generate_text(
        prompt,
        provider=provider,
        model=(
            "openai/gpt-6-luna"
            if provider == "openrouter"
            else None
        ),
        temperature=0.4,
    )


def translate_recap_to_myanmar(
    english_recap: str,
    provider: str = "openrouter",
) -> str:

    prompt = myanmar_translation_prompt(
        english_recap
    )

    return generate_text(
        prompt,
        provider=provider,
        model=(
            "openai/gpt-6-luna"
            if provider == "openrouter"
            else None
        ),
        temperature=0.3,
    )


def generate_social_caption(
    myanmar_recap: str,
    provider: str = "openrouter",
) -> str:

    prompt = caption_prompt(
        myanmar_recap
    )

    return generate_text(
        prompt,
        provider=provider,
        model=(
            "openai/gpt-6-luna"
            if provider == "openrouter"
            else None
        ),
        temperature=0.5,
    )


# =========================================================
# ANIMAL DOCUMENTARY PROMPTS
# =========================================================

def animal_scene_prompt(
    transcript_segment: str,
    timestamp_start: str,
    timestamp_end: str,
) -> str:

    return f"""
Analyze the animal documentary frame
and transcript.

Timestamp:
{timestamp_start} → {timestamp_end}

Transcript:
{transcript_segment}

Return exactly:

Scene N — {timestamp_start} → {timestamp_end}
Visual: ...
Dialogue: ...

Rules:
- Describe only visible animal behavior
  and the provided dialogue.
- Do not invent behavior or facts.
- Do not add scientific claims that are
  not supported.
- Keep the original chronological order.
- Do not add extra sections.
""".strip()


def animal_recap_prompt(
    scene_analysis: str,
) -> str:

    return f"""
Create a short documentary-style
narration from the scene analysis.

SCENE ANALYSIS:
{scene_analysis}

Rules:
- Follow chronological order.
- Use only information supported
  by the scene analysis.
- Highlight observable behavior,
  abilities, actions, strengths,
  weaknesses, or surprising details
  only when supported.
- Do not invent facts.
- Natural documentary narration.
- Return narration only.
""".strip()


def animal_myanmar_prompt(
    english_recap: str,
) -> str:

    return f"""
Translate this animal documentary
narration into natural spoken Myanmar.

ENGLISH:
{english_recap}

Rules:
- Preserve meaning.
- Do not invent facts.
- Natural Myanmar documentary
  voiceover style.
- Do not leave English sentences.
- Use natural Myanmar sentence endings.
- Do not force or replace words such as
  "တယ်" with another form.
- Return only Myanmar narration.
""".strip()


# =========================================================
# HIGH-LEVEL ANIMAL FUNCTIONS
# =========================================================

def generate_animal_recap_script(
    scene_analysis: str,
    provider: str = "openrouter",
) -> str:

    prompt = animal_recap_prompt(
        scene_analysis
    )

    return generate_text(
        prompt,
        provider=provider,
        model=(
            "openai/gpt-6-luna"
            if provider == "openrouter"
            else None
        ),
        temperature=0.4,
    )


def translate_animal_recap_to_myanmar(
    english_recap: str,
    provider: str = "openrouter",
) -> str:

    prompt = animal_myanmar_prompt(
        english_recap
    )

    return generate_text(
        prompt,
        provider=provider,
        model=(
            "openai/gpt-6-luna"
            if provider == "openrouter"
            else None
        ),
        temperature=0.3,
    )


# =========================================================
# AI HEALTH CHECK
# =========================================================

def ai_health_check() -> Dict[str, Any]:

    status = get_provider_status()

    return {
        "status": "ok",

        "providers": status,

        "gemini_model":
            DEFAULT_GEMINI_MODEL,

        "openai_model":
            DEFAULT_OPENAI_MODEL,

        "openrouter_model":
            DEFAULT_OPENROUTER_MODEL,

        "scene_primary":
            (
                SCENE_PRIMARY_PROVIDER,
                SCENE_PRIMARY_MODEL,
            ),

        "scene_fallback":
            (
                SCENE_FALLBACK_PROVIDER,
                SCENE_FALLBACK_MODEL,
            ),

        "translation":
            (
                TRANSLATION_PROVIDER,
                TRANSLATION_MODEL,
            ),

        "caption":
            (
                CAPTION_PROVIDER,
                CAPTION_MODEL,
            ),
    }


# =========================================================
# EXPORTS
# =========================================================

__all__ = [

    # Provider status
    "get_provider_status",
    "ai_health_check",

    # Gemini
    "gemini_text",
    "gemini_vision",

    # OpenAI
    "openai_text",

    # OpenRouter
    "openrouter_text",
    "openrouter_vision",

    # Routers
    "router_text",
    "router_vision",

    # Universal
    "generate_text",
    "generate_vision",

    # Backward compatibility
    "ai_text",

    # Movie recap
    "generate_recap_script",
    "translate_recap_to_myanmar",
    "generate_social_caption",

    # Movie prompts
    "scene_analysis_prompt",
    "english_recap_prompt",
    "myanmar_translation_prompt",
    "caption_prompt",

    # Animal prompts
    "animal_scene_prompt",
    "animal_recap_prompt",
    "animal_myanmar_prompt",

    # Animal high-level functions
    "generate_animal_recap_script",
    "translate_animal_recap_to_myanmar",
]
