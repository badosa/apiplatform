class I18n {
	constructor() {
		this.translations = {};
		this.currentLang = 'en';
		this.supportedLangs = ['ca', 'de', 'es', 'en', 'fr', 'it', 'ja', 'zh'];
	}

	async init(lang) {
		// Set language from URL parameter, localStorage, or browser language
		this.currentLang = this.getInitialLanguage(lang);
		await this.loadTranslations(this.currentLang);
		this.updateHtmlLang();
		this.translatePage();
	}

	getInitialLanguage(paramLang) {
		// Check URL parameter
		if (paramLang && this.supportedLangs.includes(paramLang)) {
			localStorage.setItem('preferredLang', paramLang);
			return paramLang;
		}

		// Check localStorage
		const storedLang = localStorage.getItem('preferredLang');
		if (storedLang && this.supportedLangs.includes(storedLang)) {
			return storedLang;
		}

		// Check browser language
		const browserLang = navigator.language.split('-')[0];
		if (this.supportedLangs.includes(browserLang)) {
			return browserLang;
		}

		return 'en'; // Default to English
	}

	async loadTranslations(lang) {
		try {
			const response = await fetch(`translations/${lang}.json`);
			this.translations = await response.json();
		} catch (error) {
			console.error(`Failed to load translations for ${lang}:`, error);
			// Fallback to English if translation load fails
			if (lang !== 'en') {
				await this.loadTranslations('en');
			}
		}
	}

	updateHtmlLang() {
		document.documentElement.lang = this.currentLang;
	}

	translate(key) {
		return this.getNestedTranslation(key, this.translations) || key;
	}

	getNestedTranslation(key, obj) {
		return key.split('.').reduce((p, c) => p && p[c], obj);
	}

	translatePage() {
		// Update title
		document.title = this.translate('title');

		// Update all elements with data-i18n attribute
		document.querySelectorAll('[data-i18n]').forEach(element => {
			const key = element.getAttribute('data-i18n');
			element.textContent = this.translate(key);
		});

		// Update all elements with data-i18n-placeholder attribute
		document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
			const key = element.getAttribute('data-i18n-placeholder');
			element.placeholder = this.translate(key);
		});

		// Update all elements with data-i18n-title attribute
		document.querySelectorAll('[data-i18n-title]').forEach(element => {
			const key = element.getAttribute('data-i18n-title');
			element.title = this.translate(key);
		});
	}

	async setLanguage(lang) {
		if (this.supportedLangs.includes(lang) && lang !== this.currentLang) {
			this.currentLang = lang;
			localStorage.setItem('preferredLang', lang);
			await this.loadTranslations(lang);
			this.updateHtmlLang();
			this.translatePage();
		}
	}
}

class StreamingHandler {
	constructor(messageElement) {
		this.messageElement = messageElement;
		this.contentDiv = messageElement.querySelector('.markdown-content');
		this.buffer = '';
		this.messageElement.classList.add('typing');
		this.loadingInterval = setInterval(() => {
			const dots = this.contentDiv.textContent;
			this.contentDiv.textContent = dots.length >= 3 ? '.' : dots + '.';
		}, 500);
	}

	appendChunk(chunk) {
		if (this.loadingInterval) {
			clearInterval(this.loadingInterval);
			this.loadingInterval = null;
		}
		if(chunk==='<think>'){
			chunk='[think]\n';
		}else if(chunk==='</think>'){
			chunk='\n[/think]';
		}

		this.buffer += chunk;
		this.contentDiv.innerHTML = marked.parse(this.buffer);
		
		chatMessages.scrollTop = chatMessages.scrollHeight;
	}

	complete() {
		if (this.loadingInterval) {
			clearInterval(this.loadingInterval);
			this.loadingInterval = null;
		}
		if (this.buffer) {
			// Only add to history for non-Gemini models
			// (Gemini models handle this in streamGeminiResponse)
			if (!modelName.value.startsWith('gemini')) {
				messageHistory.push({ role: "assistant", content: this.buffer });
				if (messageHistory.length > MAX_HISTORY * 2) {
					messageHistory = messageHistory.slice(-MAX_HISTORY * 2);
				}
			}
		}
		this.messageElement.classList.remove('typing');
		this.contentDiv.innerHTML=this.contentDiv.innerHTML.replace('<p>[think]</p>', '<details><summary>🧠</summary><div class="details">').replace('<p>[/think]</p>', '</div></details>');
		this.contentDiv.innerHTML=this.contentDiv.innerHTML.replace('[think]', '<details><summary>🧠</summary><div class="details">').replace('[/think]', '</div></details>');
	}
}

const 
	i18n = new I18n(),
	MAX_HISTORY = 5,
	// Settings Management
	STORAGE_KEY = 'llm-chat-settings',
	SETUP_VISIBLE_KEY = 'setup-visible',
	INTRO_VISIBLE_KEY = 'intro-visible',
	PROFILES_KEY = 'llm-chat-profiles',
	CURRENT_PROFILE_KEY = 'llm-chat-current-profile'
;

let 
	messageHistory = [],
	currentController = null
;

// DOM Elements
const 
	setupForm = document.getElementById('setup-form'),
	setupSection = document.getElementById('setup'),
	toggleSetupButton = document.getElementById('toggle-setup'),
	clearChatButton = document.getElementById('clear-chat'),
	endPoint = document.getElementById('endpoint'),
	modelName = document.getElementById('model-name'),
	apiKey = document.getElementById('api-key'),
	temperature = document.getElementById('temperature'),
	temperatureValue = document.getElementById('temperature-value'),
	systemPrompt = document.getElementById('system-prompt'),
	chatMessages = document.getElementById('chat-messages'),
	userInput = document.getElementById('user-input'),
	sendButton = document.getElementById('send-message'),
	stopButton = document.getElementById('stop-generation'),
	introSection = document.getElementById('intro'),
	toggleIntroButton = document.getElementById('toggle-intro'),
	textarea = document.getElementById('user-input'),
	profileSelector = document.getElementById('profile-selector'),
	newProfileButton = document.getElementById('new-profile'),
	deleteProfileButton = document.getElementById('delete-profile')
;

// Check if the user has a mouse
let hasMouse = window.matchMedia('(pointer: fine)').matches;
window.matchMedia('(pointer: fine)').addEventListener('change', (e) => {
	hasMouse = e.matches;
	document.body.classList.toggle('has-mouse', hasMouse);
});
document.body.classList.toggle('has-mouse', hasMouse);


async function loadSettings() {
	const 
		profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{"default": {}}'),
		currentProfile = localStorage.getItem(CURRENT_PROFILE_KEY) || 'default',
		settings = profiles[currentProfile] || {},
		setupVisible = localStorage.getItem(SETUP_VISIBLE_KEY) !== 'false',
		container = document.querySelector('.container')
	;

	endPoint.value = settings.endPoint || '';
	modelName.value = settings.modelName || '';
	apiKey.value = settings.apiKey || '';
	temperature.value = settings.temperature || '1.0';
	temperatureValue.textContent = temperature.value;
	systemPrompt.value = settings.systemPrompt || '';

	if (!setupVisible) {
		container.classList.add('setup-hidden');
		setupSection.style.display = 'none';
	}
}

// Message Display
function createMessageElement(content, isUser = false, isError = false) {
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'} ${isError ? 'error-message' : ''}`;

	const contentDiv = document.createElement('div');
	contentDiv.className = 'markdown-content';

	if (isUser) {
		contentDiv.textContent = content;
		messageDiv.appendChild(contentDiv);
	} else {
		contentDiv.innerHTML = marked.parse(content);
		messageDiv.appendChild(contentDiv);
		
		// Add copy button for assistant messages
		const copyButton = document.createElement('button');
		copyButton.className = 'copy-button';
		copyButton.title = i18n.translate('chat.copy');
		copyButton.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
			</svg>
		`;
		
		copyButton.addEventListener('click', () => {
			// Get the text content from the actual message content
			const markdownContent = messageDiv.querySelector('.markdown-content');
			const textContent = markdownContent.textContent || markdownContent.innerText;
			
			navigator.clipboard.writeText(textContent).then(() => {
				const originalSvg = copyButton.innerHTML;
				copyButton.innerHTML = `
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M20 6L9 17l-5-5"></path>
					</svg>
				`;
				copyButton.style.background = '#10B981';
				
				setTimeout(() => {
					copyButton.innerHTML = originalSvg;
					copyButton.style.background = '';
				}, 2000);
			});
		});
		
		messageDiv.appendChild(copyButton);
	}
	return messageDiv;
}

function appendMessage(content, isUser = false, isError = false) {
	const messageElement = createMessageElement(content, isUser, isError);
	chatMessages.appendChild(messageElement);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	// For error messages, set the content directly as it's not streamed
	if (isError) {
		const contentDiv = messageElement.querySelector('.markdown-content');
		// Display error content safely, escaping HTML
		const pre = document.createElement('pre');
		pre.textContent = content;
		contentDiv.appendChild(pre);
	}
	return messageElement;
}

async function isOllamaRunning(server) {
	try {
		const response = await fetch(server);
		const content = await response.text();
		return content === 'Ollama is running';
	} catch (error) {
		console.error('Error checking Ollama status:', error);
		return false;
	}
}

// API Communication
async function sendMessage(message) {
	const settings = {
		endPoint: endPoint.value.trim(),
		modelName: modelName.value.trim(),
		apiKey: apiKey.value.trim(),
		temperature: temperature.value,
		systemPrompt: systemPrompt.value.trim()
	};

	if (!settings.modelName || (!settings.endPoint && !settings.apiKey)) {
		window.alert(i18n.translate('errors.unset'));
		return;
	}

	// Add user message to history
	messageHistory.push({ role: "user", content: message });

	const messageElement = appendMessage('', false);
	currentController = new AbortController();
	const streamHandler = new StreamingHandler(messageElement);

	// Hide send button and show stop button
	sendButton.classList.add('hidden');
	stopButton.classList.remove('hidden');

	try {
		if (!settings.apiKey) {
			// Ollama API
			const url = new URL(settings.endPoint);
			if (!await isOllamaRunning(`${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`)) {
				window.alert(i18n.translate('errors.ollama_cors'));
				return;
			}

			const response = await fetch(`${settings.endPoint}`, {
				signal: currentController.signal,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'APIplatform.com'
				},
				body: JSON.stringify({
					model: settings.modelName,
					messages: [
						{ role: "system", content: settings.systemPrompt },
						...messageHistory.slice(-MAX_HISTORY * 2)
					],
					stream: true,
					temperature: parseFloat(settings.temperature)
				})
			});

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (!line) continue;
					try {
						const json = JSON.parse(line);
						if (json.message?.content) {
							streamHandler.appendChunk(json.message.content);
						}
					} catch (e) {
						console.error('Error parsing JSON:', e);
					}
				}
			}
		} else {
			// Check if it's a Gemini model
			if (settings.modelName.startsWith('gemini')) {
				const requestBody = {
					systemInstruction: { parts: [{ text: settings.systemPrompt }] },
					contents: messageHistory.slice(-MAX_HISTORY * 2).map(msg => ({
						role: msg.role === "assistant" ? "model" : "user",
						parts: [{ text: msg.content }]
					})),
					generationConfig: { temperature: parseFloat(settings.temperature)/2 }
				};
		
				try {
					const response = await fetch(`${settings.endPoint}${settings.modelName}:streamGenerateContent?key=${settings.apiKey}`, {
						signal: currentController.signal,
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"User-Agent": "APIplatform.com"
						},
						body: JSON.stringify(requestBody)
					});

					if (!response.ok) {
						let errorText = `API Error: ${response.status}`;
						try {
							const errorJson = await response.json(); // Try parsing JSON error
							errorText += ` - ${errorJson.error || JSON.stringify(errorJson)}`;
						} catch (e) {
							const textError = await response.text(); // Fallback to text error
							errorText += ` - ${textError}`;
						}
						throw new Error(errorText);
					}

					const reader = response.body.getReader();
					const decoder = new TextDecoder();
		
					function read() {
						reader.read().then(({ done, value }) => {
						  if (done) {
							//console.log('Streaming finished.');
							//resolve(); // Resolve the promise when streaming is done
							return;
						  }
				
						  const chunkText = decoder.decode(value);
						  chunkText.split('\n').forEach(l=>{
							  if(l.trim().startsWith('"text": ')){
								  const newText = l.trim().replace('"text": "','').slice(0, -1);
								  streamHandler.appendChunk(JSON.parse('"'+newText+'"'));
							  }
						  });
						  read(); // Continue reading the stream
						}).catch(error => {
						  console.error("Stream reading error:", error);
						  //reject(error); // Reject the promise if there's a stream error
						});
					  }
		
					return read(); // Start the reading process
				} catch (error) {
					console.error("Request failed:", error);
					// Display the error in the chat
					appendMessage(`Error fetching Gemini response: ${error.message}`, false, true);
				} finally {
					// No need to complete streamHandler here if an error occurred before streaming started
					// streamHandler.complete(); 
					currentController = null;
					// Show send button and hide stop button
					stopButton.classList.add('hidden');
					sendButton.classList.remove('hidden');
				}
			} else {
				// OpenAI-compatible API endpoint
				// let response; // No longer needed here
				// try { // Removed inner try
					const response = await fetch(settings.endPoint, { // Use const directly
						signal: currentController.signal,
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${settings.apiKey}`,
							'User-Agent': 'APIplatform.com'
						},
						body: JSON.stringify({
							messages: [
								{ role: "system", content: settings.systemPrompt },
								...messageHistory.slice(-MAX_HISTORY * 2)
							],
							stream: true,
							temperature: parseFloat(settings.temperature),
							model: settings.modelName
						})
					});

					if (!response.ok) {
						let errorText = `API Error: ${response.status}`;
						try {
							const errorJson = await response.json();
							errorText += ` - ${errorJson.error?.message || JSON.stringify(errorJson)}`;
						} catch (e) {
							const textError = await response.text();
							errorText += ` - ${textError}`;
						}
						throw new Error(errorText);
					}

					const 
						reader = response.body.getReader(),
						decoder = new TextDecoder()
					;

					while (true) {
						const { value, done } = await reader.read();
						if (done) break;

						const chunk = decoder.decode(value);
						const lines = chunk.split('\n');

						for (const line of lines) {
							if (!line || line === 'data: [DONE]') continue;
							if (line.startsWith('data: ')) {
								try {
									const json = JSON.parse(line.slice(6));
									if (json.choices?.[0]?.delta?.content) {
										streamHandler.appendChunk(json.choices[0].delta.content);
									}
								} catch (e) {
									console.error('Error parsing JSON:', e);
								}
							}
						}
					}
				// } // Removed inner try closing brace
			}
		}
	} catch (error) {
		// Ensure stream handler isn't active or completed if fetch failed before starting stream
		if (streamHandler && !streamHandler.messageElement.classList.contains('typing')) {
			// If fetch itself failed (network error, CORS, etc.) or non-ok response
			appendMessage(`Error: ${error.message}`, false, true);
		} else if (streamHandler) {
			// Handle errors during streaming (like AbortError)
			if (error.name === 'AbortError') {
				streamHandler.appendChunk('\n\n*Generation stopped by user*');
			} else {
				// Append error to the existing stream message if streaming had started
				streamHandler.appendChunk(`\n\n\`\`\`error\nError during stream: ${error.message}\n\`\`\``);
			}
			streamHandler.complete(); // Complete the stream even if there was an error
		} else {
			// Fallback for unexpected scenarios
			appendMessage(`Unhandled Error: ${error.message}`, false, true);
		}
	} finally {
		// Ensure stream handler is completed if it exists and hasn't been already
		if (streamHandler && streamHandler.messageElement.classList.contains('typing')) {
			streamHandler.complete();
		}
		currentController = null;
		// Show send button and hide stop button always in finally
		stopButton.classList.add('hidden');
		sendButton.classList.remove('hidden');
	}
}

// Profile Management
function loadProfiles() {
	const 
		profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{"default": {}}'),
		currentProfile = localStorage.getItem(CURRENT_PROFILE_KEY) || 'default'
	;
	
	// Clear existing options
	profileSelector.innerHTML = '';
	
	// Add profiles to selector
	Object.keys(profiles).forEach(profileName => {
		const option = document.createElement('option');
		option.value = profileName;
		option.textContent = profileName;
		profileSelector.appendChild(option);
	});
	
	profileSelector.value = currentProfile;
	loadProfileSettings(currentProfile);
}

function loadProfileSettings(profileName) {
	const
		profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{"default": {}}'),
		settings = profiles[profileName] || {}
	;

	endPoint.value = settings.endPoint || '';
	modelName.value = settings.modelName || '';
	apiKey.value = settings.apiKey || '';
	temperature.value = settings.temperature || '1.0';
	temperatureValue.textContent = temperature.value;
	systemPrompt.value = settings.systemPrompt || '';
	
	// Set language if it exists in profile
	if (settings.language) {
		i18n.setLanguage(settings.language);
		document.getElementById('language-selector').value = settings.language;
	}
}

function saveProfileSettings(e) {
	e.preventDefault();
	const 
		currentProfile = profileSelector.value,
		profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{"default": {}}')
	;

	profiles[currentProfile] = {
		endPoint: endPoint.value,
		modelName: modelName.value,
		apiKey: apiKey.value,
		temperature: temperature.value,
		systemPrompt: systemPrompt.value,
		language: document.getElementById('language-selector').value
	};
	
	localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
	
	const saveButton = document.getElementById('save-settings');
	saveButton.textContent = i18n.translate('setup.saved');
	saveButton.classList.add('saved');
	saveButton.disabled = true;
	
	setTimeout(() => {
		saveButton.textContent = i18n.translate('setup.save');
		saveButton.classList.remove('saved');
		saveButton.disabled = false;
	}, 2000);
}


// UI Management
function toggleSetup() {
	const 
		container = document.querySelector('.container'),
		isVisible = !container.classList.contains('setup-hidden')
	;

	if (isVisible) {
		container.classList.add('setup-hidden');
		setupSection.style.display = 'none';
	} else {
		container.classList.remove('setup-hidden');
		setupSection.style.display = 'block';
	}

	localStorage.setItem(SETUP_VISIBLE_KEY, (!isVisible).toString());
}

// Add event listener for the close button
document.querySelector('.setup-close').addEventListener('click', toggleSetup);

function clearChat() {
	chatMessages.innerHTML = '';
	// Also clear message history when chat is cleared
	messageHistory = [];
}

// Clear input buttons
document.querySelectorAll('.clear-input').forEach(button => {
	button.addEventListener('click', (e) => {
		// Find the input field that's a sibling of this button
		const input = e.target.parentElement.querySelector('input');
		input.value = '';
		input.focus();
	});
});

/**
 * Attempts to detect if the platform is macOS using available methods.
 * Prefers UserAgentData Client Hints if available, falls back to navigator.platform.
 * Note: This determines the OS to *predict* the likely primary shortcut key (Cmd vs Ctrl).
 * @returns {Promise<boolean>} A promise that resolves to true if macOS is detected, false otherwise.
 */
async function isMacOS() {
	// 1. Try the modern User Agent Client Hints API (requires HTTPS)
	// Checks if the API and the specific method exist.
	if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
	try {
		// Request the 'platform' high-entropy value. This asks the browser for more specific info.
		// It's "high entropy" because it helps distinguish users, hence privacy considerations.
		const hints = await navigator.userAgentData.getHighEntropyValues(['platform']);
		if (hints.platform) {
		// Compare the result (e.g., "macOS", "Windows") case-insensitively.
		return hints.platform.toLowerCase() === 'macos';
		}
	} catch (error) {
		// If the promise rejects or there's an error, we fall through to the next method.
	}
	}

	// 2. Fallback to the older navigator.platform (less reliable, deprecating)
	// This is the traditional way, but less accurate and being phased out.
	if (navigator.platform) {
	// Common values for Mac include 'MacIntel', 'MacPPC', 'Macintosh'.
	// We check if the platform string contains 'MAC', case-insensitively.
	return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
	}

	// 3. If neither method provides a result, assume not macOS.
	return false;
}

// Event Listeners
window.addEventListener('load', loadSettings);
// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
	// Set platform-specific send button title
	const 
		isMac = await isMacOS(),
		isMobile = navigator.maxTouchPoints > 0
	;
	
	sendButton.setAttribute('data-i18n-title', 
		isMac ? 'chat.buttons.sendTitleMac' : 'chat.buttons.sendTitlePC'
	);
	textarea.setAttribute('data-i18n-placeholder', 
		isMobile ? 'chat.userInput.placeholder' :
		isMac ? 'chat.userInput.placeholderMac' : 'chat.userInput.placeholderPC'
	);

	// Initialize i18n with URL parameter
	const urlParams = new URLSearchParams(window.location.search);
	await i18n.init(urlParams.get('lang'));

	// Set up language selector
	const languageSelector = document.getElementById('language-selector');
	languageSelector.value = i18n.currentLang;
	loadLanguageContent(i18n.currentLang);
	languageSelector.addEventListener('change', (e) => {
		const newLang = e.target.value;
		i18n.setLanguage(newLang);
		loadLanguageContent(newLang);
	});

	textarea.addEventListener('input', function(){
		this.style.height = 'auto';
		this.style.height = `${this.scrollHeight}px`;
	});

	temperature.addEventListener('input', () => {
		temperatureValue.textContent = temperature.value;
	});

	toggleSetupButton.addEventListener('click', toggleSetup);
	clearChatButton.addEventListener('click', clearChat);
	stopButton.addEventListener('click', () => {
		if (currentController) {
			currentController.abort();
			currentController = null;
		}
		stopButton.classList.add('hidden');
		sendButton.classList.remove('hidden');
	});
	
	sendButton.addEventListener('click', () => {
		const message = userInput.value.trim();
		if (!message) return;

		appendMessage(message, true);
		userInput.value = '';
		sendMessage(message);
	});

	// Remove the Enter-to-send behavior, only allow Ctrl+Enter or Cmd+Enter
	userInput.addEventListener('keydown', (e) => {
		// Only send on Ctrl+Enter or Cmd+Enter
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			sendButton.click();
		}
		// Prevent Enter from submitting the form (no action on plain Enter)
	});

	const introInitiallyVisible = localStorage.getItem(INTRO_VISIBLE_KEY) !== 'false';
	setIntroVisibility(introInitiallyVisible);

	toggleIntroButton.addEventListener('click', () => {
		const isCurrentlyVisible = introSection.classList.contains('hidden') === false;
		setIntroVisibility(!isCurrentlyVisible); // Toggle the state
	});

	// Load profiles
	loadProfiles();
	
	// Profile selector change event
	profileSelector.addEventListener('change', (e) => {
		const profileName = e.target.value;
		localStorage.setItem(CURRENT_PROFILE_KEY, profileName);
		loadProfileSettings(profileName);
	});
	
	// New profile button
	newProfileButton.addEventListener('click', () => {
		const profileName = prompt(i18n.translate('setup.newProfile'))?.trim();
		if (profileName) {
			const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{"default": {}}');
			if (profiles[profileName]) {
				alert(i18n.translate('setup.profileExists'));
				return;
			}
			profiles[profileName] = {};
			localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
			localStorage.setItem(CURRENT_PROFILE_KEY, profileName);
			loadProfiles();
		}
	});
	
	// Delete profile button
	deleteProfileButton.addEventListener('click', () => {
		const currentProfile = profileSelector.value;
		if (currentProfile === 'default') {
			alert(i18n.translate('setup.cannotDelete'));
			return;
		}
		
		if (confirm(`${i18n.translate('setup.confirm')} "${currentProfile}"?`)) {
			const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY));
			delete profiles[currentProfile];
			localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
			localStorage.setItem(CURRENT_PROFILE_KEY, 'default');
			loadProfiles();
		}
	});
	
	setupForm.addEventListener('submit', saveProfileSettings);
});

// Function to toggle trash visibility
const toggleTrashVisibility = () => {
	clearChatButton.style.display = chatMessages.children.length > 0 ? 'flex' : 'none';
};

// Initial visibility check
toggleTrashVisibility();

// Create an observer to watch for changes in chat messages
const observer = new MutationObserver(toggleTrashVisibility);
observer.observe(chatMessages, { childList: true });

async function loadLanguageContent(lang) {
	try {
		const response = await fetch(`/translations/${lang}.html`);
		if (!response.ok) throw new Error(`Content not found for ${lang}`);
		
		const html = await response.text();
		introSection.innerHTML = html;

		// Ensure the section is visible according to its stored state after loading content
		const isVisible = localStorage.getItem(INTRO_VISIBLE_KEY) !== 'false';
		setIntroVisibility(isVisible); // Re-apply visibility state
	} catch (error) {
		console.error('Error loading intro:', error);
		introSection.innerHTML = `<p class="error-message">Failed to load introduction for ${lang}.</p>`; // Display error in the intro section
	}
}

function setIntroVisibility(visible) {
	if (visible) {
		introSection.classList.remove('hidden');
		toggleIntroButton.setAttribute('aria-expanded', 'true');
		toggleIntroButton.classList.remove('collapsed'); // For potential styling
		localStorage.setItem(INTRO_VISIBLE_KEY, 'true');
	} else {
		introSection.classList.add('hidden');
		toggleIntroButton.setAttribute('aria-expanded', 'false');
		toggleIntroButton.classList.add('collapsed'); // For potential styling
		localStorage.setItem(INTRO_VISIBLE_KEY, 'false');
	}
}

// Make sure stop button is hidden by default and only shown when needed
sendButton.classList.remove('hidden');
stopButton.classList.add('hidden');