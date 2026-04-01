// Removed: Supabase diagnose endpoint is no longer supported.
        `,
        suggestion: 'Ve a Supabase Dashboard → Authentication → Users y verifica que el usuario exista',
      }, { status: 401 })
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: 'Login successful',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
      },
    })
  } catch (error) {
    console.error('[AUTH-DIAG] Exception:', error)
    return NextResponse.json({
      status: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
      trace: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'POST with {email, password} to test auth',
    example: {
      email: 'test@example.com',
      password: 'testpass123',
    },
  })
}
