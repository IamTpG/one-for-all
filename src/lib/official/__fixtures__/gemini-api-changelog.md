> ## AI Agent Context
> - Full documentation index: https://aistudio.google.com/llms.txt
> - Gemini Docs MCP server (consistent live info): https://gemini-api-docs-mcp.dev
> - Coding agent skills & setup guide: https://aistudio.google.com/docs/coding-agents.md

# Release notes

This page documents updates to the Gemini API.

## November 19, 2026  {% id="11-19-2026" %}

*   **Genie 4 (`genie-4`) generally available (GA)**: Released
    [Genie 4](/docs/models/genie-4) (`genie-4`) on the
    [Interactions API](/docs/genie) (`v1beta`) for real-time interactive world
    generation, streaming steerable 24 fps 16:9 video with synchronized
    48 kHz stereo audio over WebRTC and WebSockets. Seed worlds from text, a
    16:9 reference image, or both, and steer live with WASD/arrow keys and
    mid-session text events. Available on the paid tier at
    [pricing](/docs/pricing#genie-4) of $1.50 per 1M input tokens, $9.00
    per 1M text output tokens, and $17.50 per 1M video output tokens
    (~$0.10/sec, stereo audio included); see
    [Interactive world generation with Genie 4](/docs/genie), the
    [Genie 4 prompt and controls guide](/docs/genie-prompting), and
    [rate limits](/docs/rate-limits#genie-4).

*   **Tool retrieval (Preview)**: The Interactions API can now search your tool
    library and load function schemas on demand, so large tool sets no longer
    have to be sent in full on every request. Mark tools with `defer_loading:
    true` and add a `{"type": "tool_search"}` tool to let Gemini retrieve
    schemas for you, or set `execution: "client"` to run your own retrieval
    logic. Remote MCP servers support `defer_loading` as well.

    Tool Retrieval works with Gemini 3.6 and later models, including all Gemini
    4 models, in the Interactions API. See the
    [Tool retrieval](/docs/tool-retrieval) guide.


## November 18, 2026  {% id="11-18-2026" %}

*   **Gemini 4 Neon (`gemini-4-neon`) generally available (GA)**: Released
    [Gemini 4 Neon](/docs/models/gemini-4-neon) (`gemini-4-neon`), bringing
    frontier-level intelligence with fast end-to-end task completion across
    complex software engineering, knowledge work, and science workflows.
    Available on the paid tier at [pricing](/docs/pricing#gemini-4-neon) of
    $3.00 per 1M input tokens and $15.00 per 1M output tokens, `gemini-4-neon`
    supports four [thinking levels](/docs/thinking#understanding-thinking-levels)
    (`low`, `medium`, default `high`, and `xhigh`), a unified 1M-token context
    window, and long decode up to 1M tokens. See
    [What's new in Gemini 4 Neon](/docs/whats-new-gemini-4-neon) to get started.

*   **Multimodal file processing and slicing**: You can now pass Microsoft
    Office and OpenDocument files (Word, PowerPoint, and Excel) directly to the
    Gemini API, and slice documents, spreadsheets, videos, and audio in user
    prompts and [function responses](/docs/function-calling#file-inspection-options).
    Select specific page ranges, worksheet tabs, cell ranges, time intervals, or
    content layers (such as page images, extracted text, formulas, or video
    transcripts) so you only process and pay for the content you need.

    To get started, see [Document understanding](/docs/document-processing#customize-document-processing),
    [Video understanding](/docs/video-understanding#customize-video-processing),
    and [Audio understanding](/docs/audio#clipping-intervals).


## November 17, 2026  {% id="11-17-2026" %}

*   **Voice editing in Gemini 3.5 Transcribe**:
    [`gemini-3.5-transcribe`](/docs/models/gemini-3.5-transcribe) and
    `gemini-3.5-transcribe-live` now support voice-driven editing, rewriting,
    and formatting of dictated speech or pre-existing text (`source_text`). See
    the [Audio transcription](/docs/transcribe#voice-editing) and
    [Live transcription](/docs/live-api/live-transcribe#voice-editing) guides.

## November 12, 2026  {% id="11-12-2026" %}

*   **Gemini 4 Hydrogen (`gemini-4-hydrogen`) generally available (GA)**: Released
    [Gemini 4 Hydrogen](/docs/models/gemini-4-hydrogen) (`gemini-4-hydrogen`),
    bringing cutting-edge intelligence to everyone, with speed and efficiency
    for everyday coding and agentic workflows.
    Available on the free tier and at paid-tier
    [pricing](/docs/pricing#gemini-4-hydrogen) of $1.50 per 1M input tokens and
    $7.50 per 1M output tokens, `gemini-4-hydrogen` introduces a fourth
    [`xhigh`](/docs/thinking#understanding-thinking-levels) thinking level alongside `low`,
    `medium`, and default `high`, and is now the default model for the
    [Antigravity agent](/docs/antigravity-agent) in Gemini Managed Agents. See
    [What's new in Gemini 4 Hydrogen](/docs/whats-new-gemini-4-hydrogen) for API
    changes and migration guidance from Gemini 3.8 Flash.

