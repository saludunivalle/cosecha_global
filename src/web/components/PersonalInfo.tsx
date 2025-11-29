'use client';

import { combinarNombreCompleto } from '@/web/lib/data-processor';
import type { InformacionPersonal } from '@/shared/types/docente.types';

interface PersonalInfoProps {
  info: InformacionPersonal;
}

export default function PersonalInfo({ info }: PersonalInfoProps) {
  if (!info || typeof info !== 'object') return null;

  // Debug: mostrar información recibida en consola
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🔍 Información personal recibida:', info);
    console.log('🔍 Claves disponibles:', Object.keys(info));
  }

  const nombreCompleto = combinarNombreCompleto(info);

  // Búsqueda robusta de campos con múltiples variaciones
  const getField = (keys: string[], defaultValue: string = 'No disponible'): string => {
    // Primero buscar coincidencia exacta
    for (const key of keys) {
      if (info[key] && String(info[key]).trim() !== '') {
        return String(info[key]).trim();
      }
    }
    
    // Búsqueda flexible - normalizar y comparar
    for (const [key, value] of Object.entries(info)) {
      if (!value || String(value).trim() === '') continue;
      
      const keyNorm = key.toUpperCase().trim().replace(/[ÁÉÍÓÚÑ]/g, (char) => {
        const map: Record<string, string> = {
          'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N'
        };
        return map[char] || char;
      }).replace(/\s+/g, ' ');
      
      for (const searchKey of keys) {
        const searchKeyNorm = searchKey.toUpperCase().trim().replace(/[ÁÉÍÓÚÑ]/g, (char) => {
          const map: Record<string, string> = {
            'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N'
          };
          return map[char] || char;
        }).replace(/\s+/g, ' ');
        
        // Coincidencia exacta o parcial
        if (keyNorm === searchKeyNorm || keyNorm.includes(searchKeyNorm) || searchKeyNorm.includes(keyNorm)) {
          return String(value).trim();
        }
      }
    }
    
    return defaultValue;
  };

  const cedula = getField(['CEDULA', 'DOCENTES', 'Docentes', 'DOCUMENTO', 'IDENTIFICACION']);
  const unidadAcademica = getField([
    'UNIDAD ACADEMICA', 
    'unidadAcademica', 
    'Unidad Academica',
    'UNIDAD',
    'ESCUELA',
    'DEPARTAMENTO'
  ]);
  const vinculacion = getField([
    'VINCULACION', 
    'Vinculacion', 
    'vinculacion',
    'VINCULACIÓN',
    'Vinculación'
  ]);
  const categoria = getField([
    'CATEGORIA', 
    'Categoria', 
    'categoria',
    'CATEGORÍA',
    'Categoría'
  ]);
  const dedicacion = getField([
    'DEDICACION', 
    'Dedicacion', 
    'dedicacion',
    'DEDICACIÓN',
    'Dedicación'
  ]);
  const nivelAlcanzado = getField([
    'NIVEL ALCANZADO', 
    'nivelAlcanzado', 
    'Nivel Alcanzado',
    'NIVEL ALCANZADO',
    'NIVEL',
    'Nivel',
    'nivel'
  ]);

  return (
    <div className="card">
      <div className="card-header">
        <i className="bi bi-person-badge mr-2"></i> Información del Docente
      </div>
      <div className="card-body">
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Nombre Completo</span>
            <span className="value">{nombreCompleto}</span>
          </div>
          <div className="info-item">
            <span className="label">Cédula</span>
            <span className="value">{cedula}</span>
          </div>
          <div className="info-item">
            <span className="label">Unidad Académica</span>
            <span className="value">{unidadAcademica}</span>
          </div>
          <div className="info-item">
            <span className="label">Vinculación</span>
            <span className="value">{vinculacion}</span>
          </div>
          <div className="info-item">
            <span className="label">Categoría</span>
            <span className="value">{categoria}</span>
          </div>
          <div className="info-item">
            <span className="label">Dedicación</span>
            <span className="value">{dedicacion}</span>
          </div>
          <div className="info-item">
            <span className="label">Nivel Alcanzado</span>
            <span className="value">{nivelAlcanzado}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

