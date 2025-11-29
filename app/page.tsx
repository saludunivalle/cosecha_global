'use client';

import { useState, useEffect } from 'react';
import SearchForm from '@/web/components/SearchForm';
import PersonalInfo from '@/web/components/PersonalInfo';
import ActivitiesView from '@/web/components/ActivitiesView';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';
import type { Periodo } from '@/shared/types/docente.types';

export default function HomePage() {
  const [cedula, setCedula] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [periodos, setPeriodos] = useState<number[]>([]);
  const [periodosNombres, setPeriodosNombres] = useState<Record<number, string>>({});
  const [personalInfo, setPersonalInfo] = useState<any>(null);
  const [message, setMessage] = useState<string>('');

  // Cargar períodos al montar
  useEffect(() => {
    cargarPeriodos();
  }, []);

  const cargarPeriodos = async () => {
    try {
      // IMPORTANTE: Obtener periodos desde el portal para mostrar nombres actualizados
      // Nota: Los periodos se obtendrán nuevamente al hacer scraping para asegurar consistencia
      const response = await fetch('/api/periodos?n=8', { cache: 'no-store' });
      if (!response.ok) throw new Error('Error cargando períodos');
      
      const data = await response.json();
      const periodosData: Periodo[] = data.periodos || [];
      
      if (periodosData.length === 0) {
        console.warn('⚠️ No se obtuvieron periodos, se actualizarán al hacer búsqueda');
        // No usar fallback estático para evitar discrepancias
        return;
      }
      
      setPeriodos(periodosData.map((p) => p.idPeriod));
      const nombres: Record<number, string> = {};
      periodosData.forEach((p) => {
        nombres[p.idPeriod] = p.label;
      });
      setPeriodosNombres(nombres);
      console.log(`✅ Periodos cargados para UI: ${periodosData.map(p => p.label).join(', ')}`);
    } catch (error) {
      console.error('Error cargando periodos para UI:', error);
      // No usar fallback estático - los periodos se obtendrán al hacer scraping
      // Esto asegura que siempre se use el último periodo disponible
    }
  };

  const handleSearch = async (cedulaBusqueda: string) => {
    setCedula(cedulaBusqueda);
    setIsLoading(true);
    setMessage('Procesando información...');
    setResultados([]);
    setPersonalInfo(null);

    try {
      const response = await fetch(`/api/docente/${cedulaBusqueda}`);
      if (!response.ok) {
        throw new Error('Error al buscar docente');
      }

      const data = await response.json();
      const resultadosData: ResultadoBusqueda[] = data.resultados || [];

      // IMPORTANTE: Actualizar nombres de periodos desde los resultados del scraping
      // para asegurar consistencia con los periodos realmente obtenidos
      let periodosParaOrdenar = periodos;
      if (data.periodos && Array.isArray(data.periodos) && data.periodos.length > 0) {
        const periodosActualizados: Record<number, string> = {};
        const idsPeriodos = data.periodos.map((p: Periodo) => p.idPeriod);
        data.periodos.forEach((p: Periodo) => {
          periodosActualizados[p.idPeriod] = p.label;
        });
        setPeriodosNombres(periodosActualizados);
        setPeriodos(idsPeriodos);
        periodosParaOrdenar = idsPeriodos;
        console.log(`✅ Periodos actualizados desde scraping: ${data.periodos.map((p: Periodo) => p.label).join(', ')}`);
      }

      // Ordenar según el orden en periodos (usar los periodos actualizados si están disponibles)
      resultadosData.sort(
        (a, b) =>
          periodosParaOrdenar.indexOf(a.periodo) - periodosParaOrdenar.indexOf(b.periodo)
      );

      setResultados(resultadosData);

      // Extraer información personal del primer resultado exitoso
      for (const res of resultadosData) {
        if (!res.error && res.data && res.data.length > 0 && res.data[0].informacionPersonal) {
          setPersonalInfo(res.data[0].informacionPersonal);
          break;
        }
      }

      setMessage('');
    } catch (error) {
      console.error('Error buscando docente:', error);
      setMessage('Error al buscar docente. Por favor, intente nuevamente.');
      setResultados([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <SearchForm onSearch={handleSearch} isLoading={isLoading} />

      {message && (
        <div id="message-container">
          <h3>{message}</h3>
        </div>
      )}

      {personalInfo && (
        <div id="personal-info-container">
          <PersonalInfo info={personalInfo} />
        </div>
      )}

      {resultados.length > 0 && (
        <div id="results">
          <ActivitiesView
            resultados={resultados}
            periodosNombres={periodosNombres}
            periodos={periodos}
          />
        </div>
      )}
    </div>
  );
}

