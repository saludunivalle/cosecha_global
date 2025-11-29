'use client';

import { useState, FormEvent } from 'react';

interface SearchFormProps {
  onSearch: (cedula: string) => void;
  isLoading?: boolean;
}

export default function SearchForm({ onSearch, isLoading = false }: SearchFormProps) {
  const [cedula, setCedula] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (cedula.trim()) {
      onSearch(cedula.trim());
    }
  };

  return (
    <div className="input-container">
      <label htmlFor="cedulaInput">Consultar actividades de docente</label>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          id="cedulaInput"
          className="form-control"
          placeholder="Ingrese la cédula del docente"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" id="buscarBtn" disabled={isLoading}>
          <i className="bi bi-search"></i>&nbsp;Buscar Docente
        </button>
      </form>
    </div>
  );
}

