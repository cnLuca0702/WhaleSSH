let connections = [];
let snippets = [];

// DOM Elements
const connectionListEl = document.getElementById('connection-list');
const emptyStateEl = document.getElementById('empty-state');
const sessionsAreaEl = document.getElementById('sessions-area');
const tabsHeaderEl = document.getElementById('tabs-header');
const terminalsContainerEl = document.getElementById('terminals-container');

const addModal = document.getElementById('add-modal');
const addConnBtn = document.getElementById('add-conn-btn');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const btnSaveConn = document.getElementById('btn-save-conn');
const authTypeSelect = document.getElementById('conn-auth-type');
const groupPassword = document.getElementById('group-password');
const groupKey = document.getElementById('group-key');
const btnSelectKey = document.getElementById('btn-select-key');
const keyPathInput = document.getElementById('conn-key-path');

// Snippet DOM Elements
const snippetBtn = document.getElementById('snippet-btn');
const snippetModal = document.getElementById('snippet-modal');
const snippetListEl = document.getElementById('snippet-list');
const btnNewSnippet = document.getElementById('btn-new-snippet');
const snippetFormArea = document.getElementById('snippet-form-area');
const snipTitleInput = document.getElementById('snip-title');
const snipCommandInput = document.getElementById('snip-command');
const btnSaveSnip = document.getElementById('btn-save-snip');
const btnCancelSnip = document.getElementById('btn-cancel-snip');
const btnCloseSnippetModal = document.getElementById('btn-close-snippet-modal');

// State
let openTabs = [];
let activeTabId = null;

// Initialize
async function init() {
    await loadConnections();
    await loadSnippets();
    renderConnectionList();
    setupEventListeners();
}

async function loadConnections() {
    const data = await window.api.getData('connections');
    if (data) connections = data;
}

async function loadSnippets() {
    const data = await window.api.getData('snippets');
    if (data) snippets = data;
}

async function saveConnections() {
    await window.api.setData('connections', connections);
}

async function saveSnippets() {
    await window.api.setData('snippets', snippets);
}

// UI Renders
function renderConnectionList() {
    connectionListEl.innerHTML = '';
    const searchStr = document.getElementById('search-input').value.toLowerCase();

    connections.filter(c => c.name.toLowerCase().includes(searchStr) || c.host.toLowerCase().includes(searchStr))
        .forEach((conn, index) => {
            const el = document.createElement('div');
            el.className = `connection-item`;
            el.innerHTML = `
      <div class="conn-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
      </div>
      <div class="conn-details">
        <div class="conn-name">${conn.name}</div>
        <div class="conn-sub">${conn.username}@${conn.host}</div>
      </div>
    `;

            el.addEventListener('dblclick', () => openConnectionTab(conn.id));
            connectionListEl.appendChild(el);
        });
}

function updateMainAreaVisibility() {
    if (openTabs.length === 0) {
        emptyStateEl.style.display = 'flex';
        sessionsAreaEl.style.display = 'none';
    } else {
        emptyStateEl.style.display = 'none';
        sessionsAreaEl.style.display = 'flex';
    }
}

// Snippets Functions
window.sendSnippet = function (id) {
    if (!activeTabId) {
        alert("请先打开并选中一个连接窗口");
        return;
    }
    const snip = snippets.find(s => s.id === id);
    if (snip) {
        // Send command with newline to execute implicitly
        window.api.writeSsh(activeTabId, snip.command + '\n');
        snippetModal.style.display = 'none';
    }
}

window.deleteSnippet = async function (id) {
    if (confirm("确定删除这个命令吗？")) {
        snippets = snippets.filter(s => s.id !== id);
        await saveSnippets();
        renderSnippets();
    }
}

function renderSnippets() {
    snippetListEl.innerHTML = '';
    snippets.forEach(snip => {
        const el = document.createElement('div');
        el.className = 'snippet-item';
        el.innerHTML = `
      <div class="snippet-header">
        <span class="snippet-title">${snip.title}</span>
        <div class="snippet-actions"></div>
      </div>
      <div class="snippet-command">${snip.command}</div>
    `;
        const actions = el.querySelector('.snippet-actions');

        const btnUse = document.createElement('button');
        btnUse.title = "使用";
        btnUse.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 2 15 22 11 13 2 9 22 2"></polyline></svg>`;
        btnUse.addEventListener('click', () => {
            if (!activeTabId) {
                alert("请先打开并选中一个连接窗口");
                return;
            }
            window.api.writeSsh(activeTabId, snip.command);
            snippetModal.style.display = 'none';
        });

        const btnDelete = document.createElement('button');
        btnDelete.title = "删除 (Delete)";
        btnDelete.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        btnDelete.addEventListener('click', () => deleteSnippet(snip.id));

        actions.appendChild(btnUse);
        actions.appendChild(btnDelete);
        snippetListEl.appendChild(el);
    });
}

// Tab && Terminal Management
function openConnectionTab(connId) {
    const config = connections.find(c => c.id === connId);
    if (!config) return;

    const tabId = `tab_${Date.now()}`;
    const tab = { id: tabId, connId, name: config.name, status: 'connecting', term: null, fitAddon: null };
    openTabs.push(tab);

    // Render Tab
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.id = `header-${tabId}`;
    tabEl.innerHTML = `
    <div class="status-dot connecting" id="status-${tabId}"></div>
    <div class="tab-title">${config.name}</div>
    <button class="tab-close" data-id="${tabId}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

    tabEl.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) switchTab(tabId);
    });

    tabEl.querySelector('.tab-close').addEventListener('click', () => closeTab(tabId));
    tabsHeaderEl.appendChild(tabEl);

    // Render Terminal Container
    const termWrapper = document.createElement('div');
    termWrapper.className = 'terminal-wrapper';
    termWrapper.id = `termwrap-${tabId}`;
    termWrapper.style.width = '100%';
    termWrapper.style.height = '100%';
    terminalsContainerEl.appendChild(termWrapper);

    updateMainAreaVisibility();
    switchTab(tabId);

    // Give DOM time to reflow before initializing xterm
    setTimeout(() => {
        // Init xterm
        const term = new window.Terminal({
            cursorBlink: true,
            theme: {
                background: '#000000',
                foreground: '#e0e0e0',
                cursor: '#2196F3'
            },
            fontFamily: 'monospace'
        });

        const fitAddon = new window.FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termWrapper);

        tab.term = term;
        tab.fitAddon = fitAddon;

        fitAddon.fit();

        // Terminal lifecycle
        term.onData(data => {
            if (data) window.api.writeSsh(tabId, data);
        });

        term.onBinary(data => {
            if (data) window.api.writeSsh(tabId, data);
        });

        term.onResize(size => {
            if (size && size.cols && size.rows) {
                window.api.resizeSsh(tabId, size.cols, size.rows);
            }
        });

        // Actually connect SSH after terminal is ready
        startSshSession(tab, config);
    }, 100);
}

function switchTab(tabId) {
    activeTabId = tabId;
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.terminal-wrapper').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    const hEl = document.getElementById(`header-${tabId}`);
    if (hEl) hEl.classList.add('active');
    const tEl = document.getElementById(`termwrap-${tabId}`);
    if (tEl) {
        tEl.style.display = 'block';
        tEl.classList.add('active');
    }

    const tab = openTabs.find(t => t.id === tabId);
    if (tab && tab.fitAddon) {
        // Need a tiny timeout to allow DOM layout updates before fitting
        setTimeout(() => {
            try {
                tab.fitAddon.fit();
            } catch (e) { console.error(e); }
            if (tab.term) tab.term.focus();
        }, 50);
    }
}

// Global Resize Listener for Terminal
window.addEventListener('resize', () => {
    if (activeTabId) {
        const tab = openTabs.find(t => t.id === activeTabId);
        if (tab && tab.fitAddon) {
            try {
                tab.fitAddon.fit();
            } catch (e) { }
        }
    }
});

function closeTab(tabId) {
    window.api.disconnectSsh(tabId);
    openTabs = openTabs.filter(t => t.id !== tabId);

    document.getElementById(`header-${tabId}`)?.remove();
    document.getElementById(`termwrap-${tabId}`)?.remove();

    if (activeTabId === tabId) {
        if (openTabs.length > 0) {
            switchTab(openTabs[openTabs.length - 1].id);
        } else {
            activeTabId = null;
        }
    }
    updateMainAreaVisibility();
}

// SSH Connection Logic
function startSshSession(tab, config) {
    tab.term.writeln(`\x1b[33mConnecting to ${config.host}...\x1b[0m`);

    let cleanupData = () => { };
    let cleanupClose = () => { };

    window.api.connectSsh(config, tab.id)
        .then(() => {
            // Connected
            const statusDot = document.getElementById(`status-${tab.id}`);
            if (statusDot) {
                statusDot.className = 'status-dot connected';
            }

            tab.fitAddon.fit();

            // Setup Listeners
            cleanupData = window.api.onSshData(tab.id, data => {
                tab.term.write(data);
            });

            cleanupClose = window.api.onSshClosed(tab.id, () => {
                const dot = document.getElementById(`status-${tab.id}`);
                if (dot) dot.className = 'status-dot';
                tab.term.writeln('\r\n\x1b[31mConnection closed.\x1b[0m');
            });

        })
        .catch(err => {
            console.error("SSH Connect Error:", err);
            const statusDot = document.getElementById(`status-${tab.id}`);
            if (statusDot) statusDot.className = 'status-dot';
            try {
                tab.term.writeln(`\r\n\x1b[31mError: ${err}\x1b[0m`);
            } catch (e) { console.error("Term write failed", e); }
        });
}

// Event Listeners setup
function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', renderConnectionList);

    addConnBtn.addEventListener('click', () => {
        // Reset form
        document.getElementById('conn-name').value = '';
        document.getElementById('conn-host').value = '';
        document.getElementById('conn-port').value = '22';
        document.getElementById('conn-username').value = '';
        authTypeSelect.value = 'password';
        document.getElementById('conn-password').value = '';
        keyPathInput.value = '';

        authTypeSelect.dispatchEvent(new Event('change'));
        addModal.style.display = 'flex';
    });

    btnCancelAdd.addEventListener('click', () => {
        addModal.style.display = 'none';
    });

    authTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'password') {
            groupPassword.style.display = 'block';
            groupKey.style.display = 'none';
        } else {
            groupPassword.style.display = 'none';
            groupKey.style.display = 'block';
        }
    });

    btnSelectKey.addEventListener('click', async () => {
        const path = await window.api.selectKeyFile();
        if (path) {
            keyPathInput.value = path;
        }
    });

    btnSaveConn.addEventListener('click', async () => {
        const name = document.getElementById('conn-name').value;
        const host = document.getElementById('conn-host').value;
        const port = document.getElementById('conn-port').value || 22;
        const username = document.getElementById('conn-username').value;
        const authType = authTypeSelect.value;
        const password = document.getElementById('conn-password').value;
        const privateKeyPath = keyPathInput.value;

        if (!name || !host || !username || (authType === 'password' && !password) || (authType === 'key' && !privateKeyPath)) {
            alert("请填写完整的表单信息");
            return;
        }

        const id = Date.now().toString();
        connections.push({ id, name, host, port: parseInt(port), username, authType, password, privateKeyPath });

        await saveConnections();
        renderConnectionList();
        addModal.style.display = 'none';
    });

    // Snippets Event Listeners
    snippetBtn.addEventListener('click', () => {
        renderSnippets();
        snippetFormArea.style.display = 'none';
        snippetModal.style.display = 'flex';
    });

    btnCloseSnippetModal.addEventListener('click', () => {
        snippetModal.style.display = 'none';
    });

    btnNewSnippet.addEventListener('click', () => {
        snipTitleInput.value = '';
        snipCommandInput.value = '';
        snippetFormArea.style.display = 'block';
    });

    btnCancelSnip.addEventListener('click', () => {
        snippetFormArea.style.display = 'none';
    });

    btnSaveSnip.addEventListener('click', async () => {
        const title = snipTitleInput.value.trim();
        const command = snipCommandInput.value.trim();
        if (!title || !command) {
            alert("标题和命令不能为空");
            return;
        }

        snippets.push({
            id: Date.now().toString(),
            title,
            command
        });

        await saveSnippets();
        renderSnippets();
        snippetFormArea.style.display = 'none';
    });

    window.addEventListener('resize', () => {
        if (activeTabId) {
            const tab = openTabs.find(t => t.id === activeTabId);
            if (tab && tab.fitAddon) tab.fitAddon.fit();
        }
    });
}

// Start
init();
