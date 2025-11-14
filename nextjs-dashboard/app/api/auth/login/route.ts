import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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

    // Check if password matches
    if (password === correctPassword) {
      // Set authentication cookie
      const response = NextResponse.json({ success: true })
      
      // Set cookie with httpOnly flag for security
      response.cookies.set('dashboard_auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })

      return response
    } else {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}




