import './style.css'

const FIXED_TOPIC = '지구의 자전과 공전'

const LEVEL_LABELS = {
  하: '하 (기초 부족)',
  중: '중 (오개념 보유)',
  상: '상 (부분 혼동)',
}

const LEVEL_MISCONCEPTIONS = {
  하: [
    '자전과 공전의 방향을 동쪽/서쪽으로 헷갈린다.',
    '낮과 밤은 태양이 움직여서 생기는 것이라고 생각한다.',
  ],
  중: ['계절은 태양-지구 거리가 가까워졌다 멀어져서 생긴다고 믿는다.'],
  상: ['지구 자전으로 생기는 일주운동 방향을 제대로 설명하지 못한다.'],
}

const state = {
  topic: FIXED_TOPIC,
  level: '중',
  name: '',
  understandingScore: 2,
  personality: 'calm',
  avatarParts: { eyes: 'round', nose: 'dot', mouth: 'smile', hair: 'short' },
  misconception: '',
  hasShownCompletion: false,
  conversation: [],
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
}

function mapLevelToInitialScore(level) {
  switch (level) {
    case '하':
      return 1
    case '상':
      return 3
    case '중':
    default:
      return 2
  }
}

function clampScore(score) {
  return Math.min(5, Math.max(1, Number.isFinite(score) ? score : 1))
}

function getLevelLabel(level) {
  return LEVEL_LABELS[level] || level || LEVEL_LABELS.중
}

function pickMisconception(level) {
  const list = LEVEL_MISCONCEPTIONS[level] || []
  if (!list.length) return ''
  const idx = Math.floor(Math.random() * list.length)
  return list[idx]
}

function describePersonality(personality) {
  switch (personality) {
    case 'bright':
      return `- 너의 말투는 밝고 리액션이 많아. 자주 감탄을 하거나 감정 표현을 섞어서 말해라.\n- 그래도 학생답게 모르는 부분은 솔직히 말해라.`
    case 'shy':
      return `- 너의 말투는 차분하고 조금 수줍어. 조심스럽게 말하고, 모르는 부분은 솔직히 털어놓아라.\n- 긴 문장보다는 짧게 말하고, 질문을 조심스레 덧붙여라.`
    case 'calm':
    default:
      return `- 너의 말투는 차분하고 침착하지만, 열심히 이해하려는 태도를 보여라.\n- 상대방이 말할 때 집중해서 듣고, 네가 이해한 대로 다시 말해 보려고 노력해라.`
  }
}

function buildSystemPrompt({ level, name, personality, misconception }) {
  return `
너는 중학교 과학 단원 "지구의 자전과 공전"을 배우는 AI 학생 "${name}"이야.
대화는 항상 이 단원만 다루며, 너의 초기 이해 수준은 "${getLevelLabel(level)}"이다.
너는 헷갈린다고 말하는 대신, 아래 한 가지 오개념을 중심으로 확신에 차서 설명한다:
- 대표 오개념: "${misconception}"

[이해 수준 정의]
- 하 (기초 부족): 개념을 거의 모름. 직관적·비과학적 설명이 많다.
- 중 (오개념 보유): 말은 그럴듯하지만 핵심을 잘못 이해하고 오개념을 유지한다.
- 상 (부분 혼동): 전반적 개념은 맞지만 특정 핵심 요소를 혼동한다.

[응답 방식]
1) 항상 1인칭 반말로 AI 학생처럼 말해라.
2) "모르겠다/헷갈린다" 대신, 위 대표 오개념을 기반으로 명확히 틀린 설명을 한다.
3) 매 응답은 짧은 인사 또는 호응으로 시작한 뒤, 대표 오개념을 확신하듯 먼저 말하고 질문으로 시작하지 않는다.
4) 설명을 들으며 이해도가 조금씩 상승할 수 있지만, 한 번에 정답으로 점프하지 않는다.
5) 이해도가 변해도 오개념을 바로 버리지 말고, 수정되는 과정이 드러나게 말한다.
6) 잘못된 설명을 할 때는 이유나 예시를 덧붙여 자연스럽게 말한다.

[오개념 표현 예시]
- "해가 움직여서 낮과 밤이 생기는 거잖아? 그래서..."
- "계절은 지구가 태양에 가까워졌다 멀어졌다 해서 생기는 거 아냐?"
- "별이 하루에 서→동으로 움직이는 거라서..."

[성격 설정]
${describePersonality(personality)}

[출력 형식]
반드시 아래 JSON 형식으로만 답한다:
{
  "reply": "여기에 네 실제 발화 내용",
  "understandingScore": 숫자(1~5)
}
"understandingScore"는 1~5 범위에서 대화 흐름에 따라 1씩만 조정한다.
`.trim()
}

function togglePage(showChat) {
  const setupPage = document.getElementById('setup-page')
  const chatPage = document.getElementById('chat-page')
  if (!setupPage || !chatPage) return
  if (showChat) {
    document.body.classList.add('chat-open')
    setupPage.classList.add('hidden')
    chatPage.classList.remove('hidden')
  } else {
    document.body.classList.remove('chat-open')
    setupPage.classList.remove('hidden')
    chatPage.classList.add('hidden')
  }
}

function updateSelectionButtons(groupSelector, value) {
  const buttons = document.querySelectorAll(groupSelector)
  buttons.forEach((btn) => {
    if (btn.dataset.value === value) {
      btn.classList.add('selected')
    } else {
      btn.classList.remove('selected')
    }
  })
}

function renderStars(score, targetId = 'understanding-stars') {
  const container = document.getElementById(targetId)
  if (!container) return
  const clamped = clampScore(score)
  container.innerHTML = ''
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span')
    span.textContent = i <= clamped ? '★' : '☆'
    span.className = 'star'
    container.appendChild(span)
  }
}

function typeWriter(element, text) {
  let idx = 0
  const speed = 12 // chars per frame-ish
  function step() {
    element.textContent += text.slice(idx, idx + speed)
    idx += speed
    if (idx < text.length) {
      requestAnimationFrame(step)
    }
  }
  requestAnimationFrame(step)
}

function appendMessage({ sender, text, typewriter = false }) {
  const container = document.getElementById('chat-messages')
  if (!container) return
  const wrapper = document.createElement('div')
  wrapper.className = `message-row ${sender === 'user' ? 'user' : 'bot'}`

  const bubble = document.createElement('div')
  bubble.className = 'message-bubble'
  if (typewriter && sender === 'bot') {
    bubble.textContent = ''
    typeWriter(bubble, text)
  } else {
    bubble.textContent = text
  }

  wrapper.appendChild(bubble)
  container.appendChild(wrapper)
  container.scrollTop = container.scrollHeight
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages')
  if (!container) return null
  const wrapper = document.createElement('div')
  wrapper.className = 'message-row bot'
  const bubble = document.createElement('div')
  bubble.className = 'message-bubble typing'
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`
  wrapper.appendChild(bubble)
  container.appendChild(wrapper)
  container.scrollTop = container.scrollHeight
  return wrapper
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawAvatarToCanvas(canvas, parts) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#f7fbff')
  bg.addColorStop(1, '#e4f2ff')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const hairColor =
    parts.hair === 'long'
      ? '#2f4a7a'
      : parts.hair === 'tied'
        ? '#1e2c45'
        : '#24344f'

  const hairHeight =
    parts.hair === 'long' ? h * 0.78 : parts.hair === 'tied' ? h * 0.35 : h * 0.32
  drawRoundedRect(ctx, w * 0.08, h * 0.05, w * 0.84, hairHeight, 16)
  const hairGrad = ctx.createLinearGradient(0, 0, w, hairHeight)
  hairGrad.addColorStop(0, hairColor)
  hairGrad.addColorStop(1, parts.hair === 'long' ? '#2a3f66' : '#182238')
  ctx.fillStyle = hairGrad
  ctx.fill()

  if (parts.hair === 'tied') {
    ctx.beginPath()
    ctx.ellipse(w / 2, h * 0.02, w * 0.12, h * 0.06, 0, 0, Math.PI * 2)
    ctx.fillStyle = hairColor
    ctx.fill()
  }

  const faceX = w * 0.18
  const faceY = h * 0.16
  const faceW = w * 0.64
  const faceH = h * 0.46
  drawRoundedRect(ctx, faceX, faceY, faceW, faceH, 18)
  const faceGrad = ctx.createLinearGradient(0, faceY, 0, faceY + faceH)
  faceGrad.addColorStop(0, '#ffe9c4')
  faceGrad.addColorStop(1, '#fbd5a4')
  ctx.fillStyle = faceGrad
  ctx.fill()

  const eyeColor = '#0f1f3a'
  const eyeY = faceY + faceH * 0.45
  const eyeOffsetX = faceW * 0.22
  function drawEye(x, variant) {
    ctx.save()
    ctx.fillStyle = eyeColor
    if (variant === 'crescent') {
      ctx.beginPath()
      ctx.ellipse(x, eyeY, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (variant === 'wink') {
      ctx.fillRect(x - 9, eyeY - 2, 18, 4)
    } else {
      ctx.beginPath()
      ctx.arc(x, eyeY, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.stroke()
    }
    ctx.restore()
  }
  drawEye(faceX + eyeOffsetX, parts.eyes)
  drawEye(faceX + faceW - eyeOffsetX, parts.eyes === 'wink' ? 'crescent' : parts.eyes)

  const noseY = faceY + faceH * 0.68
  ctx.fillStyle = '#d27a42'
  if (parts.nose === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(w / 2, noseY + 10)
    ctx.lineTo(w / 2 - 7, noseY - 6)
    ctx.lineTo(w / 2 + 7, noseY - 6)
    ctx.closePath()
    ctx.fill()
  } else if (parts.nose === 'line') {
    ctx.fillRect(w / 2 - 1, noseY - 8, 2, 16)
  } else {
    ctx.beginPath()
    ctx.arc(w / 2, noseY, 4.5, 0, Math.PI * 2)
    ctx.fill()
  }

  const mouthY = faceY + faceH * 0.82
  if (parts.mouth === 'flat') {
    ctx.strokeStyle = '#d45b52'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(w / 2 - 14, mouthY)
    ctx.lineTo(w / 2 + 14, mouthY)
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#d45b52'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(w / 2, mouthY, 14, 0, Math.PI)
    ctx.stroke()
  }

  const clothesGrad = ctx.createLinearGradient(0, h * 0.7, w, h)
  clothesGrad.addColorStop(0, '#7bc3ff')
  clothesGrad.addColorStop(1, '#5aa6ff')
  ctx.fillStyle = clothesGrad
  drawRoundedRect(ctx, w * 0.05, h * 0.66, w * 0.9, h * 0.34, 14)
  ctx.fill()

  return canvas.toDataURL('image/png')
}

function renderAvatar(previewOnly = false) {
  const setupCanvas = document.getElementById('setup-avatar-canvas')
  if (!setupCanvas) return null
  const url = drawAvatarToCanvas(setupCanvas, state.avatarParts)
  if (!previewOnly) {
    const chatImg = document.getElementById('chat-avatar-img')
    if (chatImg) chatImg.src = url
    const completionImg = document.getElementById('completion-avatar-img')
    if (completionImg) completionImg.src = url
  }
  return url
}

function showCompletionModal() {
  const modal = document.getElementById('completion-modal')
  const modalText = document.getElementById('completion-text')
  const modalName = document.getElementById('completion-name')
  if (!modal || !modalText || !modalName) return

  modalName.textContent = state.name || 'AI 학생'
  modalText.textContent = `"${state.topic}" 단원은 이제 꽤 이해가 된 것 같아! \n도움 고마워!`
  modal.classList.remove('hidden')
  document.body.classList.add('modal-open')
}

function hideCompletionModal() {
  const modal = document.getElementById('completion-modal')
  if (!modal) return
  modal.classList.add('hidden')
  document.body.classList.remove('modal-open')
}

async function testApiConnection() {
  const indicator = document.getElementById('api-status-indicator')
  const text = document.getElementById('api-status-text')

  if (!indicator || !text) return

  if (!state.apiKey) {
    indicator.className = 'status-dot error'
    text.textContent = 'API Key 없음'
    return
  }

  indicator.className = 'status-dot checking'
  text.textContent = 'Checking...'

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${state.apiKey}`,
      },
    })

    if (!res.ok) {
      throw new Error('API error')
    }

    indicator.className = 'status-dot ok'
    text.textContent = 'API Connected'
  } catch (err) {
    console.error('API connection error', err)
    indicator.className = 'status-dot error'
    text.textContent = 'API Error'
  }
}

async function sendChatMessage(userText) {
  const input = document.getElementById('user-input')
  const sendButton = document.getElementById('send-button')

  if (!state.apiKey) {
    appendMessage({
      sender: 'bot',
      text: 'API Key가 설정되어 있지 않아. .env에 VITE_OPENAI_API_KEY를 추가해 줘!',
    })
    return
  }

  const model = 'gpt-4o-mini'

  const messages = [
    { role: 'system', content: buildSystemPrompt(state) },
    ...state.conversation,
    { role: 'user', content: userText },
  ]

  let typingEl = null
  try {
    if (input) input.disabled = true
    if (sendButton) sendButton.disabled = true
    typingEl = showTypingIndicator()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error', errorText)
      appendMessage({
        sender: 'bot',
        text: 'AI 응답을 가져오는 중 오류가 발생했어. 콘솔을 확인해 줘.',
      })
      return
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content ?? ''

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      console.warn('JSON parse 실패, 원본 내용 사용', raw)
      parsed = {
        reply: raw,
        understandingScore: state.understandingScore,
      }
    }

    const reply = parsed.reply || raw
    const newScore = clampScore(
      typeof parsed.understandingScore === 'number'
        ? parsed.understandingScore
        : state.understandingScore,
    )
    const patchedAssistant = {
      reply,
      understandingScore: newScore,
    }

    state.understandingScore = newScore
    renderStars(state.understandingScore)
    appendMessage({ sender: 'bot', text: reply, typewriter: true })

    if (state.understandingScore >= 5 && !state.hasShownCompletion) {
      state.hasShownCompletion = true
      showCompletionModal()
    }

    state.conversation.push(
      { role: 'user', content: userText },
      {
        role: 'assistant',
        content: JSON.stringify(patchedAssistant),
      },
    )
  } catch (err) {
    console.error('Chat error', err)
    appendMessage({
      sender: 'bot',
      text: '네트워크 오류가 발생했어. 인터넷 연결을 확인해 줘.',
    })
  } finally {
    if (typingEl?.parentNode) typingEl.parentNode.removeChild(typingEl)
    if (input) {
      input.disabled = false
      input.focus()
    }
    if (sendButton) sendButton.disabled = false
  }
}

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <span class="app-title-main">AI 학생의 오개념 바로잡기!</span>
        <span class="app-title-sub">지구의 자전과 공전</span>
      </div>
      <div class="api-status">
        <span id="api-status-indicator" class="status-dot idle"></span>
        <span id="api-status-text" class="status-text">API Status</span>
      </div>
    </header>

    <main class="app-main">
      <section id="setup-page" class="panel">
        <div class="panel-heading">
          <h2 class="panel-title">AI 학생 설정하기</h2>
          <p class="panel-description">단원은 항상 "지구의 자전과 공전"으로 고정됩니다.</p>
        </div>

        <div class="setup-grid">
          <div class="setup-left">
            <div class="setup-section">
              <h3 class="setup-label">이해 수준</h3>
              <div class="button-group" id="level-buttons">
                <button class="choice-button" data-value="하">하 (기초 부족)</button>
                <button class="choice-button" data-value="중">중 (오개념 보유)</button>
                <button class="choice-button" data-value="상">상 (부분 혼동)</button>
              </div>
            </div>

            <div class="setup-section">
              <h3 class="setup-label">AI 학생 이름</h3>
              <input
                id="bot-name-input"
                class="text-input"
                type="text"
                placeholder="예: 지훈, 민지 ..."
              />
            </div>

            <div class="setup-section">
              <h3 class="setup-label">AI 학생 성격</h3>
              <div class="button-group" id="personality-buttons">
                <button class="choice-button" data-value="calm">차분한 AI 학생</button>
                <button class="choice-button" data-value="bright">활발한 AI 학생</button>
                <button class="choice-button" data-value="shy">수줍은 AI 학생</button>
              </div>
            </div>
          </div>

          <div class="setup-right">
            <div class="setup-section">
              <h3 class="setup-label">AI 학생 꾸미기</h3>
              <div class="avatar-parts-grid">
                <div class="part-group">
                  <div class="part-label">눈 모양</div>
                  <div class="part-options" id="eyes-options">
                    <button class="part-button" data-part="eyes" data-value="round">둥근 눈</button>
                    <button class="part-button" data-part="eyes" data-value="crescent">초승달 눈</button>
                    <button class="part-button" data-part="eyes" data-value="wink">윙크</button>
                  </div>
                </div>
                <div class="part-group">
                  <div class="part-label">코 모양</div>
                  <div class="part-options" id="nose-options">
                    <button class="part-button" data-part="nose" data-value="dot">점 코</button>
                    <button class="part-button" data-part="nose" data-value="line">일자 코</button>
                    <button class="part-button" data-part="nose" data-value="triangle">삼각 코</button>
                  </div>
                </div>
                <div class="part-group">
                  <div class="part-label">입 모양</div>
                  <div class="part-options" id="mouth-options">
                    <button class="part-button" data-part="mouth" data-value="smile">미소</button>
                    <button class="part-button" data-part="mouth" data-value="flat">일자</button>
                  </div>
                </div>
                <div class="part-group">
                  <div class="part-label">머리 모양</div>
                  <div class="part-options" id="hair-options">
                    <button class="part-button" data-part="hair" data-value="short">단정한 숏컷</button>
                    <button class="part-button" data-part="hair" data-value="long">긴 생머리</button>
                    <button class="part-button" data-part="hair" data-value="tied">묶은 머리</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="setup-section avatar-preview">
              <div class="avatar-preview-card">
                <div class="avatar-preview-header">
                  <span>AI 학생 아바타</span>
                  <span id="setup-understanding-stars" class="stars-inline small">★★☆☆☆</span>
                </div>
                <canvas
                  id="setup-avatar-canvas"
                  class="avatar-canvas"
                  width="140"
                  height="160"
                  aria-label="아바타 미리보기"
                ></canvas>
                <div class="avatar-name" id="avatar-name-preview">AI 학생 이름</div>
              </div>
            </div>
          </div>
        </div>

        <div class="setup-actions">
          <button id="start-chat-button" class="primary-button">
            대화 시작하기
          </button>
        </div>
      </section>

      <section id="chat-page" class="panel hidden">
        <div class="chat-top">
          <button id="back-button" class="back-button">뒤로 가기</button>
          <div class="chat-info-grid">
            <div class="info-section">
              <div class="info-section-title">AI 학생</div>
              <div class="tab-identity">
                <div class="tab-name" id="chat-bot-name">-</div>
                <img id="chat-avatar-img" class="avatar-snapshot" alt="AI 학생 아바타" />
              </div>
            </div>
            <div class="info-section">
              <div class="info-section-title">설정 정보</div>
              <div class="info-meta compact">
                <div class="info-row">
                  <span class="meta-key">단원</span>
                  <span class="meta-value" id="chat-topic">${FIXED_TOPIC}</span>
                </div>
                <div class="info-row">
                  <span class="meta-key">이해 수준</span>
                  <span class="meta-value" id="chat-level">-</span>
                </div>
                <div class="info-row">
                  <span class="meta-key">성격</span>
                  <span class="meta-value" id="chat-personality">-</span>
                </div>
              </div>
            </div>
            <div class="info-section">
              <div class="info-section-title">이해도</div>
              <div class="understanding-card compact">
                <div id="understanding-stars" class="stars-inline large"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="chat-area">
          <div class="chat-hint">AI 학생에게 먼저 인사를 건네 보세요!</div>
          <div id="chat-messages" class="chat-messages"></div>

          <form id="chat-form" class="chat-input-area">
            <textarea
              id="user-input"
              class="chat-input"
              rows="2"
              placeholder="설명하거나 질문을 적어 주세요. (Shift+Enter 줄바꿈)"
            ></textarea>
            <button id="send-button" type="submit" class="primary-button">
              보내기
            </button>
          </form>
        </div>
      </section>
    </main>

    <div id="completion-modal" class="completion-modal hidden">
      <div class="completion-backdrop"></div>
      <div class="completion-content">
        <div class="completion-avatar">
          <img id="completion-avatar-img" class="avatar-snapshot" alt="완료 아바타" />
        </div>
        <div class="completion-text-block">
          <div class="completion-title">
            이해 완료! 고마워요 🥳
          </div>
          <div class="completion-body">
            <span id="completion-name">AI 학생</span>:
            <span id="completion-text"></span>
          </div>
          <div class="completion-actions">
            <button id="completion-continue" class="primary-button ghost">계속 대화하기</button>
            <button id="completion-reset" class="primary-button ghost">다른 AI 학생과 대화해보기</button>
            <button id="completion-exit" class="primary-button ghost">종료하기</button>
          </div>
        </div>
      </div>
    </div>
  </div>
`

function bindAvatarPartButtons() {
  document.querySelectorAll('.part-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const part = btn.dataset.part
      const value = btn.dataset.value
      if (!part || !value) return
      state.avatarParts[part] = value
      updateSelectionButtons(`.part-button[data-part="${part}"]`, value)
      renderAvatar()
    })
  })
}

function updateSetupStars() {
  const setupStars = document.getElementById('setup-understanding-stars')
  if (setupStars) {
    const initScore = mapLevelToInitialScore(state.level)
    setupStars.textContent =
      '★★★★★'.slice(0, initScore) + '☆☆☆☆☆'.slice(0, 5 - initScore)
  }
}

document.querySelectorAll('#level-buttons .choice-button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.value
    state.level = value
    state.understandingScore = mapLevelToInitialScore(state.level)
    state.misconception = pickMisconception(state.level)
    updateSelectionButtons('#level-buttons .choice-button', value)
    updateSetupStars()
  })
})

document.querySelectorAll('#personality-buttons .choice-button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const personality = btn.dataset.value
    state.personality = personality
    updateSelectionButtons('#personality-buttons .choice-button', personality)
  })
})

const nameInput = document.getElementById('bot-name-input')
const namePreview = document.getElementById('avatar-name-preview')
if (nameInput && namePreview) {
  nameInput.addEventListener('input', (e) => {
    const value = e.target.value.trim()
    state.name = value
    namePreview.textContent = value || 'AI 학생 이름'
  })
}

const startButton = document.getElementById('start-chat-button')
if (startButton) {
  startButton.addEventListener('click', () => {
    if (!state.name) {
      alert('AI 학생 이름을 입력해 주세요.')
      return
    }

    state.topic = FIXED_TOPIC
    state.misconception = pickMisconception(state.level)
    state.understandingScore = mapLevelToInitialScore(state.level)
    state.conversation = []
    state.hasShownCompletion = false

    const chatMessages = document.getElementById('chat-messages')
    if (chatMessages) chatMessages.innerHTML = ''

    document.getElementById('chat-bot-name').textContent = state.name
    document.getElementById('chat-topic').textContent = FIXED_TOPIC
    document.getElementById('chat-level').textContent = getLevelLabel(state.level)
    document.getElementById('chat-personality').textContent =
      state.personality === 'bright'
        ? '활발한 AI 학생'
        : state.personality === 'shy'
          ? '수줍은 AI 학생'
          : '차분한 AI 학생'

    renderStars(state.understandingScore)
    renderAvatar()
    togglePage(true)
  })
}

const chatForm = document.getElementById('chat-form')
if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('user-input')
    const text = input.value.trim()
    if (!text) return

    appendMessage({ sender: 'user', text })
    input.value = ''

    await sendChatMessage(text)
  })
}

const userInput = document.getElementById('user-input')
if (userInput) {
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = document.getElementById('chat-form')
      form.requestSubmit()
    }
  })
}

const completionModal = document.getElementById('completion-modal')
const completionContinue = document.getElementById('completion-continue')
const completionReset = document.getElementById('completion-reset')
const completionExit = document.getElementById('completion-exit')
const backButton = document.getElementById('back-button')

function resetToSetup() {
  const chatMessages = document.getElementById('chat-messages')
  if (chatMessages) chatMessages.innerHTML = ''
  state.conversation = []
  state.hasShownCompletion = false
  togglePage(false)
}

if (completionModal) {
  if (completionContinue) completionContinue.addEventListener('click', hideCompletionModal)
  if (completionReset)
    completionReset.addEventListener('click', () => {
      hideCompletionModal()
      resetToSetup()
    })
  if (completionExit)
    completionExit.addEventListener('click', () => {
      hideCompletionModal()
      resetToSetup()
    })
  completionModal.addEventListener('click', (e) => {
    if (e.target === completionModal) {
      hideCompletionModal()
    }
  })
}

if (backButton) {
  backButton.addEventListener('click', () => {
    hideCompletionModal()
    togglePage(false)
  })
}

bindAvatarPartButtons()
updateSelectionButtons('#level-buttons .choice-button', state.level)
updateSelectionButtons('#personality-buttons .choice-button', state.personality)
updateSelectionButtons('.part-button[data-part="eyes"]', state.avatarParts.eyes)
updateSelectionButtons('.part-button[data-part="nose"]', state.avatarParts.nose)
updateSelectionButtons('.part-button[data-part="mouth"]', state.avatarParts.mouth)
updateSelectionButtons('.part-button[data-part="hair"]', state.avatarParts.hair)
updateSetupStars()
state.misconception = pickMisconception(state.level)
renderStars(state.understandingScore)
renderAvatar()
testApiConnection()