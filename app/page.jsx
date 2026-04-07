'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

const MEMBERS = ['임성재', '김지형', '안수민']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAYS = ['일','월','화','수','목','금','토']

const UPSTASH_URL = process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN
const KEY = 'hr_lunch_schedule'

async function redisGet() {
  const res = await fetch(`${UPSTASH_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  })
  const json = await res.json()
  if (!json.result) return {}
  try { return JSON.parse(json.result) } catch { return {} }
}

async function redisSet(data) {
  await fetch(`${UPSTASH_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(data)),
  })
}

function dayKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Home() {  
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [schedules, setSchedules] = useState({})
  const [syncStatus, setSyncStatus] = useState('loading')
  const [modal, setModal] = useState(null)
  const [editState, setEditState] = useState({})
  const [today, setToday] = useState(new Date())
  const saveTimer = useRef(null)
  useEffect(() => {
  const now = new Date()
  const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now
  const timer = setTimeout(() => setToday(new Date()), msUntilMidnight)
  return () => clearTimeout(timer)
}, [today])

  const fetchData = useCallback(async () => {
    setSyncStatus('loading')
    try {
      const data = await redisGet()
      setSchedules(data)
      setSyncStatus('ok')
    } catch {
      setSyncStatus('error')
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const iv = setInterval(fetchData, 30000)
    return () => clearInterval(iv)
  }, [fetchData])

  function debounceSave(newSchedules) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSyncStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        await redisSet(newSchedules)
        setSyncStatus('ok')
      } catch {
        setSyncStatus('error')
      }
    }, 600)
  }

  function changeMonth(delta) {
    let m = month + delta
    if (m < 0) { setYear(y => y - 1); setMonth(11) }
    else if (m > 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m)
  }

  function openModal(y, m, d) {
    const dow = new Date(y, m, d).getDay()
    if (dow === 0 || dow === 6) return
    const k = dayKey(y, m, d)
    const existing = schedules[k] || {}
    const state = {}
    MEMBERS.forEach(mem => { state[mem] = existing[mem] || 'none' })
    setEditState(state)
    setModal({ year: y, month: m, day: d })
  }

  function setStatus(mem, st) {
    const newEdit = { ...editState, [mem]: st }
    setEditState(newEdit)
    const k = dayKey(modal.year, modal.month, modal.day)
    const newSchedules = { ...schedules, [k]: { ...newEdit } }
    setSchedules(newSchedules)
    debounceSave(newSchedules)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const syncLabel = { loading: '불러오는 중...', ok: '팀 전체 공유 중 · 30초마다 자동 새로고침', saving: '저장 중...', error: '저장 실패' }[syncStatus]
  const syncColor = { loading: '#EF9F27', ok: '#639922', saving: '#EF9F27', error: '#E24B4A' }[syncStatus]

  const togetherInModal = MEMBERS.filter(m => (editState[m] || 'none') === 'none')
  const absentInModal = MEMBERS.filter(m => (editState[m] || 'none') !== 'none')

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '1.25rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>인사혁신팀 점심 일정</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => changeMonth(-1)} style={navBtn}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 500, minWidth: 90, textAlign: 'center' }}>{year}년 {MONTHS[month]}</span>
          <button onClick={() => changeMonth(1)} style={navBtn}>›</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#666', marginBottom: '0.75rem', padding: '7px 12px', background: '#f5f5f3', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: syncColor, flexShrink: 0 }} />
        {syncLabel}
        <button onClick={fetchData} style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', border: '0.5px solid #ccc', borderRadius: 6, background: 'none', cursor: 'pointer', color: '#666' }}>새로고침</button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['#E24B4A','연차'],['#378ADD','다른 약속'],['#639922','전원 같이 점심']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />{label}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, color: i===0?'#E24B4A':i===6?'#378ADD':'#888', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const date = new Date(year, month, d)
          const dow = date.getDay()
          const isWeekend = dow === 0 || dow === 6
          const isToday = date.toDateString() === today.toDateString()
          const k = dayKey(year, month, d)
          const ds = schedules[k] || {}
          const absentList = MEMBERS.filter(m => (ds[m] || 'none') !== 'none')

          return (
            <div key={d} onClick={() => openModal(year, month, d)} style={{
              border: '0.5px solid #e0e0dd', borderRadius: 8, padding: '6px 6px 8px',
              minHeight: 90, cursor: isWeekend ? 'default' : 'pointer',
              background: '#fff', opacity: isWeekend ? 0.5 : 1,
            }}>
              <div style={{
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, marginBottom: 4, borderRadius: '50%',
                background: isToday ? '#378ADD' : 'none',
                color: isToday ? '#fff' : dow===0 ? '#E24B4A' : dow===6 ? '#378ADD' : '#111',
                fontWeight: isToday ? 500 : 400,
              }}>{d}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {!isWeekend && absentList.map(mem => (
                  <div key={mem} style={{
                    fontSize: 11, padding: '2px 5px', borderRadius: 4,
                    background: ds[mem]==='annual' ? '#FCEBEB' : '#E6F1FB',
                    color: ds[mem]==='annual' ? '#A32D2D' : '#185FA5',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{mem.slice(-2)} · {ds[mem]==='annual' ? '연차' : '약속'}</div>
                ))}
                {!isWeekend && absentList.length === 0 && (
                  <div style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: '#EAF3DE', color: '#3B6D11', textAlign: 'center', marginTop: 4 }}>전원 점심</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #ddd', padding: '1.25rem', width: 320, maxWidth: '95vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
              {modal.year}년 {MONTHS[modal.month]} {modal.day}일 ({DAYS[new Date(modal.year, modal.month, modal.day).getDay()]})
            </h3>
            <p style={{ fontSize: 13, color: '#888', marginBottom: '1rem' }}>팀원별 점심 상태를 설정하세요</p>
            {MEMBERS.map((mem, idx) => {
              const st = editState[mem] || 'none'
              return (
                <div key={mem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < MEMBERS.length-1 ? '0.5px solid #eee' : 'none' }}>
                  <span style={{ fontSize: 14 }}>{mem}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['none','가능'],['annual','연차'],['other','약속']].map(([val, label]) => (
                      <button key={val} onClick={() => setStatus(mem, val)} style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                        border: st===val ? (val==='annual'?'1px solid #F09595':val==='other'?'1px solid #85B7EB':'1px solid #aaa') : '0.5px solid #ddd',
                        background: st===val ? (val==='annual'?'#FCEBEB':val==='other'?'#E6F1FB':'#f0f0ee') : 'none',
                        color: st===val ? (val==='annual'?'#A32D2D':val==='other'?'#185FA5':'#333') : '#888',
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: '0.75rem', padding: '8px 10px', borderRadius: 8, background: '#f5f5f3', fontSize: 13, color: '#666' }}>
              {absentInModal.length === 0
                ? <><span style={{ color:'#111', fontWeight:500 }}>전원 점심 가능</span> — 같이 먹어요!</>
                : togetherInModal.length === 0
                ? <><span style={{ color:'#111', fontWeight:500 }}>전원 자리 비움</span> — 각자 점심</>
                : <>같이 점심: <span style={{ color:'#111', fontWeight:500 }}>{togetherInModal.join(', ')}</span></>
              }
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ fontSize: 14, padding: '6px 16px', borderRadius: 8, border: '0.5px solid #ddd', background: 'none', cursor: 'pointer', color: '#666' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const navBtn = { background: 'none', border: '0.5px solid #ccc', borderRadius: 8, padding: '4px 12px', fontSize: 16, cursor: 'pointer', color: '#333' }
