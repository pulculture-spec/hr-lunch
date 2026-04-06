import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const KEY = 'hr_lunch_schedule'

export async function GET() {
  try {
    const data = await redis.get(KEY)
    return Response.json(data || {})
  } catch (e) {
    return Response.json({}, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    await redis.set(KEY, body)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false }, { status: 500 })
  }
}
