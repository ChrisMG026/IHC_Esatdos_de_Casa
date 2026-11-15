# 🏢 RESIDENTE HUB (U-Tower) — Sistema de Gestión Residencial

![PHP](https://img.shields.io/badge/PHP-8.x-777BB4?style=flat-square&logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Architecture](https://img.shields.io/badge/Architecture-MVC%20OOP-orange?style=flat-square)
![XAMPP](https://img.shields.io/badge/Server-XAMPP%20%2F%20Apache-FB7A24?style=flat-square&logo=apache&logoColor=white)

Sistema integral de gestión para complejos departamentales y residencias estudiantiles. Diseñado bajo el patrón de arquitectura **Modelo-Vista-Controlador (MVC)** con **Programación Orientada a Objetos (POO)** en PHP, enfocado en alto rendimiento, concurrencia segura y experiencia de usuario fluida.

---

## 🏛️ Arquitectura del Software: Modelo - Vista - Controlador (MVC)

El proyecto implementa una estricta **separación de responsabilidades (Separation of Concerns)**:

```
                  ┌───────────────────────────────┐
                  │       VISTAS (Views)          │
                  │  HTML5 + CSS3 + Vanilla JS    │
                  └──────────────┬────────────────┘
                                 │ HTTP / JSON Fetch
                                 ▼
                  ┌───────────────────────────────┐
                  │   CONTROLADORES (Controllers) │
                  │  Validación, Sesión y Rutas   │
                  └──────────────┬────────────────┘
                                 │ Invocación de Métodos
                                 ▼
                  ┌───────────────────────────────┐
                  │       MODELOS (Models)        │
                  │ Lógica de Negocio y SQL (POO) │
                  └──────────────┬────────────────┘
                                 │ Transacciones / Prepared Statements
                                 ▼
                  ┌───────────────────────────────┐
                  │    BASE DE DATOS (MySQL)      │
                  └───────────────────────────────┘
```

- **Modelos (`models/`)**: Clases POO que encapsulan el acceso a datos, reglas de negocio y transacciones (`Residente`, `Contrato`, `Estacionamiento`, `Usuario`, `Bloqueo`, `Configuracion`, `Reporte`, `Bitacora`, `CargaMasiva`).
- **Controladores (`controllers/`)**: Heredan de `BaseController` para gestionar las solicitudes HTTP, verificar permisos (RBAC), coordinar modelos y emitir respuestas estandarizadas en JSON.
- **Vistas (`views/`)**: Interfaces de usuario limpias y responsivas (`index.html`, `dashboard.html`, `Contratos.html`, etc.).
- **Assets (`assets/`)**: Hojas de estilo CSS y lógica cliente en JavaScript modular.
- **Configuración (`config/`)**: Conexión a base de datos bajo el patrón **Singleton** (`Database.php`), middlewares de sesión y permisos (`AuthMiddleware.php`).

---

## 📂 Estructura del Proyecto

```text
IHC_Esatdos_de_Casa/
├── assets/                     # Recursos estáticos de Frontend
│   ├── css/
│   │   └── styles.css          # Sistema de diseño, variables y temas claro/oscuro
│   └── js/
│       ├── admin_usuarios.js   # Gestión de usuarios, roles y permisos
│       ├── auth_check.js       # Validación de sesión y control de inactividad
│       ├── configuraciones.js  # Ajustes de catálogo y llaves maestras
│       ├── contratos.js        # Renovaciones y asignación de vehículos
│       ├── dashboard.js        # Métricas, gráficas y KPIs
│       ├── estacionamiento.js  # Gestión de cajones y tags
│       ├── login.js            # Validación de acceso y formulario
│       ├── reportes.js         # Filtros y exportación de bitácoras
│       ├── script.js           # Matriz general de residentes y move-in
│       └── tema.js             # Persistencia de modo oscuro / claro
│
├── config/                     # Capa de configuración e infraestructura
│   ├── config.php              # Parámetros globales y zona horaria
│   ├── Database.php            # Patrón Singleton para conexión MySQLi (utf8mb4)
│   └── AuthMiddleware.php      # Control de sesiones, inactividad y RBAC
│
├── controllers/                # CONTROLADORES (Manejo de peticiones HTTP)
│   ├── BaseController.php      # Clase base con respuestas JSON y helpers
│   ├── AuthController.php      # Login, logout, sesión y recuperación
│   ├── ResidenteController.php # CRUD de residentes, cambios de unidad y move-out
│   ├── ContratoController.php  # Renovaciones y administración vehicular
│   ├── EstacionamientoController.php # Control de cajones administrativos
│   ├── UsuarioController.php   # Administración de usuarios y logs
│   ├── ConfiguracionController.php   # Catálogos, estados y llaves maestras
│   ├── DashboardController.php # KPIs analíticos en tiempo real
│   ├── ReporteController.php   # Historiales y auditorías
│   ├── BloqueoController.php   # Concurrencia (Pessimistic Locking)
│   ├── CargaMasivaController.php # Importación/Exportación de plantillas CSV
│   └── BackupController.php    # Generación y descarga de respaldo SQL
│
├── models/                     # MODELOS (Lógica de negocio y persistencia)
│   ├── Usuario.php             # Autenticación, roles y recuperación
│   ├── Residente.php           # Altas, ediciones, transferencias y bajas
│   ├── Contrato.php            # Contratos, renovaciones y cálculo de plazos
│   ├── Estacionamiento.php     # Mapeo y estado de cajones
│   ├── Configuracion.php       # Llaves maestras y deshabilitaciones
│   ├── Bloqueo.php             # Bloqueos concurrentes con latido (TTL)
│   ├── Reporte.php             # Consultas analíticas y métricas
│   ├── Bitacora.php            # Logs del sistema y backups SQL
│   └── CargaMasiva.php         # Procesamiento masivo de CSV
│
├── views/                      # VISTAS (Interfaz de usuario)
│   ├── index.html              # Módulo principal de Residentes
│   ├── dashboard.html          # Panel analítico y KPIs
│   ├── Contratos.html          # Control de contratos y renovaciones
│   ├── Estacionamiento.html    # Mapa y estatus de estacionamiento
│   ├── AdminUsuarios.html      # Panel de roles, usuarios y logs
│   ├── Configuraciones.html    # Parámetros del sistema y carga masiva
│   ├── Reportes.html           # Reportes de auditoría y movimientos
│   ├── login.html              # Inicio de sesión
│   └── recuperar.html          # Recuperación por pregunta de seguridad
│
├── API/                        # Puentes de retrocompatibilidad (Delegación)
├── index.php                   # Enrutador principal de entrada al sistema
└── README.md                   # Documentación técnica
```

---

## 🚀 Características Principales

### 1. Control de Concurrencia en Tiempo Real (Pessimistic Locking con Heartbeat)
- Previene que dos administradores editen el expediente de un mismo residente o departamento simultáneamente.
- Sistema de **latido (heartbeat)** con TTL de 60 segundos: si una pestaña se cierra inesperadamente, el expediente se desbloquea de forma automática sin bloquear la base de datos.

### 2. Seguridad y Control de Acceso Basado en Roles (RBAC)
- Contraseñas protegidas mediante algoritmo **`BCRYPT`**.
- Control automático de inactividad de sesión (expiración tras 1 hora sin interacción).
- Recuperación de credenciales mediante preguntas secretas con respuesta hasheada.
- Permisos granulares: `editar_residentes`, `borrar_residentes`, `gestionar_usuarios`, `editar_claves`, `editar_admin_parking`, `carga_masiva_dev`, `backup_sql`.

### 3. Panel de Métricas (Dashboard)
- Cálculo en tiempo real de ocupación general, ingresos por renta, contratos próximos a vencer (30/90 días) y vencidos.
- Distribución demográfica por género y piso/nivel.
- Monitoreo en vivo de cajones de estacionamiento ocupados vs disponibles.

### 4. Auditoría Integral y Respaldo
- Registro automático en bitácora de cada movimiento (Altas, Bajas/Move-Out, Cambios de Unidad, Asignación de Cajones, etc.) con IP del usuario.
- Generador de respaldos de base de datos SQL descargable en un clic.

---

## ⚙️ Instalación y Puesta en Marcha (XAMPP)

1. **Clonar el repositorio** dentro de la carpeta `htdocs` de XAMPP:
   ```bash
   cd c:\xampp\htdocs
   git clone https://github.com/tu-usuario/IHC_Esatdos_de_Casa.git
   ```

2. **Iniciar servicios en XAMPP**:
   - Inicia **Apache** y **MySQL**.

3. **Importar la Base de Datos**:
   - Abre `phpMyAdmin` (`http://localhost/phpmyadmin`).
   - Crea la base de datos: `estado_de_casa_utower`.
   - Importa el archivo SQL correspondiente.

4. **Configurar Credenciales** (si aplica):
   - Edita [config/config.php](file:///c:/xampp1/htdocs/IHC_Esatdos_de_Casa/config/config.php) para ajustar `DB_USER` y `DB_PASS` si difieren de los valores por defecto (`root` sin contraseña).

5. **Acceder a la aplicación**:
   - Abre tu navegador en:
     ```text
     http://localhost/IHC_Esatdos_de_Casa/
     ```
   - El enrutador [index.php](file:///c:/xampp1/htdocs/IHC_Esatdos_de_Casa/index.php) te dirigirá automáticamente al inicio de sesión o al panel principal según el estado de tu sesión.

---

## 👨‍💻 Autor

Desarrollado como solución técnica para administración inmobiliaria y residencial.
