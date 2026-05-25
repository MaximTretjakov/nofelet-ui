// --- ЛОГИКА WEBSOCKET ЧАТА ---
const urlParams = new URLSearchParams(window.location.search);
const chatUuid = urlParams.get('uuid');
const activeParticipants = new Map(); // ID -> Nickname
let currentRecipient = "all"; // "all" или ID пользователя

function chatInit(chatUuid){
    if (!chatUuid) {
        console.error("UUID не найден в URL");
    } else {
        const chatSocket = new WebSocket(`wss://nofelet.duckdns.org:8444/chat/${chatUuid}`);

        chatSocket.onopen = () => {
            console.log("Чат подключен");
            const nick = sessionStorage.getItem('myNickname') || 'Аноним';
            sendChatEvent("join", { chat_id: chatUuid, nick: nick });
        };

        chatSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ping') {
                    sendChatEvent('pong', {});
                } else if (data.type === 'message') {
                    appendMessage(data.payload.sender, data.payload.content, false);
                }
            } catch (e) {
                console.error("Ошибка парсинга сообщения:", e);
            }
        };

        chatSocket.onerror = (e) => console.error("Ошибка чата:", e);

        // Функция отправки
        function sendChatEvent(type, payload) {
            if (chatSocket.readyState === WebSocket.OPEN) {
                chatSocket.send(JSON.stringify({ type: type, payload: payload }));
            }
        }

        // Обработка набора текста (typing)
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('input', () => {
            sendChatEvent("typing", { chat_id: chatUuid, is_typing: true });
        });

        // Обработка отправки сообщения
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (text && chatSocket.readyState === WebSocket.OPEN) {
                sendChatEvent("message", {
                    chat_id: chatUuid,
                    sender: sessionStorage.getItem('myNickname') || 'Аноним',
                    recipient: currentRecipient,
                    content: text
                });
                appendMessage('Вы', text, true);
                chatInput.value = '';
            } else if (chatSocket.readyState !== WebSocket.OPEN) {
                alert("Соединение с чатом потеряно!");
            }
        });
    }
}

function appendMessage(author, text, isMe) {
    const container = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMe ? 'me' : 'other'}`;
    msgDiv.innerHTML = `
        <div class="message-author">${author}</div>
        <div class="message-text">${text}</div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function toggleChat() {
    const sidebar = document.getElementById('chatSidebar');
    sidebar.classList.toggle('active');
    document.body.classList.toggle('chat-open');
    if (sidebar.classList.contains('active')) {
        document.getElementById('chatBadge').style.display = 'none';
    }
}

// --- TAB SWITCHER ---
function switchTab(tabName) {
    // Скрываем все
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Показываем нужную
    const targetTab = document.getElementById(`tab-${tabName}`);

    // Если это чат - показываем как flex, иначе как block (или тоже flex)
    targetTab.style.display = (tabName === 'chat') ? 'flex' : 'block';

    event.currentTarget.classList.add('active');
}

// --- PARTICIPANTS LOGIC ---
function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    list.innerHTML = '';

    // Добавляем "Все"
    const all = document.createElement('div');
    all.className = 'participant-item';
    all.textContent = "🔊 Всем (Общий чат)";
    all.onclick = () => setRecipient("all", "Всем");
    list.appendChild(all);

    activeParticipants.forEach((nick, id) => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.textContent = nick + (id === 'me' ? ' (Вы)' : '');
        item.onclick = () => setRecipient(id, nick);
        list.appendChild(item);
    });
}

// --- RECIPIENT HANDLER ---
function setRecipient(id, nick) {
    currentRecipient = id;
    const indicator = document.getElementById('replyIndicator');

    if (id === "all") {
        indicator.style.display = 'none';
        document.getElementById('chatInput').placeholder = "Сообщение...";
    } else {
        indicator.style.display = 'block';
        indicator.textContent = `Пишете пользователю: ${nick}`;
        document.getElementById('chatInput').placeholder = `Сообщение для ${nick}...`;
    }
    // Авто-переключение на вкладку чата после клика на юзера
    switchTab('chat');
}

// Пример функции, которая будет вызываться, когда от сервера пришел список
// (Тебе нужно будет вызывать её в твоем WebSocket onmessage)
function onUserListReceived(users) {
    activeParticipants.clear();
    users.forEach(u => activeParticipants.set(u.id, u.nick));
    updateParticipantsList();
}