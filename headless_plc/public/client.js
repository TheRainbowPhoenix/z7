
const API_BASE = '/api';
const POLL_INTERVAL = 100;

const els = {
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    cycleCount: document.getElementById('cycle-count'),
    ladderContainer: document.getElementById('ladder-container'),
    tagsList: document.getElementById('tags-list'),
};

let currentTags = {};

async function init() {
    // Load Ladder Logic HTML
    try {
        const res = await fetch(`${API_BASE}/logic`);
        if (res.ok) {
            els.ladderContainer.innerHTML = await res.text();
        } else {
            els.ladderContainer.innerHTML = '<div class="text-red-500 p-4">Failed to load logic.</div>';
        }
    } catch (e) {
        els.ladderContainer.innerHTML = `<div class="text-red-500 p-4">Error: ${e.message}</div>`;
    }

    // Bind Controls
    els.startBtn.addEventListener('click', () => callApi('/start', 'POST'));
    els.stopBtn.addEventListener('click', () => callApi('/stop', 'POST'));

    // Start Polling
    setInterval(pollState, POLL_INTERVAL);
}

async function callApi(endpoint, method = 'GET', body = null) {
    try {
        const opts = { method };
        if (body) {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.body = JSON.stringify(body);
        }
        await fetch(`${API_BASE}${endpoint}`, opts);
        pollState(); // Immediate update
    } catch (e) {
        console.error("API Error", e);
    }
}

async function pollState() {
    try {
        const res = await fetch(`${API_BASE}/state`);
        if (!res.ok) return;
        const state = await res.json();

        updateUI(state);
    } catch (e) {
        console.error("Polling Error", e);
    }
}

function updateUI(state) {
    // Status
    if (state.status === 'running') {
        els.statusDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
        els.statusText.innerText = 'RUNNING';
        els.statusText.className = 'font-bold text-green-500 text-sm';
        els.startBtn.classList.add('hidden');
        els.stopBtn.classList.remove('hidden');
    } else {
        els.statusDot.className = 'w-2 h-2 rounded-full bg-red-500';
        els.statusText.innerText = 'STOPPED';
        els.statusText.className = 'font-bold text-red-500 text-sm';
        els.startBtn.classList.remove('hidden');
        els.stopBtn.classList.add('hidden');
    }
    els.cycleCount.innerText = state.cycle;

    // Tags
    currentTags = state.tags;
    renderTags(state.tags);
    updateLadderVisualization(state.tags);
}

function renderTags(tags) {
    // Simple diffing could be optimized but full re-render for this demo size is fine?
    // Actually, re-rendering inputs clears focus/state if interacting.
    // We should only create list once or update values.
    // Let's check if list is empty.

    const tagNames = Object.keys(tags).sort();

    // Check if we need to rebuild structure (initial load)
    if (els.tagsList.children.length === 0) {
        els.tagsList.innerHTML = tagNames.map(name => {
            const val = tags[name];
            // Infer type: if val is 0/1 and name implies input/btn?
            // Simple heuristic: we treat everything as toggle-able for simulation purposes here,
            // or we could split inputs vs outputs.
            // For now, render all.
            return `
            <div class="flex items-center justify-between text-sm py-1 border-b border-gray-100" data-tag-row="${name}">
                <span class="font-mono text-gray-700">${name}</span>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400 text-xs val-display">${val}</span>
                    <button class="w-8 h-4 rounded-full bg-gray-200 relative transition-colors focus:outline-none toggle-btn" onclick="toggleTag('${name}')">
                        <div class="w-4 h-4 bg-white rounded-full shadow absolute top-0 left-0 transition-transform toggle-knob"></div>
                    </button>
                </div>
            </div>`;
        }).join('');
    } else {
        // Update existing
        tagNames.forEach(name => {
            const row = els.tagsList.querySelector(`[data-tag-row="${name}"]`);
            if (row) {
                const val = tags[name];
                const display = row.querySelector('.val-display');
                const btn = row.querySelector('.toggle-btn');
                const knob = row.querySelector('.toggle-knob');

                if (display) display.innerText = val;

                const isOn = val !== 0; // Simple boolean check
                if (isOn) {
                    btn.classList.remove('bg-gray-200');
                    btn.classList.add('bg-green-500');
                    knob.classList.add('translate-x-4');
                } else {
                    btn.classList.add('bg-gray-200');
                    btn.classList.remove('bg-green-500');
                    knob.classList.remove('translate-x-4');
                }
            }
        });
    }
}

window.toggleTag = (name) => {
    const currentVal = currentTags[name];
    const newVal = currentVal ? 0 : 1;
    callApi(`/tags/${name}`, 'POST', { value: newVal });
};

function updateLadderVisualization(tags) {
    const elements = document.querySelectorAll('[data-tag]');
    elements.forEach(el => {
        const tagName = el.getAttribute('data-tag');
        const type = el.getAttribute('data-instruction-type');
        const val = tags[tagName];

        let active = false;
        if (val !== undefined) {
            if (type === 'XIO') {
                active = (val === 0);
            } else {
                // XIC, OTE, OTL, OTU
                active = (val !== 0);
            }
        }

        // Apply styles
        // We need to target the internal divs that draw the symbol lines.
        // They use 'bg-slate-400' (lines) and 'border-slate-400' (boxes).
        // We'll traverse children and replace classes.

        const replaceClass = (node, from, to, add) => {
            if (node.classList && node.classList.contains(from)) {
                if (add) {
                    // Toggle
                    if (active) {
                        node.classList.remove(from);
                        node.classList.add(to);
                    } else {
                        node.classList.add(from);
                        node.classList.remove(to);
                    }
                }
            }
            // Recursively check children
            for (let i = 0; i < node.children.length; i++) {
                replaceClass(node.children[i], from, to, add);
            }
        };

        // Note: HTML Generator uses:
        // bg-slate-400 (lines) -> bg-green-500
        // border-slate-400 (box borders) -> border-green-500
        // text-black (tag name) -> text-green-600 (optional)

        replaceClass(el, 'bg-slate-400', 'bg-green-500', true);
        replaceClass(el, 'border-slate-400', 'border-green-500', true);

        // Also highlight tag name?
        const text = el.querySelector('p');
        if (text) {
            if (active) {
                text.classList.remove('text-black');
                text.classList.add('text-green-700', 'font-bold');
            } else {
                text.classList.add('text-black');
                text.classList.remove('text-green-700', 'font-bold');
            }
        }
    });
}

init();
