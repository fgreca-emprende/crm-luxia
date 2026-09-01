(function() {
  // Asegurar que el widget se ejecute una sola vez
  if (window.__luxiaChatInitialized) return;
  window.__luxiaChatInitialized = true;

  // Cargar Estilos CSS del Chat de manera dinámica
  const style = document.createElement('style');
  style.innerHTML = `
    .luxia-chat-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1f2937, #111827);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .luxia-chat-launcher:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .luxia-chat-launcher svg {
      width: 28px;
      height: 28px;
      fill: #ffffff;
      transition: transform 0.3s ease;
    }
    .luxia-chat-launcher.active svg {
      transform: rotate(90deg);
    }
    
    .luxia-chat-container {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 520px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .luxia-chat-container.active {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    
    .luxia-chat-header {
      background: linear-gradient(135deg, #1f2937, #111827);
      color: #ffffff;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .luxia-chat-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #ef4444;
      border: 2px solid rgba(255,255,255,0.2);
    }
    .luxia-chat-header-title {
      flex: 1;
    }
    .luxia-chat-header-title h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
    }
    .luxia-chat-header-title span {
      font-size: 11px;
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .luxia-chat-header-title span::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      display: inline-block;
    }
    
    .luxia-chat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f9fafb;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .luxia-chat-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
    }
    .luxia-chat-msg.agent {
      background: #ffffff;
      color: #1f2937;
      align-self: flex-start;
      border-bottom-left-radius: 2px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      border: 1px solid #f3f4f6;
    }
    .luxia-chat-msg.user {
      background: #ef4444;
      color: #ffffff;
      align-self: flex-end;
      border-bottom-right-radius: 2px;
    }
    .luxia-chat-msg-time {
      font-size: 9px;
      opacity: 0.7;
      margin-top: 4px;
      text-align: right;
    }
    
    .luxia-chat-footer {
      padding: 12px;
      background: #ffffff;
      border-top: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .luxia-chat-input {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 13px;
      outline: none;
      transition: border 0.2s ease;
    }
    .luxia-chat-input:focus {
      border-color: #ef4444;
    }
    .luxia-chat-send {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #ef4444;
      border: none;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s ease;
    }
    .luxia-chat-send:hover {
      opacity: 0.9;
    }
    
    .luxia-chat-onboarding {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      margin: auto 0;
    }
    .luxia-chat-onboarding h5 {
      margin: 0 0 4px 0;
      font-size: 13.5px;
      font-weight: 700;
      color: #1f2937;
    }
    .luxia-chat-onboarding input {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      outline: none;
    }
    .luxia-chat-onboarding input:focus {
      border-color: #ef4444;
    }
    .luxia-chat-onboarding button {
      background: #ef4444;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  // Crear elementos HTML del Widget
  const launcher = document.createElement('div');
  launcher.className = 'luxia-chat-launcher';
  launcher.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
  `;
  document.body.appendChild(launcher);

  const container = document.createElement('div');
  container.className = 'luxia-chat-container';
  container.innerHTML = `
    <div class="luxia-chat-header">
      <div class="luxia-chat-header-avatar">C</div>
      <div class="luxia-chat-header-title">
        <h4>Soporte Luxia</h4>
        <span>En línea</span>
      </div>
    </div>
    <div class="luxia-chat-messages" id="luxia-msg-container">
      <div class="luxia-chat-onboarding" id="luxia-onboarding">
        <h5>¡Hola! Cuéntanos de ti para chatear:</h5>
        <input type="text" id="luxia-input-name" placeholder="Tu Nombre Completo" required />
        <input type="email" id="luxia-input-email" placeholder="Tu Correo Electrónico" required />
        <button id="luxia-btn-start">Iniciar Conversación</button>
      </div>
    </div>
    <div class="luxia-chat-footer" style="display: none;" id="luxia-footer">
      <input type="text" class="luxia-chat-input" id="luxia-input-text" placeholder="Escribe tu mensaje..." />
      <button class="luxia-chat-send" id="luxia-btn-send">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  `;
  document.body.appendChild(container);

  // Alternar apertura del chat
  let isOpen = false;
  launcher.addEventListener('click', () => {
    isOpen = !isOpen;
    if (isOpen) {
      launcher.classList.add('active');
      container.classList.add('active');
      launcher.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      `;
      // Auto scroll
      const msgArea = document.getElementById('luxia-msg-container');
      msgArea.scrollTop = msgArea.scrollHeight;
    } else {
      launcher.classList.remove('active');
      container.classList.remove('active');
      launcher.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      `;
    }
  });

  // Cargar scripts de Firebase
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Inicializar Firebase y Chat
  async function initFirebase() {
    try {
      // 1. Cargar Firebase SDK
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js');

      // 2. Obtener la configuración
      const configRes = await fetch('/api/public/config');
      const configData = await configRes.json();
      if (!configData.success) throw new Error('Failed to load firebase config');

      const firebaseConfig = configData.config;

      // 3. Inicializar App local si no existe
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      const db = firebase.firestore();

      // 4. Chequear si ya tenemos un Ticket ID guardado en localStorage
      const savedTicketId = localStorage.getItem('luxia_cx_ticket_id');
      if (savedTicketId) {
        resumeChat(db, savedTicketId);
      } else {
        document.getElementById('luxia-btn-start').addEventListener('click', () => startNewChat(db));
      }
    } catch (err) {
      console.error('[LuxiaChat] Error initializing widget:', err);
    }
  }

  // Continuar conversación existente
  function resumeChat(db, ticketId) {
    document.getElementById('luxia-onboarding').style.display = 'none';
    document.getElementById('luxia-footer').style.display = 'flex';
    
    const msgArea = document.getElementById('luxia-msg-container');

    // Suscribirse a mensajes
    db.collection('tickets').doc(ticketId).collection('mensajes')
      .orderBy('createdAt', 'asc')
      .onSnapshot((snapshot) => {
        // Limpiar área de mensajes (excepto onboarding que ya está oculto)
        const messages = [];
        snapshot.forEach(doc => {
          messages.push(doc.data());
        });

        renderMessages(messages);
      }, (err) => {
        console.warn('Error reading chat messages, ticket might be archived. Resetting session.', err);
        localStorage.removeItem('luxia_cx_ticket_id');
        document.getElementById('luxia-onboarding').style.display = 'flex';
        document.getElementById('luxia-footer').style.display = 'none';
        document.getElementById('luxia-btn-start').addEventListener('click', () => startNewChat(db));
      });

    // Vincular botón de enviar
    const sendBtn = document.getElementById('luxia-btn-send');
    const inputField = document.getElementById('luxia-input-text');

    const sendMessage = async () => {
      const text = inputField.value.trim();
      if (!text) return;
      inputField.value = '';

      try {
        await db.collection('tickets').doc(ticketId).collection('mensajes').add({
          autor: localStorage.getItem('luxia_cx_user_name') || 'Invitado',
          autorEmail: localStorage.getItem('luxia_cx_user_email') || 'anon@luxia.com',
          mensaje: text,
          tipo: 'incoming',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Actualizar último mensaje preview
        await db.collection('tickets').doc(ticketId).update({
          ultimoMensajePreview: text.substring(0, 100),
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
          estado: 'open'
        });
      } catch (err) {
        console.error('Error sending message to firestore:', err);
      }
    };

    sendBtn.onclick = sendMessage;
    inputField.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };
  }

  // Iniciar nuevo ticket/chat
  async function startNewChat(db) {
    const name = document.getElementById('luxia-input-name').value.trim();
    const email = document.getElementById('luxia-input-email').value.trim();

    if (!name || !email) {
      alert('Por favor completa todos los campos.');
      return;
    }

    try {
      document.getElementById('luxia-btn-start').innerText = 'Iniciando...';
      document.getElementById('luxia-btn-start').disabled = true;

      // 1. Crear el ticket
      const ticketPayload = {
        contactoNombre: name,
        contactoEmail: email,
        contactoTelefono: '',
        clienteId: '',
        trackingId: '',
        titulo: `Chat en Vivo: ${name}`,
        estado: 'open',
        prioridad: 'media',
        equipoAsignado: 'soporte_l1',
        agenteAsignado: 'sin_asignar@luxia.com',
        origen: 'live_chat',
        pais: 'PE', // Fallback default
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };

      const ticketRef = await db.collection('tickets').add(ticketPayload);
      const ticketId = ticketRef.id;

      // 2. Guardar en localstorage
      localStorage.setItem('luxia_cx_ticket_id', ticketId);
      localStorage.setItem('luxia_cx_user_name', name);
      localStorage.setItem('luxia_cx_user_email', email);

      // 3. Crear primer mensaje de bienvenida del sistema
      await ticketRef.collection('mensajes').add({
        autor: 'Sistema',
        autorEmail: 'system@luxia.com',
        mensaje: `Hola ${name}, bienvenido al soporte en vivo de Luxia. En breve un agente CX te atenderá.`,
        tipo: 'outgoing',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 4. Continuar flujo de chat
      resumeChat(db, ticketId);
    } catch (err) {
      console.error('Error creating live chat session:', err);
      alert('Hubo un error al iniciar el chat. Por favor intenta más tarde.');
      document.getElementById('luxia-btn-start').innerText = 'Iniciar Conversación';
      document.getElementById('luxia-btn-start').disabled = false;
    }
  }

  // Renderizar mensajes
  function renderMessages(messages) {
    const msgArea = document.getElementById('luxia-msg-container');
    
    // Remover todos los elementos de mensaje anteriores, conservando el onboarding (oculto)
    const onboarding = document.getElementById('luxia-onboarding');
    msgArea.innerHTML = '';
    msgArea.appendChild(onboarding);

    messages.forEach(msg => {
      const msgDiv = document.createElement('div');
      // Si el remitente es el usuario, poner a la derecha. Si es el agente o sistema, a la izquierda
      const isUser = msg.tipo === 'incoming';
      msgDiv.className = `luxia-chat-msg ${isUser ? 'user' : 'agent'}`;
      
      const timeStr = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      msgDiv.innerHTML = `
        <div>${msg.mensaje}</div>
        <div class="luxia-chat-msg-time">${timeStr}</div>
      `;
      msgArea.appendChild(msgDiv);
    });

    // Auto scroll down
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  // Arrancar widget
  initFirebase();
})();
