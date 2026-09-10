import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  safeEqual,
} from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    // Get password from environment variable (server-side only)
    const correctPassword = process.env.DASHBOARD_PASSWORD

    if (!correctPassword) {
      return NextResponse.json(
        { error: 'Configuração de senha não encontrada' },
        { status: 500 }
      )
    }

    if (typeof password !== 'string' || !(await safeEqual(password, correctPassword))) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      )
    }

    const token = await createSessionToken()

    if (!token) {
      return NextResponse.json(
        { error: 'Configuração de senha não encontrada' },
        { status: 500 }
      )
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
