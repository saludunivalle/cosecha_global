'use client';

import { useState } from 'react';
import ActivityTable from './ActivityTable';
import { extraerHorasSemestre } from '@/web/lib/data-processor';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';
import type { DatosConsolidados } from '@/web/lib/types';

interface ActivityViewProps {
  resultados: ResultadoBusqueda[];
  datosConsolidados: DatosConsolidados;
  periodosNombres: Record<number, string>;
  periodos: number[];
}

export default function ActivityView({
  resultados,
  datosConsolidados,
  periodosNombres,
  periodos,
}: ActivityViewProps) {
  return (
    <>
      {/* ACTIVIDADES DE DOCENCIA */}
      <ActividadDocenciaConPeriodos
        datosConsolidados={datosConsolidados}
        periodosNombres={periodosNombres}
        periodos={periodos}
      />

      {/* OTRAS ACTIVIDADES */}
      <OtraActividadConPeriodos
        actividadesPorPeriodo={datosConsolidados.actividadesInvestigacion}
        nombreActividad="ACTIVIDADES DE INVESTIGACION"
        periodosNombres={periodosNombres}
        periodos={periodos}
      />

      <OtraActividadConPeriodos
        actividadesPorPeriodo={datosConsolidados.actividadesExtension}
        nombreActividad="ACTIVIDADES DE EXTENSION"
        periodosNombres={periodosNombres}
        periodos={periodos}
      />

      <OtraActividadConPeriodos
        actividadesPorPeriodo={datosConsolidados.actividadesIntelectualesOArtisticas}
        nombreActividad="ACTIVIDADES INTELECTUALES O ARTISTICAS"
        periodosNombres={periodosNombres}
        periodos={periodos}
      />

      <OtraActividadConPeriodos
        actividadesPorPeriodo={datosConsolidados.actividadesAdministrativas}
        nombreActividad="ACTIVIDADES ADMINISTRATIVAS"
        periodosNombres={periodosNombres}
        periodos={periodos}
      />

      <OtraActividadConPeriodos
        actividadesPorPeriodo={datosConsolidados.actividadesComplementarias}
        nombreActividad="ACTIVIDADES COMPLEMENTARIAS"
        periodosNombres={periodosNombres}
        periodos={periodos}
      />

      <OtraActividadConPeriodos
        actividadesPorPeriodo={datosConsolidados.docenteEnComision}
        nombreActividad="DOCENTE EN COMISION"
        periodosNombres={periodosNombres}
        periodos={periodos}
      />
    </>
  );
}

function ActividadDocenciaConPeriodos({
  datosConsolidados,
  periodosNombres,
  periodos,
}: {
  datosConsolidados: DatosConsolidados;
  periodosNombres: Record<number, string>;
  periodos: number[];
}) {
  const [collapsed, setCollapsed] = useState(true);
  let totalGeneral = 0;

  const categoriasDocencia = [
    { key: 'pregrado' as const, name: 'PREGRADO' },
    { key: 'postgrado' as const, name: 'POSTGRADO' },
    { key: 'direccionTesis' as const, name: 'DIRECCIÓN DE TESIS' },
  ];

  categoriasDocencia.forEach(({ key }) => {
    const actividadesPorPeriodo = datosConsolidados[key] || {};
    Object.values(actividadesPorPeriodo).forEach((actividades) => {
      if (Array.isArray(actividades)) {
        actividades.forEach((act) => {
          totalGeneral += extraerHorasSemestre(act['HORAS SEMESTRE']);
        });
      }
    });
  });

  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="categoria-header" onClick={() => setCollapsed(!collapsed)}>
        <span>ACTIVIDADES DE DOCENCIA</span>
        <div>
          <span className="total-badge-section">
            Total histórico: {totalGeneral.toFixed(1)} horas
          </span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && (
        <div className="categoria-content">
          {categoriasDocencia.map(({ key, name }) => (
            <CategoriaConPeriodos
              key={key}
              actividadesPorPeriodo={datosConsolidados[key] || {}}
              nombreCategoria={name}
              periodosNombres={periodosNombres}
              periodos={periodos}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriaConPeriodos({
  actividadesPorPeriodo,
  nombreCategoria,
  periodosNombres,
  periodos,
}: {
  actividadesPorPeriodo: Record<number, any[]>;
  nombreCategoria: string;
  periodosNombres: Record<number, string>;
  periodos: number[];
}) {
  const [collapsed, setCollapsed] = useState(true);
  let totalCategoria = 0;

  Object.values(actividadesPorPeriodo).forEach((actividades) => {
    if (Array.isArray(actividades)) {
      actividades.forEach((act) => {
        totalCategoria += extraerHorasSemestre(act['HORAS SEMESTRE']);
      });
    }
  });

  const tipoActividad = nombreCategoria.toLowerCase().replace(/\s+/g, '');

  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`} style={{ marginLeft: '20px' }}>
      <div
        className="categoria-header"
        style={{ backgroundColor: '#f8f9fa' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>{nombreCategoria}</span>
        <div>
          <span className="total-badge-category">Total: {totalCategoria.toFixed(1)} horas</span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && (
        <div className="categoria-content">
          {periodos.map((periodo) => {
            const actividades = actividadesPorPeriodo[periodo];
            if (!actividades || !Array.isArray(actividades) || actividades.length === 0) {
              return null;
            }

            return (
              <PeriodoEnActividad
                key={periodo}
                actividades={actividades}
                periodo={periodo}
                periodoLabel={periodosNombres[periodo] || String(periodo)}
                nombreCategoria={nombreCategoria}
                tipoActividad={tipoActividad}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodoEnActividad({
  actividades,
  periodo,
  periodoLabel,
  nombreCategoria,
  tipoActividad,
}: {
  actividades: any[];
  periodo: number;
  periodoLabel: string;
  nombreCategoria: string;
  tipoActividad: string;
}) {
  const [collapsed, setCollapsed] = useState(true);
  let totalHorasPeriodo = 0;

  actividades.forEach((act) => {
    totalHorasPeriodo += extraerHorasSemestre(act['HORAS SEMESTRE']);
  });

  return (
    <div
      className={`categoria-section ${collapsed ? 'collapsed' : ''}`}
      style={{ marginLeft: '40px' }}
    >
      <div
        className="categoria-header"
        style={{ backgroundColor: '#fafafa', fontSize: '0.9rem' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>Período: {periodoLabel}</span>
        <div>
          <span className="total-badge-category">{totalHorasPeriodo.toFixed(1)} horas</span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && (
        <div className="categoria-content">
          <ActivityTable actividades={actividades} tipoActividad={tipoActividad} />
        </div>
      )}
    </div>
  );
}

function OtraActividadConPeriodos({
  actividadesPorPeriodo,
  nombreActividad,
  periodosNombres,
  periodos,
}: {
  actividadesPorPeriodo: Record<number, any[]>;
  nombreActividad: string;
  periodosNombres: Record<number, string>;
  periodos: number[];
}) {
  const [collapsed, setCollapsed] = useState(true);
  let totalGeneral = 0;

  Object.values(actividadesPorPeriodo).forEach((actividades) => {
    if (Array.isArray(actividades)) {
      actividades.forEach((act) => {
        totalGeneral += extraerHorasSemestre(act['HORAS SEMESTRE']);
      });
    }
  });

  if (totalGeneral === 0) return null;

  const tipoActividad = nombreActividad.toLowerCase().replace(/\s+/g, '');

  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="categoria-header" onClick={() => setCollapsed(!collapsed)}>
        <span>{nombreActividad}</span>
        <div>
          <span className="total-badge-section">
            Total histórico: {totalGeneral.toFixed(1)} horas
          </span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && (
        <div className="categoria-content">
          {periodos.map((periodo) => {
            const actividades = actividadesPorPeriodo[periodo];
            if (!actividades || !Array.isArray(actividades) || actividades.length === 0) {
              return null;
            }

            return (
              <PeriodoEnActividad
                key={periodo}
                actividades={actividades}
                periodo={periodo}
                periodoLabel={periodosNombres[periodo] || String(periodo)}
                nombreCategoria={nombreActividad}
                tipoActividad={tipoActividad}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

