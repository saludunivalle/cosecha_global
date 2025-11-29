/**
 * API Route para obtener datos de un docente
 * GET /api/docente/[cedula]?periodo=48
 */

import { NextRequest, NextResponse } from 'next/server';
import { extraerDatosDocenteUnivalle } from '@/web/lib/univalle-api';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';

export async function GET(
  request: NextRequest,
  { params }: { params: { cedula: string } }
) {
  try {
    const { cedula } = params;
    const searchParams = request.nextUrl.searchParams;
    const periodoParam = searchParams.get('periodo');

    if (!cedula || cedula.trim() === '') {
      return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 });
    }

    // Si se especifica un período, devolver solo ese
    if (periodoParam) {
      const idPeriod = parseInt(periodoParam, 10);
      if (isNaN(idPeriod)) {
        return NextResponse.json(
          { error: 'Período inválido' },
          { status: 400 }
        );
      }

      try {
        const datos = await extraerDatosDocenteUnivalle(cedula, idPeriod);
        const resultado: ResultadoBusqueda = {
          periodo: idPeriod,
          data: datos,
          error: null,
        };
        return NextResponse.json(resultado, { status: 200 });
      } catch (error) {
        const resultado: ResultadoBusqueda = {
          periodo: idPeriod,
          data: [],
          error: error instanceof Error ? error.message : String(error),
        };
        return NextResponse.json(resultado, { status: 200 }); // 200 porque el error está en el objeto
      }
    }

    // IMPORTANTE: SIEMPRE obtener los períodos desde el portal al momento del scraping
    // para asegurar que se capture el último periodo disponible y evitar discrepancias
    const { getUltimosNPeriodosDesdePortal } = await import('@/web/lib/univalle-api');
    console.log('📡 Obteniendo períodos desde el portal antes de hacer scraping...');
    const periodos = await getUltimosNPeriodosDesdePortal(8);
    console.log(`✅ Períodos obtenidos: ${periodos.map(p => p.label).join(', ')}`);
    
    if (periodos.length === 0) {
      throw new Error('No se pudieron obtener períodos desde el portal');
    }
    
    // Verificar que el primer periodo (el más reciente) esté presente
    const ultimoPeriodo = periodos[0];
    console.log(`📅 Último periodo disponible: ${ultimoPeriodo.label} (id=${ultimoPeriodo.idPeriod})`);

    // Procesar todos los períodos en paralelo
    const promesas = periodos.map(async (periodo) => {
      try {
        const datos = await extraerDatosDocenteUnivalle(cedula, periodo.idPeriod);
        return {
          periodo: periodo.idPeriod,
          data: datos,
          error: null,
        } as ResultadoBusqueda;
      } catch (error) {
        return {
          periodo: periodo.idPeriod,
          data: [],
          error: error instanceof Error ? error.message : String(error),
        } as ResultadoBusqueda;
      }
    });

    const resultados = await Promise.all(promesas);

    // Ordenar según el orden en periodos
    resultados.sort(
      (a, b) =>
        periodos.findIndex((p) => p.idPeriod === a.periodo) -
        periodos.findIndex((p) => p.idPeriod === b.periodo)
    );

    // IMPORTANTE: Devolver también los periodos obtenidos para que el frontend
    // pueda actualizar los nombres y asegurar consistencia
    return NextResponse.json({ 
      resultados,
      periodos // Incluir periodos para que el frontend los use
    }, { status: 200 });
  } catch (error) {
    console.error('Error obteniendo datos del docente:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener datos del docente',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

