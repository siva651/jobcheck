(function() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const textToType = 'Hi. Welcome to JobCheck.';

    // DOM references
    const introOverlay = document.getElementById('introOverlay');
    const appShell = document.getElementById('appShell');
    const typewriterText = document.getElementById('typewriterText');
    const rocketContainer = document.getElementById('rocketContainer');
    const rocketWrapper = document.getElementById('rocketWrapper');
    const ignitionFlash = document.getElementById('ignitionFlash');
    const particleCanvas = document.getElementById('particleCanvas');
    const particleCtx = particleCanvas.getContext('2d');
    const conversation = document.getElementById('conversation');
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const btnPlus = document.getElementById('btnPlus');
    const fileInput = document.getElementById('fileInput');
    const fileChipContainer = document.getElementById('fileChipContainer');
    const fileError = document.getElementById('fileError');
    const emptyState = document.getElementById('emptyState');
    const sidebar = document.getElementById('sidebar');
    const sessionsList = document.getElementById('sessionsList');
    const newChatBtn = document.getElementById('newChatBtn');
    const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

    // ========== Particle System ==========
    let particles = [];
    const maxParticles = 250;
    let particleLoopActive = false;
    let lastParticleTime = 0;

    function spawnParticle(x, y, velX, velY, size, life, color) {
        if (particles.length >= maxParticles) return;
        particles.push({ x, y, vx: velX, vy: velY, size, life, maxLife: life, color, gravity: 0.03, drag: 0.98 });
    }

    function emitExhaust(x, y, rocketSpeed) {
        const intensity = Math.min(rocketSpeed / 15, 2.5);
        const count = Math.floor(2 + intensity * 6);
        for (let i = 0; i < count; i++) {
            const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.0;
            const speed = (1.5 + intensity * 3) * (0.5 + Math.random() * 0.8);
            const vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.3;
            const vy = Math.sin(angle) * speed;
            const size = 1.5 + intensity * 1.5 + Math.random() * 2;
            const life = 0.4 + intensity * 0.5 + Math.random() * 0.4;
            const alpha = 0.4 + intensity * 0.4;
            spawnParticle(x, y, vx, vy, size, life, `rgba(255,200,50,${alpha})`);
        }
        for (let i = 0; i < Math.floor(intensity * 0.8); i++) {
            const speed = 2 + intensity * 2;
            const vy = speed * (0.7 + Math.random() * 0.3);
            const vx = (Math.random() - 0.5) * 1.5;
            spawnParticle(x, y, vx, vy, 2 + intensity, 0.2 + intensity * 0.15, `rgba(255,255,220,0.9)`);
        }
    }

    function emitIgnitionBurst(x, y) {
        const count = 30 + Math.floor(Math.random() * 20);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 1, 1 + Math.random() * 3, 0.2 + Math.random() * 0.3, `rgba(255,200,50,${0.6 + Math.random() * 0.4})`);
        }
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 4;
            spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 1, 1.5, 0.15, `rgba(255,255,255,0.9)`);
        }
    }

    function updateParticles(delta) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= delta;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.x += p.vx * delta * 60;
            p.y += p.vy * delta * 60;
            p.vy += p.gravity * delta * 60;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.size *= 0.995;
        }
    }

    function drawParticles() {
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        for (const p of particles) {
            particleCtx.globalAlpha = p.life / p.maxLife;
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particleCtx.fillStyle = p.color;
            particleCtx.fill();
        }
        particleCtx.globalAlpha = 1;
    }

    function particleLoop(timestamp) {
        if (!particleLoopActive) return;
        if (!lastParticleTime) lastParticleTime = timestamp;
        const delta = (timestamp - lastParticleTime) / 1000;
        lastParticleTime = timestamp;
        updateParticles(Math.min(delta, 0.05));
        drawParticles();
        requestAnimationFrame(particleLoop);
    }
    function startParticleLoop() { if (!particleLoopActive) { particleLoopActive = true; lastParticleTime = 0; requestAnimationFrame(particleLoop); } }
    function stopParticleLoop() { particleLoopActive = false; particles = []; particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height); }

    function resizeCanvas() { particleCanvas.width = window.innerWidth; particleCanvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopParticleLoop();
        else if (rocketWrapper.classList.contains('launching')) startParticleLoop();
    });

    // ========== Intro Sequence ==========
    let charIndex = 0;
    let typingInterval;
    function startTypewriter() {
        typingInterval = setInterval(() => {
            if (charIndex < textToType.length) {
                typewriterText.innerHTML = textToType.substring(0, charIndex + 1) + '<span class="cursor"></span>';
                charIndex++;
            } else {
                clearInterval(typingInterval);
                typewriterText.innerHTML = textToType + '<span class="cursor"></span>';
                if (!prefersReducedMotion) setTimeout(startLaunchSequence, 600);
                else transitionToMain();
            }
        }, 50);
    }
    function startLaunchSequence() {
        rocketContainer.classList.add('visible');
        setTimeout(() => {
            const rect = rocketWrapper.getBoundingClientRect();
            emitIgnitionBurst(rect.left + rect.width / 2, rect.bottom);
            ignitionFlash.style.opacity = '1';
            ignitionFlash.style.animation = 'flashFade 0.5s ease-out forwards';
            setTimeout(() => { ignitionFlash.style.opacity = '0'; }, 200);
            gsap.to('.intro-content', { duration: 0.3, x: () => gsap.utils.random(-3,3), y: () => gsap.utils.random(-3,3), clearProps: 'all', ease: 'power2.out' });

            const launchDistance = window.innerHeight + 200;
            const textElement = document.querySelector('.typewriter-container');
            const textY = textElement.getBoundingClientRect().top + textElement.offsetHeight / 2;
            gsap.to(rocketWrapper, {
                y: -launchDistance,
                duration: 2.2,
                ease: 'power4.in',
                onStart: () => { rocketWrapper.classList.add('launching'); startParticleLoop(); },
                onUpdate: () => {
                    const r = rocketWrapper.getBoundingClientRect();
                    const speed = Math.abs(gsap.getProperty(rocketWrapper, 'y'));
                    emitExhaust(r.left + r.width / 2, r.bottom, speed);
                    if (r.top < textY) gsap.to(textElement, { opacity: 0, duration: 0.4, overwrite: 'auto' });
                },
                onComplete: () => { stopParticleLoop(); transitionToMain(); }
            });
        }, 300);
    }
    function transitionToMain() {
        introOverlay.classList.add('hidden');
        appShell.style.display = 'flex';
        stopParticleLoop();
        initApp();
        setTimeout(() => { chatInput.focus(); }, 100);
    }

    // ========== Sessions Management (with per-session resume) ==========
    let sessions = [];
    try { sessions = JSON.parse(localStorage.getItem('jobcheck_sessions') || '[]'); } catch (e) { sessions = []; }

    let currentSessionId = null;
    let currentMessages = [];

    function saveSessions() { try { localStorage.setItem('jobcheck_sessions', JSON.stringify(sessions)); } catch (e) {} }
    function getSessionById(id) { return sessions.find(s => s.id === id); }
    function generateTitle(firstMessage) {
        let title = firstMessage.trim().split(/\s+/).slice(0, 5).join(' ');
        if (firstMessage.length > title.length) title += '...';
        return title || 'New chat';
    }
    function createNewSession() {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const session = { id, title: '', messages: [], resumeText: '', resumeFile: null };
        sessions.unshift(session);
        currentSessionId = id;
        currentMessages = [];
        saveSessions();
        renderSessions();
        clearConversation();
        showEmptyState();
        clearFileChip();
    }
    function deleteSession(id) {
        sessions = sessions.filter(s => s.id !== id);
        if (currentSessionId === id) {
            currentSessionId = null;
            currentMessages = [];
            clearConversation();
            showEmptyState();
            clearFileChip();
        }
        saveSessions();
        renderSessions();
    }
    function switchToSession(id) {
        const session = getSessionById(id);
        if (!session) return;
        currentSessionId = id;
        currentMessages = session.messages || [];
        if (session.resumeFile) showFileChip(session.resumeFile.name);
        else clearFileChip();
        renderConversationFromMessages();
        hideEmptyState();
        renderSessions();
    }
    function updateCurrentSessionTitle(title) {
        const session = getSessionById(currentSessionId);
        if (session && !session.title) {
            session.title = title;
            saveSessions();
            renderSessions();
        }
    }
    function saveCurrentSession() {
        if (!currentSessionId) return;
        const session = getSessionById(currentSessionId);
        if (session) {
            session.messages = currentMessages;
            saveSessions();
        }
    }
    function renderSessions() {
        if (!sessionsList) return;
        sessionsList.innerHTML = '';
        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
            const label = document.createElement('span');
            label.textContent = session.title || 'New chat';
            label.style.flex = '1';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.whiteSpace = 'nowrap';
            item.appendChild(label);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'session-delete-btn';
            deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
            deleteBtn.title = 'Delete chat';
            deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(session.id); });
            item.appendChild(deleteBtn);
            item.addEventListener('click', () => switchToSession(session.id));
            sessionsList.appendChild(item);
        });
    }

    // ========== File Chip Helpers ==========
    function showFileChip(fileName) {
        fileChipContainer.innerHTML = '';
        const chip = document.createElement('div');
        chip.className = 'file-chip';
        chip.innerHTML = `📄 ${escapeHtml(fileName)} <span class="remove-file" onclick="removeFileChip()">×</span>`;
        fileChipContainer.appendChild(chip);
    }
    window.removeFileChip = function() {
        clearFileChip();
        if (currentSessionId) {
            const session = getSessionById(currentSessionId);
            if (session) {
                session.resumeFile = null;
                session.resumeText = '';
                saveSessions();
            }
        }
    };
    function clearFileChip() {
        fileChipContainer.innerHTML = '';
        fileError.textContent = '';
        selectedFile = null;
    }

    // ========== Conversation Rendering ==========
    function clearConversation() { conversation.innerHTML = ''; conversation.classList.remove('active'); }
    function showEmptyState() { emptyState.classList.remove('hidden'); conversation.classList.remove('active'); conversation.innerHTML = ''; }
    function hideEmptyState() { emptyState.classList.add('hidden'); conversation.classList.add('active'); }
    function renderConversationFromMessages() {
        conversation.innerHTML = '';
        currentMessages.forEach(msg => {
            if (msg.role === 'user') appendUserBubble(msg.content, false);
            else if (msg.role === 'assistant' && msg.html) {
                const div = document.createElement('div');
                div.className = 'message-assistant';
                div.innerHTML = msg.html;
                conversation.appendChild(div);
            }
        });
        if (currentMessages.length > 0) { hideEmptyState(); scrollConversationToBottom(); }
        else showEmptyState();
    }
    function appendUserBubble(content, save = true) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-user';
        msgDiv.innerHTML = `<div class="bubble">${escapeHtml(content)}<button class="copy-btn" onclick="copyMessage(this)" title="Copy message" aria-label="Copy message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div>`;
        conversation.appendChild(msgDiv);
        if (save) { currentMessages.push({ role: 'user', content }); updateCurrentSessionTitle(content); saveCurrentSession(); }
        scrollConversationToBottom();
    }
    function scrollConversationToBottom() { conversation.scrollTop = conversation.scrollHeight; }

    // ========== Copy Message ==========
    window.copyMessage = function(btn) {
        const bubble = btn.closest('.bubble');
        const text = bubble.innerText.replace('📋', '').trim();
        navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = '✅';
            setTimeout(() => { btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`; }, 1500);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            btn.innerHTML = '✅';
            setTimeout(() => { btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`; }, 1500);
        });
    };

    // ========== Assistant Bubble Builders ==========
    function buildAssistantBubbleFromData(data) {
        const score = (data.matchScore !== undefined && data.matchScore !== -1) ? data.matchScore : null;
        const legitimacy = data.legitimacy || { text: 'Unknown', status: 'amber', details: '' };
        const fresherFriendly = data.fresherFriendly || { text: 'Unknown', status: 'amber' };
        const companyInfo = data.companyInfo || { size: 'Unknown', age: 'Unknown', industry: 'Unknown', type: 'Unknown' };
        const salary = data.salary || 'Not provided';
        const compensationBenefits = data.compensationBenefits || 'Not provided';
        const location = data.location || 'Not provided';
        const distance = data.distance || 'Not provided';
        const costOfLiving = data.costOfLiving || 'Not provided';
        const experienceRequired = data.experienceRequired || 'Not specified';
        const bondPeriod = data.bondPeriod || 'None mentioned';
        const ratingsReviews = data.ratingsReviews || 'No ratings found';
        const growthProspects = data.growthProspects || 'No information';
        const workSetup = data.workSetup || 'Not specified';
        const interviewProcess = data.interviewProcess || 'Not specified';
        const recommendation = data.recommendation || 'No recommendation available.';
        const missingSkills = data.missingSkills || [];

        const circumference = 251.2, ringSize = 100, center = ringSize / 2, radius = 40;
        const legitimacyIcon = legitimacy.status === 'green' ? '✓' : (legitimacy.status === 'red' ? '✗' : '!');
        const fresherIcon = fresherFriendly.status === 'green' ? '✓' : (fresherFriendly.status === 'red' ? '✗' : '!');

        const verdictItems = [
            { label: 'Legitimacy', value: `<strong>${legitimacy.text}</strong>${legitimacy.details ? ' — ' + legitimacy.details : ''}`, status: legitimacy.status, icon: legitimacyIcon },
            { label: 'Fresher Friendly', value: `<strong>${fresherFriendly.text}</strong>`, status: fresherFriendly.status, icon: fresherIcon },
            { label: 'Salary', value: `<strong>${salary}</strong> (Benefits: ${compensationBenefits})`, status: 'none', icon: '💰' },
            { label: 'Location', value: `<strong>${location}</strong> (Distance: ${distance})`, status: 'none', icon: '📍' },
            { label: 'Cost of Living', value: `<strong>${costOfLiving}</strong>`, status: 'none', icon: '🏠' },
            { label: 'Company', value: `<strong>${companyInfo.size}</strong>, <strong>${companyInfo.age}</strong>, ${companyInfo.industry}, ${companyInfo.type}`, status: 'none', icon: '🏢' },
            { label: 'Experience Required', value: `<strong>${experienceRequired}</strong>`, status: 'none', icon: '📅' },
            { label: 'Bond Period', value: `<strong>${bondPeriod}</strong>`, status: 'none', icon: '📝' },
            { label: 'Ratings & Reviews', value: `<strong>${ratingsReviews}</strong>`, status: 'none', icon: '⭐' },
            { label: 'Growth Prospects', value: `<strong>${growthProspects}</strong>`, status: 'none', icon: '📈' },
            { label: 'Work Setup', value: `<strong>${workSetup}</strong>`, status: 'none', icon: '🖥️' },
            { label: 'Interview Process', value: `<strong>${interviewProcess}</strong>`, status: 'none', icon: '🗣️' }
        ];
        if (missingSkills.length > 0) {
            verdictItems.push({ label: 'Missing Skills', value: `<strong>${missingSkills.join(', ')}</strong>`, status: 'red', icon: '⚠️' });
        }

        let verdictHtml = '';
        verdictItems.forEach(item => {
            let statusClass = '';
            if (item.status === 'green') statusClass = 'green';
            else if (item.status === 'red') statusClass = 'red';
            else if (item.status === 'amber') statusClass = 'amber';
            verdictHtml += `<div class="verdict-item"><div class="verdict-icon ${statusClass}" style="${item.status === 'none' ? 'background: var(--primary);' : ''}">${item.icon}</div><div class="verdict-text"><strong>${item.label}:</strong> ${item.value}</div></div>`;
        });

        const scoreDisplay = score === null ? 'Resume not provided' : `${score}%`;
        const ringOffset = score === null ? circumference : circumference - (score / 100) * circumference;

        return `<div class="assistant-row"><div class="assistant-avatar">JC</div><div class="bubble">
            <div class="match-ring-container"><div style="position:relative; display:inline-block; flex-shrink:0;">
                <svg class="ring-svg" viewBox="0 0 ${ringSize} ${ringSize}" width="${ringSize}" height="${ringSize}">
                    <circle class="ring-bg" cx="${center}" cy="${center}" r="${radius}"/>
                    <circle class="ring-fill" cx="${center}" cy="${center}" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${ringOffset}"/>
                </svg>
                <div class="ring-text-container"><div class="ring-percentage">${scoreDisplay}</div><div class="ring-label">Match</div></div>
            </div>
            <div class="match-details"><h4>Resume Match Analysis</h4><p>${score === null ? 'Upload a resume to get a personalized match score.' : 'Match score based on the job listing and your resume.'}</p></div>
            </div>
            ${verdictHtml}
            <div class="recommendation"><strong>Verdict:</strong> ${recommendation}</div>
            <button class="copy-btn" onclick="copyMessage(this)" title="Copy message" aria-label="Copy message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
        </div></div>`;
    }

    function buildResumeAdviceBubble(data) {
        const summary = data.summary || 'No summary.';
        const roles = data.recommendedRoles || [];
        const skills = data.skillsToHighlight || [];
        const missing = data.missingSkills || [];
        const advice = data.advice || '';
        return `<div class="assistant-row"><div class="assistant-avatar">JC</div><div class="bubble">
            <h4>Career Recommendations</h4><p>${escapeHtml(summary)}</p>
            <div class="verdict-item"><span class="verdict-icon" style="background:var(--primary);">💼</span><div class="verdict-text"><strong>Recommended Roles:</strong> ${roles.map(r => `<strong>${r}</strong>`).join(', ')}</div></div>
            <div class="verdict-item"><span class="verdict-icon" style="background:var(--green);">✓</span><div class="verdict-text"><strong>Skills to Highlight:</strong> ${skills.map(s => `<strong>${s}</strong>`).join(', ')}</div></div>
            <div class="verdict-item"><span class="verdict-icon" style="background:var(--red);">✗</span><div class="verdict-text"><strong>Missing Skills:</strong> ${missing.map(s => `<strong>${s}</strong>`).join(', ')}</div></div>
            <div class="recommendation"><strong>Advice:</strong> ${escapeHtml(advice)}</div>
            <button class="copy-btn" onclick="copyMessage(this)" title="Copy message" aria-label="Copy message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
        </div></div>`;
    }

    // ========== Animation ==========
    function animateAssistantResponse(msgDiv, score) {
        if (prefersReducedMotion) return;
        const bubble = msgDiv.querySelector('.bubble');
        if (!bubble) return;
        const ringContainer = bubble.querySelector('.match-ring-container');
        const verdictItems = bubble.querySelectorAll('.verdict-item');
        const recommendation = bubble.querySelector('.recommendation');
        const ringFill = bubble.querySelector('.ring-fill');
        const ringPercentage = bubble.querySelector('.ring-percentage');
        if (ringContainer) gsap.set(ringContainer, { opacity: 0, y: 15 });
        gsap.set(verdictItems, { opacity: 0, x: -20 });
        if (recommendation) gsap.set(recommendation, { opacity: 0, y: 10 });
        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
        if (ringContainer) tl.to(ringContainer, { opacity: 1, y: 0, duration: 0.4, delay: 0.1 });
        tl.to(verdictItems, { opacity: 1, x: 0, duration: 0.3, stagger: 0.06 }, '-=0.1');
        if (recommendation) tl.to(recommendation, { opacity: 1, y: 0, duration: 0.3 }, '-=0.05');
        if (score !== null && score !== -1 && ringFill) {
            const circumference = 251.2;
            const offset = circumference - (score / 100) * circumference;
            tl.to(ringFill, { strokeDashoffset: offset, duration: 1.0, ease: 'power1.inOut' }, 0.1);
            const counter = { val: 0 };
            tl.to(counter, { val: score, duration: 1.0, ease: 'power1.inOut', onUpdate: () => { ringPercentage.textContent = Math.round(counter.val) + '%'; } }, 0.1);
        }
        verdictItems.forEach((item, index) => {
            const icon = item.querySelector('.verdict-icon');
            if (icon) tl.fromTo(icon, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }, 0.4 + index * 0.06);
        });
    }

    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

    // ========== Send Flow (non‑streaming) ==========
    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text && !selectedFile && !currentSessionResumeText()) return;

        if (!currentSessionId) createNewSession();

        const userContent = selectedFile ? text + (text ? ' ' : '') + `[Attached: ${selectedFile.name}]` : text;
        appendUserBubble(userContent);
        hideEmptyState();

        chatInput.value = '';
        autoResizeTextarea();
        btnSend.disabled = true;
        btnSend.classList.add('send-success');

        // Create loading bubble
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message-assistant';
        thinkingDiv.id = 'thinkingMsg';
        thinkingDiv.innerHTML = `
            <div class="assistant-row">
                <div class="assistant-avatar">JC</div>
                <div class="bubble">
                    <div class="thinking-indicator">
                        <span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
                    </div>
                </div>
            </div>`;
        conversation.appendChild(thinkingDiv);
        scrollConversationToBottom();

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobText: text,
                    resumeFile: selectedFile ? { name: selectedFile.name, type: selectedFile.type, base64Data: selectedFile.base64Data } : null,
                    resumeText: currentSessionResumeText()
                })
            });
            if (!response.ok) throw new Error('Request failed');
            const data = await response.json();

            // Remove loading
            thinkingDiv.remove();

            if (data.type === 'general' || data.type === 'resumeQ') {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message-assistant';
                msgDiv.innerHTML = `
                    <div class="assistant-row">
                        <div class="assistant-avatar">JC</div>
                        <div class="bubble">${escapeHtml(data.text)}<button class="copy-btn" onclick="copyMessage(this)" title="Copy message" aria-label="Copy message"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div>
                    </div>`;
                conversation.appendChild(msgDiv);
                currentMessages.push({ role: 'assistant', html: msgDiv.innerHTML });
                saveCurrentSession();
                scrollConversationToBottom();
                if (!prefersReducedMotion) gsap.fromTo(msgDiv, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 });
            } else if (data.type === 'error') {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message-assistant';
                msgDiv.innerHTML = `<div class="assistant-row"><div class="assistant-avatar">JC</div><div class="bubble" style="color:var(--red);">${escapeHtml(data.text)}</div></div>`;
                conversation.appendChild(msgDiv);
            } else if (data.type === 'resumeAdvice') {
                if (data.data.resumeText) {
                    const session = getSessionById(currentSessionId);
                    if (session) { session.resumeText = data.data.resumeText; saveSessions(); }
                }
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message-assistant';
                msgDiv.innerHTML = buildResumeAdviceBubble(data.data);
                conversation.appendChild(msgDiv);
                currentMessages.push({ role: 'assistant', html: msgDiv.innerHTML });
                saveCurrentSession();
                scrollConversationToBottom();
                if (!prefersReducedMotion) gsap.fromTo(msgDiv, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 });
            } else {
                // job response
                if (data.data.resumeText) {
                    const session = getSessionById(currentSessionId);
                    if (session) { session.resumeText = data.data.resumeText; saveSessions(); }
                }
                const assistantHtml = buildAssistantBubbleFromData(data.data);
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message-assistant';
                msgDiv.innerHTML = assistantHtml;
                conversation.appendChild(msgDiv);
                currentMessages.push({ role: 'assistant', html: msgDiv.innerHTML });
                saveCurrentSession();
                scrollConversationToBottom();
                if (!prefersReducedMotion) animateAssistantResponse(msgDiv, data.data.matchScore);
            }
        } catch (error) {
            thinkingDiv.remove();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message-assistant';
            errorDiv.innerHTML = `<div class="assistant-row"><div class="assistant-avatar">JC</div><div class="bubble" style="color:var(--red);">Sorry, something went wrong. Please try again.</div></div>`;
            conversation.appendChild(errorDiv);
        } finally {
            btnSend.disabled = false;
            btnSend.classList.remove('send-success');
            chatInput.focus();
            selectedFile = null;
            fileChipContainer.innerHTML = '';
            fileError.textContent = '';
        }
    }

    function currentSessionResumeText() {
        const session = getSessionById(currentSessionId);
        return session ? session.resumeText : '';
    }

    btnSend.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });

    // ========== File Upload (with image support and size limit) ==========
    let selectedFile = null;

    btnPlus.addEventListener('click', () => { fileInput.click(); });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = file.type.startsWith('image/') ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
            fileError.textContent = 'File is too large. Maximum size is 3 MB for images, 5 MB for documents.';
            fileInput.value = '';
            selectedFile = null;
            return;
        }

        const ext = file.name.split('.').pop().toLowerCase();
        const allowedExts = ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp'];
        const allowedMimes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        if (!allowedExts.includes(ext) || !allowedMimes.includes(file.type)) {
            fileError.textContent = 'Please upload a PDF, DOCX, TXT, JPG, PNG, or WEBP file.';
            fileInput.value = '';
            selectedFile = null;
            return;
        }

        fileError.textContent = '';
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result.split(',')[1];
            selectedFile = { name: file.name, type: file.type, base64Data: base64Data };
            if (currentSessionId) {
                const session = getSessionById(currentSessionId);
                if (session) { session.resumeFile = selectedFile; saveSessions(); }
            }
            showFileChip(file.name);
        };
        reader.readAsDataURL(file);
    });

    function autoResizeTextarea() { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px'; }
    chatInput.addEventListener('input', autoResizeTextarea);

    // ========== Sidebar & Mobile ==========
    function initApp() { renderSessions(); showEmptyState(); }
    newChatBtn.addEventListener('click', createNewSession);
    sidebarOpenBtn.addEventListener('click', () => { sidebar.classList.add('open'); });
    sidebarCloseBtn.addEventListener('click', () => { sidebar.classList.remove('open'); });
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !sidebar.contains(e.target) && e.target !== sidebarOpenBtn) sidebar.classList.remove('open');
    });
    function checkMobile() {
        if (window.innerWidth <= 768) sidebarOpenBtn.style.display = 'block';
        else { sidebarOpenBtn.style.display = 'none'; sidebar.classList.remove('open'); }
    }
    window.addEventListener('resize', checkMobile);
    checkMobile();

    window.addEventListener('load', startTypewriter);
})();