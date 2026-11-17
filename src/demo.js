// Entirely browser-local simulation. No HTTP requests or real authentication.
export const STORAGE_KEY = 'yuejian.studyroom-demo.v1'
export const DEMO_PASSWORD = 'Study@2026'
const MINUTE = 60_000
const ACTIVE = ['WAITING', 'CHECKED_IN']
const USERS = [
  { id: 1, username: 'admin', displayName: '自习室管理员', role: 'ADMIN', enabled: true },
  { id: 2, username: 'student', displayName: '林同学', role: 'STUDENT', enabled: true },
  { id: 3, username: 'student2', displayName: '陈同学', role: 'STUDENT', enabled: true }
]
const SLOTS = [
  { id: 1, name: '晨间专注', startTime: '08:00:00', endTime: '10:00:00' },
  { id: 2, name: '上午时光', startTime: '10:00:00', endTime: '12:00:00' },
  { id: 3, name: '午后研读', startTime: '14:00:00', endTime: '16:00:00' },
  { id: 4, name: '傍晚自习', startTime: '16:00:00', endTime: '18:00:00' },
  { id: 5, name: '夜读时光', startTime: '19:00:00', endTime: '21:00:00' }
]
const copy = (value) => structuredClone(value)
const localTime = (ms) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 19)
const localDate = (ms) => localTime(ms).slice(0, 10)
const parse = (value) => Date.parse(value + '+08:00')
const dayAfter = (day, n) => localDate(parse(day + 'T12:00:00') + n * 86400_000)
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }

function addLog(state, actorId, action, targetId, detail, ms) {
  state.logs.push({ id: state.nextLogId++, actorId, action, targetId, detail, createdAt: localTime(ms) })
  state.logs = state.logs.slice(-200)
}

function addSeats(state, roomId, rows, columns, prefix) {
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns; col++) {
      const index = (row - 1) * columns + col
      state.seats.push({ id: state.nextSeatId++, roomId, code: prefix + String(index).padStart(2, '0'),
        rowNo: row, colNo: col, enabled: true, hasPower: col % 2 === 0 || roomId === 2,
        nearWindow: col === 1 || col === columns })
    }
  }
}

function seed(realNow, username = null) {
  const today = localDate(realNow)
  const start = parse(today + 'T09:05:00')
  const state = { version: 1, username, clock: { time: start, real: realNow },
    rooms: [
      { id: 1, name: '静思自习室', location: '图书馆 · 二楼东侧', description: '临窗自然光，适合阅读与独立思考', enabled: true },
      { id: 2, name: '知行自习室', location: '教学楼 · 三楼 302', description: '插座充足，适合电脑学习与课程项目', enabled: true }
    ], seats: [], bookings: [], logs: [], nextSeatId: 1, nextRoomId: 3, nextBookingId: 1, nextLogId: 1 }
  addSeats(state, 1, 4, 6, 'A')
  addSeats(state, 2, 4, 6, 'B')
  state.seats.at(-1).enabled = false
  function record(userId, seatId, slotId, day, status, createdAt, checkedInAt = null) {
    const slot = SLOTS.find(x => x.id === slotId)
    const deadline = localTime(Math.max(parse(createdAt), parse(day + 'T' + slot.startTime)) + 15 * MINUTE)
    const row = { id: state.nextBookingId++, userId, seatId, slotId, bookingDate: day, status,
      createdAt, checkinDeadline: deadline, checkedInAt, cancelReason: status === 'CANCELLED' ? '学生主动取消' : null,
      endedAt: ACTIVE.includes(status) ? null : status === 'MISSED' ? deadline : day + 'T' + slot.endTime }
    state.bookings.push(row)
    addLog(state, userId, 'BOOK', row.id, '模拟预约 · ' + state.seats.find(s => s.id === seatId).code, parse(createdAt))
    if (checkedInAt) addLog(state, userId, 'CHECK_IN', row.id, '模拟签到', parse(checkedInAt))
    if (!ACTIVE.includes(status)) addLog(state, status === 'CANCELLED' ? userId : null,
      status === 'CANCELLED' ? 'CANCEL' : status, row.id, '预置演示记录', parse(row.endedAt))
  }
  for (let n = 6; n >= 1; n--) {
    const day = dayAfter(today, -n)
    for (let i = 0; i < (n % 3) + 2; i++) {
      const status = i === 1 && n % 2 === 0 ? 'MISSED' : i === 2 ? 'CANCELLED' : 'COMPLETED'
      record(i % 2 ? 3 : 2, 1 + i + (n % 2) * 24, 1 + i, day, status,
        day + 'T07:40:00', status === 'COMPLETED' ? day + 'T' + SLOTS[i].startTime : null)
    }
  }
  record(3, 1, 1, today, 'CHECKED_IN', today + 'T07:50:00', today + 'T08:03:00')
  record(2, 3, 1, today, 'WAITING', today + 'T09:05:00')
  record(2, 9, 3, dayAfter(today, 1), 'WAITING', today + 'T08:30:00')
  record(3, 27, 2, dayAfter(today, 1), 'WAITING', today + 'T08:40:00')
  state.logs.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
  state.logs.forEach((log, index) => { log.id = index + 1 })
  state.nextLogId = state.logs.length + 1
  return state
}

function validState(s) {
  return s?.version === 1 && Number.isFinite(s.clock?.time) && Number.isFinite(s.clock?.real) &&
    ['rooms', 'seats', 'bookings', 'logs'].every(k => Array.isArray(s[k])) &&
    ['nextSeatId', 'nextRoomId', 'nextBookingId', 'nextLogId'].every(k => Number.isInteger(s[k]) && s[k] > 0) &&
    s.rooms.every(r => Number.isInteger(r.id) && typeof r.name === 'string' && typeof r.enabled === 'boolean') &&
    s.seats.every(r => Number.isInteger(r.id) && s.rooms.some(room => room.id === r.roomId)) &&
    s.bookings.every(b => Number.isInteger(b.id) && USERS.some(u => u.id === b.userId) &&
      s.seats.some(seat => seat.id === b.seatId) && SLOTS.some(slot => slot.id === b.slotId) &&
      [...ACTIVE, 'MISSED', 'COMPLETED', 'CANCELLED'].includes(b.status) && Number.isFinite(parse(b.checkinDeadline)))
}

// Injectable storage and time keep the core rules independently testable.
export function createDemoService(storage, realNow = () => Date.now()) {
  let recovered = false
  function read() {
    let raw
    try { raw = storage.getItem(STORAGE_KEY) } catch { fail('浏览器禁止本地存储，请允许此网站保存数据后重试。') }
    if (raw) {
      try { const state = JSON.parse(raw); if (validState(state)) return state } catch { /* reset damaged demo data */ }
      recovered = true
    }
    const state = seed(realNow())
    save(state)
    return state
  }
  function save(state) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)) }
    catch { fail('演示数据保存失败，请检查浏览器存储空间和网站存储权限。') }
  }
  const now = (s) => s.clock.time + Math.max(0, realNow() - s.clock.real)
  function sweep(s) {
    const ms = now(s)
    for (const b of s.bookings) {
      const slot = SLOTS.find(x => x.id === b.slotId)
      const missed = b.status === 'WAITING' && ms >= parse(b.checkinDeadline)
      const completed = b.status === 'CHECKED_IN' && ms >= parse(b.bookingDate + 'T' + slot.endTime)
      if (missed || completed) {
        b.status = missed ? 'MISSED' : 'COMPLETED'
        b.endedAt = missed ? b.checkinDeadline : b.bookingDate + 'T' + slot.endTime
        addLog(s, null, b.status, b.id, missed ? '演示时间到达签到截止，自动释放座位' : '演示时段结束，自动完成', ms)
      }
    }
  }
  function reservations(s, userId = null) {
    return s.bookings.filter(b => userId === null || b.userId === userId).slice().reverse().slice(0, 500).map(b => {
      const seat = s.seats.find(x => x.id === b.seatId)
      const room = s.rooms.find(x => x.id === seat.roomId)
      const slot = SLOTS.find(x => x.id === b.slotId)
      const user = USERS.find(x => x.id === b.userId)
      return { ...b, seatCode: seat.code, rowNo: seat.rowNo, colNo: seat.colNo, roomName: room.name,
        location: room.location, slotName: slot.name, startTime: slot.startTime, endTime: slot.endTime,
        username: user.username, displayName: user.displayName }
    })
  }
  function request(path, options = {}) {
    const s = read()
    sweep(s)
    // Sweep results survive a subsequently rejected user action.
    save(s)
    const method = options.method || 'GET'
    const url = new URL(path, 'https://demo.invalid')
    const route = url.pathname
    const body = options.body instanceof URLSearchParams ? Object.fromEntries(options.body) :
      typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {}
    const user = USERS.find(x => x.username === s.username) || null
    const ms = now(s)
    const log = (action, id, detail) => addLog(s, user?.id, action, id, detail, ms)
    const finish = (result) => { save(s); return copy(result) }
    if (route === '/session' && method === 'GET') return finish({ user, csrfToken: 'browser-demo', serverTime: localTime(ms), recovered })
    if (route === '/login' && method === 'POST') {
      const account = USERS.find(x => x.username === body.username)
      if (!account || body.password !== DEMO_PASSWORD) fail('模拟账号或密码错误，请使用页面提供的演示账号。', 401)
      s.username = account.username
      return finish({ ok: true })
    }
    if (route === '/logout' && method === 'POST') { s.username = null; return finish({ ok: true }) }
    if (!user) fail('请先登录演示账号', 401)
    if (route.startsWith('/admin/') && user.role !== 'ADMIN') fail('请切换管理员演示账号', 403)
    if ((route === '/rooms' || route === '/admin/rooms') && method === 'GET') {
      return finish(s.rooms.filter(r => route.includes('/admin/') || r.enabled).map(r => ({ ...r,
        seatCount: s.seats.filter(x => x.roomId === r.id).length,
        enabledSeats: s.seats.filter(x => x.roomId === r.id && x.enabled).length })))
    }
    if (route === '/slots' && method === 'GET') return finish(SLOTS)
    let match = route.match(/^\/rooms\/(\d+)\/seats$/)
    if (match && method === 'GET') {
      const roomId = Number(match[1]), day = url.searchParams.get('date'), slotId = Number(url.searchParams.get('slotId'))
      const room = s.rooms.find(r => r.id === roomId)
      if (!room || (!room.enabled && user.role !== 'ADMIN')) fail('自习室未开放', 404)
      return finish(s.seats.filter(x => x.roomId === roomId).map(seat => {
        const b = s.bookings.find(b => b.seatId === seat.id && b.bookingDate === day && b.slotId === slotId && ACTIVE.includes(b.status))
        return { ...seat, reservationId: b?.id || null, occupiedBy: b?.userId || null, mine: b?.userId === user.id }
      }))
    }
    if ((route === '/reservations' || route === '/admin/reservations') && method === 'GET') {
      return finish(reservations(s, route.includes('/admin/') ? null : user.id))
    }
    if (route === '/reservations' && method === 'POST') {
      const today = localDate(ms), day = body.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parse(day + 'T00:00:00')) || day < today || day > dayAfter(today, 6))
        fail('仅可预约演示时间的今天及未来6天')
      const seat = s.seats.find(x => x.id === Number(body.seatId))
      const slot = SLOTS.find(x => x.id === Number(body.slotId))
      if (!seat || !slot) fail('请选择有效座位和时段')
      const room = s.rooms.find(x => x.id === seat.roomId)
      if (!seat.enabled || !room.enabled) fail('自习室或座位已停用', 409)
      if (parse(day + 'T' + slot.endTime) - ms <= 15 * MINUTE) fail('该时段已结束或剩余时间不足15分钟')
      const occupied = s.bookings.filter(b => b.bookingDate === day && b.slotId === slot.id && ACTIVE.includes(b.status))
      if (occupied.some(b => b.userId === user.id)) fail('你在该时段已有预约，请先取消原预约', 409)
      if (occupied.some(b => b.seatId === seat.id)) fail('该座位已被预约，请选择其他座位', 409)
      const b = { id: s.nextBookingId++, userId: user.id, seatId: seat.id, slotId: slot.id, bookingDate: day,
        status: 'WAITING', createdAt: localTime(ms), checkinDeadline: localTime(Math.max(ms, parse(day + 'T' + slot.startTime)) + 15 * MINUTE),
        checkedInAt: null, endedAt: null, cancelReason: null }
      s.bookings.push(b)
      log('BOOK', b.id, '模拟预约座位 ' + seat.code)
      return finish(reservations(s).find(x => x.id === b.id))
    }
    match = route.match(/^\/(admin\/)?reservations\/(\d+)\/(cancel|checkin)$/)
    if (match && method === 'POST') {
      const admin = Boolean(match[1]), id = Number(match[2]), action = match[3]
      const b = s.bookings.find(x => x.id === id)
      if (!b) fail('预约不存在', 404)
      if (!admin && b.userId !== user.id) fail('只能操作本人的预约', 403)
      if (action === 'checkin') {
        if (admin || b.status !== 'WAITING') fail('该预约当前状态不可签到', 409)
        const slot = SLOTS.find(x => x.id === b.slotId)
        if (ms < parse(b.bookingDate + 'T' + slot.startTime)) fail('尚未到签到时间，可在演示控制台调整时间')
        if (ms >= parse(b.checkinDeadline)) fail('已超过签到截止时间', 409)
        b.status = 'CHECKED_IN'; b.checkedInAt = localTime(ms)
        log('CHECK_IN', id, '学生模拟网页签到')
      } else {
        if (b.status !== 'WAITING' && !(admin && b.status === 'CHECKED_IN')) fail('该预约当前状态不可取消', 409)
        const reason = admin ? String(body.reason || '').trim() : '学生主动取消'
        if (!reason || reason.length > 200) fail('请填写不超过200字的取消原因')
        b.status = 'CANCELLED'; b.endedAt = localTime(ms); b.cancelReason = reason
        log('CANCEL', id, reason)
      }
      return finish({ ok: true })
    }
    match = route.match(/^\/admin\/(seats|rooms)\/(\d+)$/)
    if (match && method === 'PATCH') {
      const isSeat = match[1] === 'seats', id = Number(match[2])
      const target = (isSeat ? s.seats : s.rooms).find(x => x.id === id)
      if (!target) fail('场地或座位不存在', 404)
      if (typeof body.enabled !== 'boolean') fail('状态参数无效')
      if (!body.enabled && s.bookings.some(b => ACTIVE.includes(b.status) &&
        (isSeat ? b.seatId === id : s.seats.find(x => x.id === b.seatId).roomId === id)))
        fail('存在有效预约，请先处理预约再停用', 409)
      target.enabled = body.enabled
      log(isSeat ? 'SEAT_STATUS' : 'ROOM_STATUS', id, (body.enabled ? '启用' : '停用') + (isSeat ? target.code : target.name))
      return finish({ ok: true })
    }
    if (route === '/admin/rooms' && method === 'POST') {
      const name = String(body.name || '').trim(), location = String(body.location || '').trim(), description = String(body.description || '').trim()
      const rows = Number(body.rows), columns = Number(body.columns)
      if (!name || name.length > 60 || !location || location.length > 120 || description.length > 300) fail('请填写有效的名称、位置和说明')
      if (![rows, columns].every(n => Number.isInteger(n) && n >= 1 && n <= 10)) fail('行列数须为1至10之间的整数')
      const id = s.nextRoomId++
      s.rooms.push({ id, name, location, description, enabled: true })
      addSeats(s, id, rows, columns, 'S')
      log('CREATE_ROOM', id, '创建演示自习室 ' + name)
      return finish({ id })
    }
    if (route === '/admin/logs' && method === 'GET') return finish(s.logs.slice().reverse().map(l => ({ ...l,
      displayName: USERS.find(x => x.id === l.actorId)?.displayName || null })))
    if (route === '/admin/stats' && method === 'GET') {
      const today = localDate(ms), rows = s.bookings.filter(b => b.bookingDate === today)
      return finish({ total: rows.length, waiting: rows.filter(b => b.status === 'WAITING').length,
        checkedIn: rows.filter(b => b.status === 'CHECKED_IN').length, missed: rows.filter(b => b.status === 'MISSED').length,
        attended: rows.filter(b => b.checkedInAt).length,
        seatCount: s.seats.filter(x => x.enabled && s.rooms.find(r => r.id === x.roomId).enabled).length,
        trend: Array.from({ length: 7 }, (_, i) => ({ bookingDate: dayAfter(today, i - 6),
          total: s.bookings.filter(b => b.bookingDate === dayAfter(today, i - 6)).length })) })
    }
    fail('演示功能暂不支持此操作', 404)
  }
  function setTime(value) {
    const target = parse(value.length === 16 ? value + ':00' : value)
    if (!Number.isFinite(target)) fail('请选择有效的演示时间')
    const s = read()
    if (target < now(s)) fail('演示时间只支持向前推进；回到初始时间请重置数据。')
    s.clock = { time: target, real: realNow() }
    addLog(s, null, 'DEMO_TIME', 0, '调整演示时间至 ' + localTime(target).replace('T', ' '), target)
    sweep(s); save(s)
    return localTime(target)
  }
  return {
    request,
    setTime,
    advance(minutes) {
      if (!Number.isFinite(minutes) || minutes <= 0) fail('推进分钟数无效')
      return setTime(localTime(now(read()) + minutes * MINUTE))
    },
    reset() { const s = seed(realNow(), read().username); save(s); recovered = false },
    getTime() { return localTime(now(read())) }
  }
}

let browserService
export function getDemoService() {
  if (!browserService) browserService = createDemoService(window.localStorage)
  return browserService
}
