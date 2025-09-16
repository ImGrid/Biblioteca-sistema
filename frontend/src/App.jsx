import React from "react";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-center">
          Sistema Biblioteca - Frontend (Vite + React)
        </h1>
        <p className="text-center mt-2 text-gray-600">
          Configuración inicial completada ✅
        </p>
        <div className="mt-8 max-w-md mx-auto">
          <div className="bg-white p-6 border rounded shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Estado del Proyecto:</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Vite + React configurado
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Tailwind CSS v3 instalado
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Estructura de carpetas creada
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Dependencias instaladas
              </li>
              <li className="flex items-center">
                <span className="text-yellow-500 mr-2">⏳</span>
                Listo para Fase 1: Foundation
              </li>
            </ul>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800 text-xs">
                <strong>Siguiente:</strong> Configurar AuthContext y Login
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
