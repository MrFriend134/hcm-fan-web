
const SECRET = "arturodeveloperelmejorxd";

// --- CONFIGURACIÓN DE BASE DE DATOS GLOBAL (Gun.js) ---
// Usamos servidores relay públicos para que los datos viajen entre dispositivos
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://libros.xyz/gun']);
const globalPosts = gun.get('hcm29_global_feed_v1');
const globalEvents = gun.get('hcm29_global_events_v1');

// Recuperar sesión local
let user = JSON.parse(localStorage.getItem('hcm29_session')) || null;
let localPosts = []; // Cache local para renderizado rápido

// DOM References
const loginView = document.getElementById('login-container');
const dashView = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const postForm = document.getElementById('form-post');
const fileInput = document.getElementById('post-file');
const fileNameDisplay = document.getElementById('file-name');
const feedEl = document.getElementById('feed-items');
const eventsEl = document.getElementById('list-events');
const eventEditor = document.getElementById('event-editor');

// --- INICIALIZACIÓN ---
window.addEventListener('load', () => {
    if (user) {
        enterPortal();
    } else {
        loginView.classList.remove('hidden');
    }
    initGlobalListeners();
});

// Sincronización Global en Tiempo Real
function initGlobalListeners() {
    // Escuchar Posts Globales
    globalPosts.map().on((data, id) => {
        if (!data) return;
        // Evitar duplicados en el feed visual
        const existing = document.getElementById(`post-${id}`);
        if (!existing) {
            renderSinglePost(data, id);
        }
    });

    // Escuchar Eventos de Calendario Globales
    globalEvents.map().on((data, id) => {
        if (!data) {
            // Si el data es nulo, significa que se borró
            const el = document.getElementById(`ev-${id}`);
            if (el) el.remove();
            return;
        }
        updateCalendarUI(data, id);
    });
}

// Auth
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name-input').value;
    const adminVal = document.getElementById('admin-input').value;
    
    user = {
        name: name,
        role: adminVal === SECRET ? 'ADMIN' : 'ALUMNO'
    };
    
    localStorage.setItem('hcm29_session', JSON.stringify(user));
    enterPortal();
});

function enterPortal() {
    loginView.classList.add('hidden');
    dashView.classList.remove('hidden');
    
    document.getElementById('user-display-name').textContent = user.name;
    document.getElementById('user-display-role').textContent = user.role;
    
    if(user.role === 'ADMIN') {
        document.getElementById('admin-controls').classList.remove('hidden');
        document.getElementById('btn-add-event').classList.remove('hidden');
        setupAdminActions();
    }
    
    setupMenu();
}

function setupMenu() {
    const menuItems = document.querySelectorAll('.menu-item');
    const views = document.querySelectorAll('.content-view');

    menuItems.forEach(item => {
        item.onclick = () => {
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');
            const target = item.getAttribute('data-view');
            views.forEach(v => {
                v.id === `view-${target}` ? v.classList.remove('hidden') : v.classList.add('hidden');
            });
        };
    });
}

function setupAdminActions() {
    document.getElementById('btn-admin-manage').onclick = () => {
        alert("SISTEMA GLOBAL ACTIVO\nLos datos se están sincronizando mediante nodos P2P.");
    };
    
    document.getElementById('btn-admin-clear').onclick = () => {
        if(confirm("¿Seguro que quieres limpiar el feed global?")) {
            globalPosts.map().once((data, id) => {
                globalPosts.get(id).put(null);
            });
            location.reload();
        }
    };
}

document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('hcm29_session');
    location.reload();
};

// --- LOGICA DE POSTS ---
fileInput.onchange = () => {
    fileNameDisplay.textContent = fileInput.files[0] ? fileInput.files[0].name : "";
};

postForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = document.getElementById('post-text').value;
    const file = fileInput.files[0];
    
    if(!text && !file) return;

    let fileData = null;
    let fileName = null;
    let fileType = null;

    if(file) {
        // Limitamos a archivos pequeños para el demo P2P
        if(file.size > 500000) {
            alert("El archivo es muy grande para la red global (máximo 500KB).");
            return;
        }
        fileName = file.name;
        fileType = file.type;
        fileData = await fileToBase64(file);
    }

    const postID = Date.now().toString();
    globalPosts.get(postID).put({
        author: user.name,
        content: text || "",
        fileName: fileName || "",
        fileType: fileType || "",
        fileData: fileData || "",
        date: new Date().toISOString()
    });

    postForm.reset();
    fileNameDisplay.textContent = "";
};

function renderSinglePost(p, id) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-${id}`;
    
    let attachment = '';
    if(p.fileData) {
        if(p.fileType.startsWith('image/')) {
            attachment = `<img src="${p.fileData}" class="p-img">`;
        } else {
            attachment = `
                <div class="p-file">
                    <span>📄 ${p.fileName}</span>
                    <a href="${p.fileData}" download="${p.fileName}" class="p-dl">Descargar</a>
                </div>
            `;
        }
    }

    card.innerHTML = `
        <div class="post-head">
            <div class="p-avatar">${p.author ? p.author[0].toUpperCase() : '?'}</div>
            <div class="p-info">
                <h4>${p.author}</h4>
                <time>${new Date(p.date).toLocaleString()}</time>
            </div>
        </div>
        <p class="p-content">${p.content}</p>
        ${attachment}
    `;
    
    // Insertar al inicio del feed
    feedEl.prepend(card);
}

// --- CALENDARIO ---
document.getElementById('btn-add-event').onclick = () => eventEditor.classList.toggle('hidden');

document.getElementById('btn-save-event').onclick = () => {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    if(!title || !date) return;
    
    const evID = Date.now().toString();
    globalEvents.get(evID).put({ title, date });

    document.getElementById('ev-title').value = '';
    document.getElementById('ev-date').value = '';
    eventEditor.classList.add('hidden');
};

function updateCalendarUI(ev, id) {
    let existing = document.getElementById(`ev-${id}`);
    if (existing) existing.remove();

    const d = new Date(ev.date + "T00:00:00");
    const item = document.createElement('div');
    item.className = 'ev-item';
    item.id = `ev-${id}`;
    item.innerHTML = `
        <div class="ev-date">
            <span class="ev-m">${d.toLocaleString('es', {month:'short'})}</span>
            <span class="ev-d">${d.getDate()}</span>
        </div>
        <div class="ev-data">
            <h4>${ev.title}</h4>
            <p>Sincronizado Global</p>
        </div>
    `;
    eventsEl.appendChild(item);
}

// Utils
function fileToBase64(file) {
    return new Promise((r, j) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => r(reader.result);
        reader.onerror = e => j(e);
    });
}
