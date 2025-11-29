/**
 * API Route para obtener los últimos períodos académicos
 * GET /api/periodos?n=8
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUltimosNPeriodosDesdePortal } from '@/web/lib/univalle-api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const n = parseInt(searchParams.get('n') || '8', 10);

    if (isNaN(n) || n < 1 || n > 20) {
      return NextResponse.json(
        { error: 'El parámetro n debe ser un número entre 1 y 20' },
        { status: 400 }
      );
    }

    const periodos = await getUltimosNPeriodosDesdePortal(n);

    return NextResponse.json({ periodos }, { status: 200 });
  } catch (error) {
    console.error('Error obteniendo períodos:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener períodos',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

