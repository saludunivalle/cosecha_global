'use client';

import { extraerHorasSemestre, obtenerValorColumna } from '@/web/lib/data-processor';
import { obtenerColumnasPorTipo } from '@/web/lib/data-processor';

interface ActivityTableProps {
  actividades: any[];
  tipoActividad: string;
  showTotal?: boolean;
}

export default function ActivityTable({
  actividades,
  tipoActividad,
  showTotal = true,
}: ActivityTableProps) {
  if (!actividades || actividades.length === 0) {
    return (
      <div className="tabla-vacia">No hay actividades registradas en esta categoría.</div>
    );
  }

  const columnasEspecificas = obtenerColumnasPorTipo(tipoActividad);
  let totalHoras = 0;

  return (
    <div className="table-responsive">
      <table className="actividades-table">
        <thead>
          <tr>
            {columnasEspecificas.map((columna) => (
              <th key={columna}>{columna}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {actividades.map((item, index) => {
            const horas = extraerHorasSemestre(obtenerValorColumna(item, 'HORAS SEMESTRE'));
            totalHoras += horas;

            return (
              <tr key={index}>
                {columnasEspecificas.map((columna) => (
                  <td key={columna}>{String(obtenerValorColumna(item, columna))}</td>
                ))}
              </tr>
            );
          })}
          {showTotal && totalHoras > 0 && (
            <tr className="total-row">
              {columnasEspecificas.map((columna, index) => {
                if (index === 0) {
                  return (
                    <td key={columna}>
                      <strong>TOTAL:</strong>
                    </td>
                  );
                }
                if (columna === 'HORAS SEMESTRE') {
                  return (
                    <td key={columna}>
                      <span className="total-badge-category">{totalHoras.toFixed(1)}</span>
                    </td>
                  );
                }
                return <td key={columna}>–</td>;
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

