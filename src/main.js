const PROJECTS = {
    workflow: {
        name: "Easy Workflow",
        url: "https://easyworkflowpro-default-rtdb.firebaseio.com",
        color: "#8b5cf6"
    },
    captions: {
        name: "Auto Captions Pro",
        url: "https://autocaptionspro-default-rtdb.firebaseio.com",
        color: "#10b981"
    }
};

const MASTER_KEY = "HARSH2026";

let activeProject = localStorage.getItem('active_project') || 'workflow';
let allUserData = {};
let currentView = 'dashboard';
let selectedUserEmail = null;

// --- AUTH LOGIC ---
const authWall = document.getElementById('auth-wall');
const authBtn = document.getElementById('auth-btn');
const authInput = document.getElementById('master-key-input');

// Check Session on startup
if (localStorage.getItem('admin_authenticated') === 'true') {
    authWall.style.display = 'none';
    initApp();
}

authBtn.onclick = () => {
    if (authInput.value === MASTER_KEY) {
        localStorage.setItem('admin_authenticated', 'true');
        authWall.style.display = 'none';
        initApp();
    } else {
        authInput.style.borderColor = 'var(--accent-red)';
        setTimeout(() => authInput.style.borderColor = '', 1000);
    }
};

document.getElementById('logout-admin-btn').onclick = () => {
    if (!confirm("Lock the Command Center and logout?")) return;
    localStorage.removeItem('admin_authenticated');
    authWall.style.display = 'flex';
    authInput.value = '';
};

// --- NAVIGATION ---
function initApp() {
    setupNavigation();
    setupProjectSwitcher();
    updateDateTime();
    setInterval(updateDateTime, 60000);

    fetchData();
    setInterval(fetchData, 45000); // 45s refresh
}

function setupProjectSwitcher() {
    document.querySelectorAll('.proj-pill').forEach(pill => {
        const id = pill.getAttribute('data-proj');
        if (id === activeProject) pill.classList.add('active');
        else pill.classList.remove('active');

        pill.onclick = () => {
            if (activeProject === id) return;
            activeProject = id;
            localStorage.setItem('active_project', id);

            // UI Update
            document.querySelectorAll('.proj-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Set Color Theme
            document.documentElement.style.setProperty('--accent-purple', PROJECTS[id].color);

            // Refresh
            allUserData = {};
            selectedUserEmail = null;
            document.getElementById('user-details-panel').style.display = 'none';
            updateColumnVisibility();
            fetchData();
        };
    });

    // Set initial color
    document.documentElement.style.setProperty('--accent-purple', PROJECTS[activeProject].color);
    updateColumnVisibility();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = (e) => {
            const requestedView = link.getAttribute('data-view');
            switchView(requestedView);

            document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
            link.classList.add('active');
        };
    });
}

function switchView(viewId) {
    currentView = viewId;
    document.getElementById('view-title').innerText = viewId.toUpperCase().replace('-', ' ');

    // Toggle Search visibility (only for User Base)
    document.getElementById('global-search-container').style.display = (viewId === 'user-base') ? 'flex' : 'none';

    document.querySelectorAll('.content-view').forEach(v => v.style.display = 'none');
    document.getElementById('view-' + viewId).style.display = 'block';

    renderCurrentView();
}

// --- DATA LOGIC ---
async function fetchData() {
    try {
        const FIREBASE_URL = PROJECTS[activeProject].url;
        const res = await fetch(`${FIREBASE_URL}/users.json`);
        if (!res.ok) { document.getElementById('rule-error').style.display = 'flex'; return; }

        allUserData = await res.json() || {};
        document.getElementById('rule-error').style.display = 'none';

        processAnalytics();
        renderCurrentView();
    } catch (err) { console.error("Firebase Sync Error", err); }
}

function decodeEmail(id) {
    if (!id || id === 'config') return id;

    // 1. If it contains @, it's the new safe email format (test@gmail_com)
    if (id.includes('@')) {
        return id.replace(/_/g, '.');
    }

    // 2. Try Base64 decode for older obfuscated system keys (Legacy)
    try {
        if (/^[A-Za-z0-9+/=]{15,}$/.test(id)) {
            let decoded = atob(id);
            if (decoded.includes('@')) {
                // Return clean email part, removing any binary machine ID suffix
                return decoded.replace(/[^a-zA-Z0-9@\._-]/g, '').split(/[A-Z0-9]{8,}/)[0];
            }
        }
    } catch (e) { }

    // 3. Fallback: just swap underscores for dots
    return id.replace(/_/g, '.');
}

function updateColumnVisibility() {
    const isWorkflow = (activeProject === 'workflow');
    
    // Show time spent only for Workflow project
    document.querySelectorAll('.col-time').forEach(el => {
        el.style.display = isWorkflow ? '' : 'none';
    });
    
    // Always hide activity (clicks) as per user request
    document.querySelectorAll('.col-activity').forEach(el => {
        el.style.display = 'none';
    });
}

function processAnalytics() {
    const userEmails = Object.keys(allUserData).filter(k => k !== 'config');
    document.getElementById('val-total-users').innerText = userEmails.length;

    let deviceCount = 0;
    let presetCount = 0;
    let activityLog = [];

    userEmails.forEach(email => {
        const data = allUserData[email];
        Object.keys(data).forEach(k => {
            if (k.startsWith('device_') || k.startsWith('dev_')) {
                deviceCount++;
                const dev = data[k];
                activityLog.push({
                    email: decodeEmail(email),
                    pc: dev.name,
                    time: dev.lastLogin || 0
                });
            }
        });
        // Legacy Support: Check if user node is itself a device record
        if (data.name && data.lastLogin) {
            deviceCount++;
            activityLog.push({
                email: decodeEmail(email),
                pc: data.name,
                time: data.lastLogin
            });
        }
        if (data.config && data.config.customPresets) {
            presetCount += data.config.customPresets.length;
        }
    });

    document.getElementById('val-total-devices').innerText = deviceCount;
    document.getElementById('val-total-presets').innerText = presetCount;

    // Update Circle
    const pct = Math.min(100, (presetCount / 200) * 100);
    document.getElementById('circle-usage').style.strokeDashoffset = 251.2 - (251.2 * pct / 100);
    document.getElementById('usage-pct').innerText = Math.round(pct) + "%";

    // Dashboard Recent Activity (Login tracking)
    const activityContainer = document.getElementById('activity-list');
    activityContainer.innerHTML = '';
    activityLog.sort((a, b) => b.time - a.time).slice(0, 5).forEach(act => {
        const div = document.createElement('div');
        div.className = 'device-row';
        div.style.padding = '10px 0';
        div.innerHTML = `
            <div style="flex:1; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:12px;"><b>${act.email.split('@')[0]}</b> - ${act.pc}</div>
                <div style="font-size:10px; color:#555;">${formatTime(act.time)}</div>
            </div>
        `;
        activityContainer.appendChild(div);
    });
    renderLocations();
}

function renderLocations() {
    const container = document.getElementById('location-map-container');
    if (!container) return;

    const locMap = {};
    Object.keys(allUserData).forEach(email => {
        const data = allUserData[email];
        Object.keys(data).forEach(k => {
            if (k.startsWith('device_') || k.startsWith('dev_')) {
                const loc = data[k].location || "Worldwide";
                locMap[loc] = (locMap[loc] || 0) + 1;
            }
        });
    });

    container.innerHTML = '';
    Object.entries(locMap).sort((a, b) => b[1] - a[1]).forEach(([loc, count]) => {
        const div = document.createElement('div');
        div.className = 'stat-card';
        div.style.padding = '15px';
        div.style.background = 'rgba(255,255,255,0.02)';
        div.innerHTML = `
            <div style="font-size:10px; color:#555; text-transform:uppercase;">${loc.split('/').pop().replace(/_/g, ' ')}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div style="font-size:18px; font-weight:800; color:var(--accent-cyan);">${count}</div>
                <div style="font-size:8px; color:#333;">ACTIVE UNITS</div>
            </div>
        `;
        container.appendChild(div);
    });
}



function renderCurrentView() {
    if (currentView === 'user-base') renderUserBase();
    if (currentView === 'settings') renderSettings();
}

function renderUserBase() {
    const body = document.getElementById('user-base-body');
    const search = document.getElementById('user-search').value.toLowerCase();
    const isWorkflow = (activeProject === 'workflow');
    body.innerHTML = '';

    const userEmails = Object.keys(allUserData)
        .filter(k => k !== 'config')
        .sort((a, b) => {
            if (allUserData[b].lastSeen && allUserData[a].lastSeen) return allUserData[b].lastSeen - allUserData[a].lastSeen;
            return (allUserData[b].totalClicks || 0) - (allUserData[a].totalClicks || 0);
        });

    userEmails.forEach(safeEmail => {
        const decodedEmail = decodeEmail(safeEmail);
        const data = allUserData[safeEmail];

        let mainDevice = "Unknown";
        let devCount = 0;
        let lastTime = 0;
        let gumroadKey = data.licenseKey || "---";

        Object.keys(data).forEach(k => {
            if (k.startsWith('device_') || k.startsWith('dev_')) {
                devCount++;
                mainDevice = data[k].name || "PC";
                lastTime = Math.max(lastTime, data[k].lastLogin || data[k].lastActive || 0);
                if (data[k].licenseKey && data[k].licenseKey !== "---") gumroadKey = data[k].licenseKey;
            }
        });

        if (search && !decodedEmail.toLowerCase().includes(search) && !mainDevice.toLowerCase().includes(search) && !gumroadKey.toLowerCase().includes(search)) return;

        const activityCount = data.totalClicks || 0;
        const totalSecs = data.totalSeconds || 0;
        const timeStr = formatSecondsShort(totalSecs);

        const tr = document.createElement('tr');
        tr.className = 'device-row';
        if (selectedUserEmail === safeEmail) tr.style.background = 'rgba(255, 255, 255, 0.05)';
        tr.onclick = () => selectUser(safeEmail);

        tr.innerHTML = `
            <td><b style="word-break:break-all;">${decodedEmail}</b></td>
            <td style="color:var(--accent-purple); font-family:monospace; font-size:11px;">${gumroadKey}</td>
            <td class="col-activity" style="display:none; color:var(--accent-cyan); font-weight:800;">${activityCount} CLICKS</td>
            <td class="col-time" style="display:${isWorkflow ? '' : 'none'}; color:var(--accent-orange); font-weight:800;">${timeStr}</td>
            <td style="font-size:11px;">${mainDevice}</td>
            <td style="color:var(--accent-cyan); font-weight:800; font-size:10px;">${devCount} UNIT(S)</td>
            <td style="font-size:10px; color:#555;">${lastTime ? formatTime(lastTime) : '--'}</td>
        `;
        body.appendChild(tr);
    });
}

function selectUser(safeEmail) {
    selectedUserEmail = safeEmail;
    renderUserBase(); // Refresh highlight

    const panel = document.getElementById('user-details-panel');
    const content = document.getElementById('inspector-content');
    panel.style.display = 'block';

    const userData = allUserData[safeEmail];
    const email = safeEmail.replace(/_/g, '.');
    // List Devices
    let deviceHTML = '';
    Object.keys(userData).forEach(k => {
        if (k.startsWith('device_') || k.startsWith('dev_')) {
            const d = userData[k];
            deviceHTML += `
                <div class="device-row" style="background:rgba(255,255,255,0.02); padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #1a1a1a;">
                    <div>
                        <div style="font-size:12px; font-weight:700;">${d.name || 'Unknown PC'}</div>
                        <div style="font-size:9px; color:#555;">${k} • ${d.location || 'Unknown'}</div>
                        <div style="font-size:9px; color:var(--accent-purple);">${d.licenseKey || 'No Key'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px; color:#555;">${formatTime(d.lastLogin || d.lastActive || 0)}</div>
                        <button onclick="forceLogout('${safeEmail}', '${k}')" style="background:#400; color:#f55; border:none; padding:4px 8px; border-radius:4px; font-size:9px; font-weight:bold; margin-top:5px; cursor:pointer;">LOGOUT</button>
                    </div>
                </div>
            `;
        }
    });

    let gumroadKey = userData.licenseKey || "---";
    Object.keys(userData).forEach(k => {
        if ((k.startsWith('device_') || k.startsWith('dev_')) && (userData[k].licenseKey && userData[k].licenseKey !== "---")) {
            gumroadKey = userData[k].licenseKey;
        }
    });

    let apiKeysHTML = "";
    if (userData.apiKeys) {
        let keysArr = [];
        if (Array.isArray(userData.apiKeys)) keysArr = userData.apiKeys;
        else if (typeof userData.apiKeys === 'string') {
            try {
                // If it looks like a JSON array string
                if (userData.apiKeys.startsWith('[')) keysArr = JSON.parse(userData.apiKeys);
                else keysArr = userData.apiKeys.split(',').map(k => k.trim());
            } catch (e) {
                keysArr = [userData.apiKeys]; // Fallback as single string
            }
        }

        if (keysArr.length > 0) {
            apiKeysHTML = `
                <label style="font-size:10px; font-weight:800; color:#444;">CLOUD STORED API KEYS</label>
                <div style="background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.1); border-radius:8px; padding:10px; margin: 10px 0 20px 0;">
                    ${keysArr.map(k => `<div style="font-family:monospace; font-size:10px; color:#10b981; padding:2px 0; word-break:break-all;">${k}</div>`).join('')}
                </div>
            `;
        }
    }

    const isWorkflow = (activeProject === 'workflow');
    content.innerHTML = `
        <div class="user-main-info" style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; margin-bottom:20px;">
            <div style="font-size:11px; color:#555;">USER CLOUD ID</div>
            <div style="font-size:14px; font-weight:800; color:var(--accent-purple); word-break:break-all; margin-bottom:12px;">${decodeEmail(email)}</div>
            
            <div style="display:${isWorkflow ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; border-bottom:1px solid #222; padding-bottom:15px;">
                <div>
                   <div style="font-size:9px; color:#555; text-transform:uppercase;">Today's Focus</div>
                   <div style="font-size:14px; font-weight:800; color:#eee;">${((userData.analytics?.todaySeconds || 0) / 3600).toFixed(1)} hrs</div>
                </div>
                <div style="text-align:right;">
                   <div style="font-size:9px; color:#555; text-transform:uppercase;">Weekly Total</div>
                   <div style="font-size:14px; font-weight:800; color:#eee;">${((userData.analytics?.weekSeconds || 0) / 3600).toFixed(1)} hrs</div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div>
                   <div style="font-size:11px; color:#555;">GUMROAD LICENSE</div>
                   <div style="font-size:12px; font-family:monospace; color:#aaa; word-break:break-all; max-width:180px;">${gumroadKey}</div>
                </div>
                <div style="text-align:right; display:${isWorkflow ? '' : 'none'};">
                   <div style="font-size:11px; color:#555;">LIFETIME USE</div>
                   <div style="font-size:12px; font-weight:800; color:var(--accent-orange);">${formatSeconds(userData.totalSeconds || 0)}</div>
                </div>
            </div>
        </div>

        <div style="display:none;">
            <label style="font-size:10px; font-weight:800; color:#444;">RECENT CLOUD ACTIVITY</label>
            <div style="max-height: 150px; overflow-y: auto; background:rgba(0,0,0,0.2); border-radius:8px; padding:10px; margin: 10px 0 20px 0;">
                ${renderRecentActivity(userData.activity)}
            </div>
        </div>
        
        <label style="font-size:10px; font-weight:800; color:#444;">LINKED HARDWARE</label>
        <div style="margin: 10px 0 20px 0;">${deviceHTML || '<p style="color:#555; font-size:11px; font-style:italic;">No active hardware detected</p>'}</div>

        ${apiKeysHTML}

        <label style="font-size:10px; font-weight:800; color:#444;">ADMIN RECORDS</label>
        <textarea id="user-notes" class="dark-input" style="height:120px; font-size:12px; margin-bottom:10px;">${userData.adminNotes || ""}</textarea>
        <button onclick="saveUserNotes('${safeEmail}')" id="note-save-btn" class="btn-primary" style="width:100%; padding:12px;">SAVE RECORDS</button>
    `;
}

// --- GLOBAL ACTIONS ---


async function forceLogout(email, devId) {
    if (!confirm("Disconnect this device? User will be logged out instantly.")) return;
    const FIREBASE_URL = PROJECTS[activeProject].url;
    await fetch(`${FIREBASE_URL}/users/${email}/${devId}.json`, { method: 'DELETE' });
    fetchData();
}

async function saveUserNotes(email) {
    const notes = document.getElementById('user-notes').value;
    const btn = document.getElementById('note-save-btn');
    btn.innerText = "SAVING...";
    const FIREBASE_URL = PROJECTS[activeProject].url;
    await fetch(`${FIREBASE_URL}/users/${email}/adminNotes.json`, {
        method: 'PUT',
        body: JSON.stringify(notes)
    });
    allUserData[email].adminNotes = notes;
    btn.innerText = "SUCCESS";
    setTimeout(() => btn.innerText = "SAVE RECORDS", 2000);
}

// --- SETTINGS VIEW ---
async function renderSettings() {
    const FIREBASE_URL = PROJECTS[activeProject].url;
    const res = await fetch(`${FIREBASE_URL}/config/global.json`);
    const cfg = await res.json() || {};

    document.getElementById('set-version').value = cfg.version || "";
    document.getElementById('set-discord').value = cfg.discord || "";
    document.getElementById('set-youtube').value = cfg.youtube || "";
    document.getElementById('set-news').value = cfg.announcement || "";
}

document.getElementById('save-settings-btn').onclick = async () => {
    const btn = document.getElementById('save-settings-btn');
    btn.innerText = "PUSHING UPDATE...";

    const cfg = {
        version: document.getElementById('set-version').value,
        discord: document.getElementById('set-discord').value,
        youtube: document.getElementById('set-youtube').value,
        announcement: document.getElementById('set-news').value,
        lastUpdated: Date.now()
    };

    const FIREBASE_URL = PROJECTS[activeProject].url;
    await fetch(`${FIREBASE_URL}/config/global.json`, {
        method: 'PUT',
        body: JSON.stringify(cfg)
    });

    btn.innerText = "SYSTEM UPDATED ✓";
    setTimeout(() => btn.innerText = "PUSH UPDATE TO ALL USERS", 3000);
};

// --- ANALYTICS HELPERS ---
function renderRecentActivity(activityObj) {
    if (!activityObj) return '<p style="color:#444; font-size:11px;">No recent actions</p>';
    const items = Object.values(activityObj).sort((a, b) => b.t - a.t).slice(0, 15);
    return items.map(i => `
        <div style="display:flex; justify-content:space-between; font-size:10px; border-bottom:1px solid #222; padding:4px 0;">
            <span style="color:#ccc;">${i.b}</span>
            <span style="color:#555;">${new Date(i.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `).join('');
}

// --- HELPERS ---
function formatTime(ts) {
    if (!ts) return "---";
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "Just Now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return new Date(ts).toLocaleDateString();
}

function formatSeconds(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h} hrs ${m} mins`;
}

function formatSecondsShort(s) {
    const h = (s / 3600).toFixed(1);
    return `${h} HOURS`;
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('current-date').innerText = now.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    }) + " | " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

document.getElementById('user-search').oninput = () => renderUserBase();

// Expose globals for onclicks

window.forceLogout = forceLogout;
window.saveUserNotes = saveUserNotes;
window.selectUser = selectUser;
