'use client';

import { useState } from 'react';
import ActivityTable from './ActivityTable';
import { extraerHorasSemestre } from '@/web/lib/data-processor';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';

interface PeriodViewProps {
  resultados: ResultadoBusqueda[];
  periodosNombres: Record<number, string>;
}

export default function PeriodView({ resultados, periodosNombres }: PeriodViewProps) {
  return (
    <>
      {resultados.map((res) => {
        const periodo = res.periodo;
        const periodoLabel = periodosNombres[periodo] || String(periodo);

        if (res.error) {
          return (
            <PeriodCard
              key={periodo}
              periodo={periodo}
              periodoLabel={periodoLabel}
              error={res.error}
            />
          );
        }

        if (!res.data || res.data.length === 0) {
          return (
            <PeriodCard
              key={periodo}
              periodo={periodo}
              periodoLabel={periodoLabel}
              error="No hay datos disponibles"
            />
          );
        }

        const filaObj = res.data[0];
        let totalHorasPeriodo = 0;

        // Calcular totales
        if (filaObj.actividadesDocencia) {
          const { pregrado, postgrado, direccionTesis } = filaObj.actividadesDocencia;
          [...pregrado, ...postgrado, ...direccionTesis].forEach((act) => {
            totalHorasPeriodo += extraerHorasSemestre(act['HORAS SEMESTRE']);
          });
        }

        const otrasActividades = [
          filaObj.actividadesInvestigacion,
          filaObj.actividadesExtension,
          filaObj.actividadesIntelectualesOArtisticas,
          filaObj.actividadesAdministrativas,
          filaObj.actividadesComplementarias,
          filaObj.docenteEnComision,
        ];

        otrasActividades.forEach((acts) => {
          if (Array.isArray(acts)) {
            acts.forEach((act) => {
              totalHorasPeriodo += extraerHorasSemestre(act['HORAS SEMESTRE']);
            });
          }
        });

        return (
          <PeriodCard
            key={periodo}
            periodo={periodo}
            periodoLabel={periodoLabel}
            datos={filaObj}
            totalHoras={totalHorasPeriodo}
          />
        );
      })}
    </>
  );
}

interface PeriodCardProps {
  periodo: number;
  periodoLabel: string;
  datos?: any;
  totalHoras?: number;
  error?: string;
}

function PeriodCard({ periodo, periodoLabel, datos, totalHoras = 0, error }: PeriodCardProps) {
  const [collapsed, setCollapsed] = useState(true);

  if (error) {
    return (
      <div className="card periodo-card collapsed">
        <div className="card-header" onClick={() => setCollapsed(!collapsed)}>
          <span>Período: {periodoLabel}</span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
        {!collapsed && (
          <div className="card-body">
            <div className="tabla-vacia">
              {error === 'No hay datos disponibles'
                ? 'No se encontraron actividades en ninguna categoría.'
                : 'Ocurrió un error al obtener datos para este período.'}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`card periodo-card ${collapsed ? 'collapsed' : ''}`}>
      <div className="card-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Período: {periodoLabel}</span>
        <div>
          <span className="total-badge">Total: {totalHoras.toFixed(1)} horas</span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && datos && (
        <div className="card-body">
          <ActividadesPorPeriodo datos={datos} />
        </div>
      )}
    </div>
  );
}

function ActividadesPorPeriodo({ datos }: { datos: any }) {
  const [docenciaCollapsed, setDocenciaCollapsed] = useState(true);
  const [investigacionCollapsed, setInvestigacionCollapsed] = useState(true);
  const [extensionCollapsed, setExtensionCollapsed] = useState(true);
  const [intelectualesCollapsed, setIntelectualesCollapsed] = useState(true);
  const [administrativasCollapsed, setAdministrativasCollapsed] = useState(true);
  const [complementariasCollapsed, setComplementariasCollapsed] = useState(true);
  const [comisionCollapsed, setComisionCollapsed] = useState(true);

  let algunaActividad = false;

  // Procesar docencia
  const actividadesDocencia = datos.actividadesDocencia || {};
  const tieneDocencia =
    (actividadesDocencia.pregrado?.length > 0) ||
    (actividadesDocencia.postgrado?.length > 0) ||
    (actividadesDocencia.direccionTesis?.length > 0);

  if (tieneDocencia) algunaActividad = true;

  return (
    <>
      {/* ACTIVIDADES DE DOCENCIA */}
      {tieneDocencia && (
        <CategoriaSection
          titulo="ACTIVIDADES DE DOCENCIA"
          collapsed={docenciaCollapsed}
          onToggle={() => setDocenciaCollapsed(!docenciaCollapsed)}
        >
          {actividadesDocencia.pregrado?.length > 0 && (
            <SubCategoriaSection
              titulo="PREGRADO"
              actividades={actividadesDocencia.pregrado}
              tipoActividad="pregrado"
            />
          )}
          {actividadesDocencia.postgrado?.length > 0 && (
            <SubCategoriaSection
              titulo="POSTGRADO"
              actividades={actividadesDocencia.postgrado}
              tipoActividad="postgrado"
            />
          )}
          {actividadesDocencia.direccionTesis?.length > 0 && (
            <SubCategoriaSection
              titulo="DIRECCIÓN DE TESIS"
              actividades={actividadesDocencia.direccionTesis}
              tipoActividad="direcciondetesis"
            />
          )}
        </CategoriaSection>
      )}

      {/* OTRAS ACTIVIDADES */}
      {datos.actividadesInvestigacion?.length > 0 && (
        <CategoriaSection
          titulo="ACTIVIDADES DE INVESTIGACION"
          collapsed={investigacionCollapsed}
          onToggle={() => setInvestigacionCollapsed(!investigacionCollapsed)}
        >
          <ActivityTable
            actividades={datos.actividadesInvestigacion}
            tipoActividad="actividadesdeinvestigacion"
          />
        </CategoriaSection>
      )}

      {datos.actividadesExtension?.length > 0 && (
        <CategoriaSection
          titulo="ACTIVIDADES DE EXTENSION"
          collapsed={extensionCollapsed}
          onToggle={() => setExtensionCollapsed(!extensionCollapsed)}
        >
          <ActivityTable
            actividades={datos.actividadesExtension}
            tipoActividad="actividadesdeextension"
          />
        </CategoriaSection>
      )}

      {datos.actividadesIntelectualesOArtisticas?.length > 0 && (
        <CategoriaSection
          titulo="ACTIVIDADES INTELECTUALES O ARTISTICAS"
          collapsed={intelectualesCollapsed}
          onToggle={() => setIntelectualesCollapsed(!intelectualesCollapsed)}
        >
          <ActivityTable
            actividades={datos.actividadesIntelectualesOArtisticas}
            tipoActividad="actividadesintelectualesoartisticas"
          />
        </CategoriaSection>
      )}

      {datos.actividadesAdministrativas?.length > 0 && (
        <CategoriaSection
          titulo="ACTIVIDADES ADMINISTRATIVAS"
          collapsed={administrativasCollapsed}
          onToggle={() => setAdministrativasCollapsed(!administrativasCollapsed)}
        >
          <ActivityTable
            actividades={datos.actividadesAdministrativas}
            tipoActividad="actividadesadministrativas"
          />
        </CategoriaSection>
      )}

      {datos.actividadesComplementarias?.length > 0 && (
        <CategoriaSection
          titulo="ACTIVIDADES COMPLEMENTARIAS"
          collapsed={complementariasCollapsed}
          onToggle={() => setComplementariasCollapsed(!complementariasCollapsed)}
        >
          <ActivityTable
            actividades={datos.actividadesComplementarias}
            tipoActividad="actividadescomplementarias"
          />
        </CategoriaSection>
      )}

      {datos.docenteEnComision?.length > 0 && (
        <CategoriaSection
          titulo="DOCENTE EN COMISION"
          collapsed={comisionCollapsed}
          onToggle={() => setComisionCollapsed(!comisionCollapsed)}
        >
          <ActivityTable
            actividades={datos.docenteEnComision}
            tipoActividad="docenteencomision"
          />
        </CategoriaSection>
      )}

      {!algunaActividad && (
        <div className="tabla-vacia">
          No se encontraron actividades en ninguna categoría.
        </div>
      )}
    </>
  );
}

function CategoriaSection({
  titulo,
  collapsed,
  onToggle,
  children,
}: {
  titulo: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="categoria-header" onClick={onToggle}>
        <span>{titulo}</span>
        <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
      </div>
      {!collapsed && <div className="categoria-content">{children}</div>}
    </div>
  );
}

function SubCategoriaSection({
  titulo,
  actividades,
  tipoActividad,
}: {
  titulo: string;
  actividades: any[];
  tipoActividad: string;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const totalHoras = actividades.reduce((sum, act) => {
    return sum + extraerHorasSemestre(act['HORAS SEMESTRE']);
  }, 0);

  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`} style={{ marginLeft: '20px' }}>
      <div
        className="categoria-header"
        style={{ backgroundColor: '#f8f9fa' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>{titulo}</span>
        <div>
          <span className="total-badge-category">Total: {totalHoras.toFixed(1)} horas</span>
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

