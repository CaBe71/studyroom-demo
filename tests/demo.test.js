import test from 'node:test'
import assert from 'node:assert/strict'
import { createDemoService, STORAGE_KEY } from '../src/demo.js'

function setup() {
  const data = new Map()
  const storage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) }
  let real = Date.parse('2026-11-17T12:00:00+08:00')
  const service = createDemoService(storage, () => real)
  const api = (path, body, method) => service.request(path, body === undefined ? {} : { method: method || 'POST', body: JSON.stringify(body) })
  const login = (username) => api('/login', { username, password: 'Study@2026' })
  const day = '2026-11-17'
  return { data, storage, service, api, login, day, tick: n => { real += n } }
}

test('first visit seeds rooms, history, seats and an immediately signable reservation', () => {
  const { api, login, day } = setup()
  assert.equal(api('/session').user, null)
  assert.throws(() => api('/rooms'), { status: 401 })
  login('student')
  assert.equal(api('/rooms').length, 2)
  const mine = api('/reservations')
  assert.ok(mine.some(b => b.status === 'COMPLETED'))
  const active = mine.find(b => b.bookingDate === day && b.status === 'WAITING')
  assert.ok(active)
  api(`/reservations/${active.id}/checkin`, {})
  assert.equal(api('/reservations').find(b => b.id === active.id).status, 'CHECKED_IN')
})

test('wrong password, foreign reservation and student administration are rejected', () => {
  const { api, login } = setup()
  assert.throws(() => api('/login', { username: 'admin', password: 'bad' }), { status: 401 })
  login('student')
  assert.throws(() => api('/admin/stats'), { status: 403 })
  const mine = api('/reservations')
  login('student2')
  assert.throws(() => api(`/reservations/${mine[0].id}/cancel`, {}), { status: 403 })
})

test('seat and user conflicts are rejected across account switches, cancellation releases seat', () => {
  const { api, login, day } = setup()
  login('student')
  const b = api('/reservations', { seatId: 2, slotId: 2, date: day })
  assert.throws(() => api('/reservations', { seatId: 4, slotId: 2, date: day }), /该时段已有预约/)
  login('student2')
  assert.throws(() => api('/reservations', { seatId: 2, slotId: 2, date: day }), /该座位已被预约/)
  login('student')
  api(`/reservations/${b.id}/cancel`, {})
  login('student2')
  assert.equal(api('/reservations', { seatId: 2, slotId: 2, date: day }).status, 'WAITING')
})

test('sign-in only works in its window and checked-in reservations complete at slot end', () => {
  const { api, login, service, day } = setup()
  login('student')
  const b = api('/reservations', { seatId: 4, slotId: 2, date: day })
  assert.throws(() => api(`/reservations/${b.id}/checkin`, {}), /尚未到签到时间/)
  service.setTime(day + 'T10:00:00')
  api(`/reservations/${b.id}/checkin`, {})
  assert.throws(() => api(`/reservations/${b.id}/cancel`, {}), /不可取消/)
  service.setTime(day + 'T12:00:00')
  assert.equal(api('/reservations').find(x => x.id === b.id).status, 'COMPLETED')
  login('admin')
  assert.ok(api('/admin/logs').some(x => x.action === 'COMPLETED' && x.targetId === b.id))
})

test('exact deadline is missed and releases occupancy even when attempted sign-in fails', () => {
  const { api, login, service, day } = setup()
  login('student')
  const b = api('/reservations').find(x => x.bookingDate === day && x.status === 'WAITING')
  service.setTime(b.checkinDeadline)
  assert.throws(() => api(`/reservations/${b.id}/checkin`, {}), /不可签到/)
  assert.equal(api('/reservations').find(x => x.id === b.id).status, 'MISSED')
  assert.equal(api(`/rooms/1/seats?date=${day}&slotId=1`).find(x => x.id === b.seatId).reservationId, null)
})

test('remaining 15 minutes, past date, beyond 7 days, and disabled seats are rejected', () => {
  const { api, login, service, day } = setup()
  login('student')
  assert.throws(() => api('/reservations', { seatId: 2, slotId: 2, date: '2026-11-16' }), /未来6天/)
  assert.throws(() => api('/reservations', { seatId: 2, slotId: 2, date: '2026-11-24' }), /未来6天/)
  assert.throws(() => api('/reservations', { seatId: 48, slotId: 2, date: day }), /已停用/)
  service.setTime(day + 'T09:45:00')
  assert.throws(() => api('/reservations', { seatId: 2, slotId: 1, date: day }), /不足15分钟/)
})

test('administrator cancellation requires reason, permits used booking, updates attendance', () => {
  const { api, login } = setup()
  login('admin')
  const b = api('/admin/reservations').find(x => x.status === 'CHECKED_IN')
  assert.throws(() => api(`/admin/reservations/${b.id}/cancel`, { reason: ' ' }), /取消原因/)
  api(`/admin/reservations/${b.id}/cancel`, { reason: '设备维护' })
  const cancelled = api('/admin/reservations').find(x => x.id === b.id)
  assert.equal(cancelled.status, 'CANCELLED')
  assert.equal(cancelled.cancelReason, '设备维护')
  assert.equal(api('/admin/stats').attended, 1)
})

test('maintenance blocks active bookings; new room generates seats and closed room is unavailable', () => {
  const { api, login, day } = setup()
  login('admin')
  assert.throws(() => api('/admin/seats/3', { enabled: false }, 'PATCH'), /有效预约/)
  assert.throws(() => api('/admin/rooms/1', { enabled: false }, 'PATCH'), /有效预约/)
  assert.throws(() => api('/admin/rooms', { name: '测试', location: '1楼', rows: 1.5, columns: 2 }), /整数/)
  const r = api('/admin/rooms', { name: '测试自习室', location: '1楼', description: '测试', rows: 2, columns: 3 })
  const seats = api(`/rooms/${r.id}/seats?date=${day}&slotId=1`)
  assert.equal(seats.length, 6)
  api(`/admin/rooms/${r.id}`, { enabled: false }, 'PATCH')
  login('student')
  assert.ok(!api('/rooms').some(x => x.id === r.id))
  assert.throws(() => api('/reservations', { seatId: seats[0].id, slotId: 2, date: day }), /已停用/)
})

test('storage survives service reload; clock advances, forbids rewind, and reset is local', () => {
  const { api, login, service, storage, tick, day } = setup()
  login('student')
  api('/reservations', { seatId: 2, slotId: 2, date: day })
  const before = api('/reservations').length
  const reloaded = createDemoService(storage, () => Date.parse('2026-11-17T12:00:00+08:00'))
  assert.equal(reloaded.request('/reservations').length, before)
  assert.equal(reloaded.request('/session').user.username, 'student')
  tick(60_000)
  assert.equal(service.getTime(), day + 'T09:06:00')
  service.advance(15)
  assert.equal(service.getTime(), day + 'T09:21:00')
  assert.throws(() => service.setTime(day + 'T09:05:00'), /只支持向前/)
  service.reset()
  assert.equal(api('/session').user.username, 'student')
  assert.equal(api('/reservations').length, before - 1)
  assert.equal(service.getTime(), day + 'T09:05:00')
})

test('damaged data recovers to a usable seed, denied storage returns actionable error', () => {
  const { storage, data, api } = setup()
  data.set(STORAGE_KEY, '{bad json')
  assert.equal(api('/session').recovered, true)
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).rooms.length, 2)
  const denied = createDemoService({ getItem() { throw Error('blocked') } })
  assert.throws(() => denied.request('/session'), /禁止本地存储/)
})
