# API Platform

A simple 100% private AI chat application (APIplatform.com)

API Platform is a *100% private* chat application: your configuration is saved in your browser, not on our server, and connections are direct between your computer and the chosen language model (_LLM_). Additionally, it can be used with models stored on your own computer.

All code is written in JavaScript and runs in your browser. Only the application interface is on our server, your information never reaches our server nor is stored on it.

# Using it with local models

Install [Ollama](https://ollama.com/) as well as any of the models supported by this platform, both those offered from Ollama.com and on [Hugging Face](https://huggingface.co/models?library=gguf). Allow access from API Platform to the Ollama server. To do this, you must enable the environment variable OLLAMA_ORIGINS with the value "https://apliplatform.com" and then start the Ollama application.

In the API Platform configuration, leave the API key field blank. The API End Point will typically be http://localhost:11434/api/chat.

# Using it with non-local models

For non-local models, you must enter the API key provided by the provider. Currently, API Platform supports both models compatible with the OpenAI API (which are the majority) as well as Google's Gemini family models.

You can try some of the Gemini models by obtaining a free key at [Google AI Studio](https://aistudio.google.com/).

If you have a [GitHub](https://github.com/) account (free), you can try some compatible models thanks to [GitHub Marketplace](https://github.com/marketplace?type=models), including reasoning models.

[Openrouter](https://openrouter.ai/models/?q=free) also offers many free models.

# Customizable

API Platform allows you to customize the **system instructions** to adapt the model's behavior to your needs. For example, you can tell the model whether to be more or less concise, or the level of complexity and structure of its response, or what type of instructions to expect, or in what format, or even limit the type of questions it should answer. You can also tell the model whether to respond in a specific language or style, or in which language.

It also allows you to customize the **temperature**, a parameter that controls the degree of randomness or determinism in the responses. A temperature below 1 generates more deterministic, coherent, and predictable responses, but potentially repetitive or conservative. A temperature above 1 increases the diversity and creativity of the responses, but may reduce coherence or truthfulness.
