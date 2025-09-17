# Sistema de Gestión de Biblioteca

Un sistema web para la administración de bibliotecas que permite gestionar el catálogo de libros, usuarios, préstamos y multas a través de una interfaz web.

## Descripción

El sistema proporciona funcionalidades diferenciadas por roles de usuario:

- **Usuarios**: Consulta del catálogo, gestión de préstamos personales y consulta de multas
- **Bibliotecarios**: Procesamiento de préstamos y devoluciones, gestión de multas
- **Administradores**: Control completo del sistema, gestión de usuarios y generación de reportes

## Tecnologías

**Backend:**

- Node.js con Express
- PostgreSQL
- Autenticación JWT
- Bcrypt para hash de contraseñas

**Frontend:**

- React
- Axios para comunicación HTTP
- Tailwind CSS
- React Router

## Estructura del Proyecto

```
proyecto/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Lógica de negocio
│   │   ├── routes/          # Definición de endpoints
│   │   ├── middleware/      # Autenticación y validación
│   │   ├── services/        # Servicios de negocio
│   │   └── utils/           # Utilidades y configuración
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Vistas principales
│   │   ├── services/        # Comunicación con API
│   │   ├── components/      # Componentes reutilizables
│   │   └── hooks/           # Hooks personalizados
│   └── package.json
└── README.md
```

## Requisitos del Sistema

- Node.js 16 o superior
- PostgreSQL 12 o superior
- npm o yarn

## Instalación

### Base de Datos

1. Crear base de datos PostgreSQL:

```sql
CREATE DATABASE biblioteca_db;
```

2. Ejecutar las migraciones del esquema de base de datos según el archivo `diseño_basedatos.txt`

### Backend

1. Navegar al directorio backend:

```bash
cd backend
```

2. Instalar dependencias:

```bash
npm install
```

3. Crear archivo `.env` con las siguientes variables:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=tu_jwt_secret_aqui
DB_HOST=localhost
DB_PORT=5432
DB_NAME=biblioteca_db
DB_USER=tu_usuario_db
DB_PASSWORD=tu_password_db
FRONTEND_URL=http://localhost:3000
```

4. Iniciar el servidor:

```bash
npm start
```

### Frontend

1. Navegar al directorio frontend:

```bash
cd frontend
```

2. Instalar dependencias:

```bash
npm install
```

3. Crear archivo `.env` con:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

4. Iniciar la aplicación:

```bash
npm start
```
