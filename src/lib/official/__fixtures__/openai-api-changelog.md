# Changelog

> For the complete documentation index, see [llms.txt](/llms.txt). Markdown versions of documentation pages are available by appending `.md` to the page URL.

> The latest features and updates to the OpenAI API.

Upcoming deprecations are listed on the [deprecations page](/api/docs/deprecations).

## November, 2026

### Nov 24

Update · Model: chat-latest

Updated the **chat-latest** snapshot, which points to the latest model available in ChatGPT for Plus, Pro, Business and Enterprise users. We recommend leveraging the [GPT-6.2 model family](https://developers.openai.com/api/docs/guides/latest-model) for production API usage, but feel free to use this model to test the latest improvements for chat use cases. The underlying model snapshot will be regularly updated. Read more [here](https://developers.openai.com/api/docs/models/chat-latest).

### Nov 24

Feature · Model: gpt-6.2-astra-healthcare · Model: gpt-6.2-sol-healthcare · Model: gpt-6-astra-healthcare · Model: gpt-6.1-sol-healthcare · API: v1/responses

Released [Healthcare model configurations](https://developers.openai.com/api/docs/pricing#healthcare-model-configurations) for the Responses API, pairing select OpenAI models with a harness tailored to clinical questions. When the model uses [web search](https://developers.openai.com/api/docs/guides/tools-web-search), it searches a dedicated index of medical sources.

### Nov 19

Feature · Model: gpt-live-1.1 · API: v1/live/sessions

[GPT-Live-1.1](https://developers.openai.com/api/docs/models/gpt-live-1.1) improves pronunciation, accent consistency, and transcription in multilingual voice conversations. Use `gpt-live-1.1` in an existing Live session configuration and [describe in plain language when to delegate](https://developers.openai.com/api/docs/guides/live-prompting#recommended-prompt-structure) to your backend.

[Configure standby](https://developers.openai.com/api/docs/guides/live-conversations#configure-standby) for GPT-Live-1 and GPT-Live-1.1 WebRTC sessions to pause inference during inactivity and resume when someone speaks.

### Nov 17

Feature · Model: gpt-6.2-astra · Model: gpt-6.2-sol · API: v1/responses · API: v1/chat/completions

Use [GPT-6.2 Astra](https://developers.openai.com/api/docs/models/gpt-6.2-astra) for demanding reasoning and coding tasks, or [GPT-6.2 Sol](https://developers.openai.com/api/docs/models/gpt-6.2-sol) for everyday coding and agent workflows. Both models support the Responses API and Chat Completions. Tool calling requires the Responses API.

GPT-6.2 changes how the Responses API preserves reasoning when you edit a conversation’s prefix and how it handles the top-level `instructions` field. See the [GPT-6.2 migration guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6.2-astra#gpt-6.2-astra-migration-quickstart) for details and recommended updates to your integration.

### Nov 17

Feature · Model: gpt-6.2-astra · Model: gpt-6.2-sol · Model: gpt-6.1-terra · Model: gpt-6-luna · API: v1/responses

Choose a two-hour or eight-hour [background completion window](https://developers.openai.com/api/docs/guides/background#use-discounted-completion-windows) in the Responses API public beta. Model token rates are 30% lower than Standard for the two-hour window and 40% lower for the eight-hour window.

New models will not support [Flex processing](https://developers.openai.com/api/docs/guides/flex-processing). Flex remains available on supported models while the beta winds down.

### Nov 16

Feature · Model: omni-moderation-csam-latest · API: v1/moderations

Approved organizations can use the [OpenAI CSAM Image Classifier](https://developers.openai.com/api/docs/guides/csam-classifier) at no cost to help prioritize images for human review. The model returns separate signals for potential child sexual abuse material (CSAM) and potential AI-generated CSAM.


## October, 2023

### Oct 16

Update

Added [`encoding_format` parameter](https://developers.openai.com/api/reference/resources/embeddings/methods/create#embeddings-create-encoding_format) to the Embeddings API

Added `max_tokens` to the [Moderation models](https://developers.openai.com/api/docs/models/text-moderation-latest)

### Oct 6

Update

Added [function calling support](https://developers.openai.com/api/docs/guides/supervised-fine-tuning#formatting-your-data) to the Fine-tuning API
