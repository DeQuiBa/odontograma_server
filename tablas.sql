    -- tablas.sql
    -- Script para SQL Server 2012
    -- Contiene las tablas necesarias para almacenar odontogramas y sus componentes.
    -- Relación principal: cada odontograma está asociado a un Nro_Historia (número de historia clínica del paciente).
    -- Contiene las tablas necesarias para almacenar odontogramas y sus componentes.
    -- Relación principal: cada odontograma está asociado a un Nro_Historia (número de historia clínica del paciente).

    -- NOTA: Si ya existe una tabla de pacientes en tu DB (por ejemplo con clave NroHistoriaClinica), puedes
    -- agregar FOREIGN KEY hacia esa tabla; en este script usamos Nro_Historia como NVARCHAR(50).

    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;
    GO

    -- Tabla principal: Odontograma
    -- El script redefine y amplía las tablas para capturar estructuras más ricas del odontograma.
    -- Se eliminan (si existen) tablas antiguas para recrearlas en el orden correcto según dependencias.
    -- Primero, eliminar objetos que puedan existir (orden defensivo).
    -- En entornos productivos no ejecute este bloque sin respaldo.
    -- =============================
    -- LIMPIEZA DE TABLAS Y TRIGGERS
    -- =============================
    IF OBJECT_ID('dbo.trg_DienteCodigo_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteCodigo_Insert;
    IF OBJECT_ID('dbo.trg_DienteArea_InsertUpdate','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteArea_InsertUpdate;
    IF OBJECT_ID('dbo.trg_Protesis_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Protesis_Insert;
    IF OBJECT_ID('dbo.trg_Transposicion_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Transposicion_Insert;

    -- Tablas versionadas (dependen de OdontogramaVersion)
    IF OBJECT_ID('dbo.OdontogramaVersionAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersionAudit;
    IF OBJECT_ID('dbo.Anotacion','U') IS NOT NULL DROP TABLE dbo.Anotacion;
    IF OBJECT_ID('dbo.SimboloClinico','U') IS NOT NULL DROP TABLE dbo.SimboloClinico;
    IF OBJECT_ID('dbo.Flecha','U') IS NOT NULL DROP TABLE dbo.Flecha;
    IF OBJECT_ID('dbo.Linea','U') IS NOT NULL DROP TABLE dbo.Linea;
    IF OBJECT_ID('dbo.ArcoOrtodoncia','U') IS NOT NULL DROP TABLE dbo.ArcoOrtodoncia;
    IF OBJECT_ID('dbo.AparatoFijoDiente','U') IS NOT NULL DROP TABLE dbo.AparatoFijoDiente;
    IF OBJECT_ID('dbo.AparatoFijo','U') IS NOT NULL DROP TABLE dbo.AparatoFijo;
    IF OBJECT_ID('dbo.AparatoRemovible','U') IS NOT NULL DROP TABLE dbo.AparatoRemovible;
    IF OBJECT_ID('dbo.Implante','U') IS NOT NULL DROP TABLE dbo.Implante;
    IF OBJECT_ID('dbo.ProtesisVTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisVTeeth;
    IF OBJECT_ID('dbo.ProtesisV','U') IS NOT NULL DROP TABLE dbo.ProtesisV;
    IF OBJECT_ID('dbo.CoronaV','U') IS NOT NULL DROP TABLE dbo.CoronaV;
    IF OBJECT_ID('dbo.Edentulo','U') IS NOT NULL DROP TABLE dbo.Edentulo;
    IF OBJECT_ID('dbo.Fusion','U') IS NOT NULL DROP TABLE dbo.Fusion;
    IF OBJECT_ID('dbo.Restauracion','U') IS NOT NULL DROP TABLE dbo.Restauracion;
    IF OBJECT_ID('dbo.CoronaTemporal','U') IS NOT NULL DROP TABLE dbo.CoronaTemporal;
    IF OBJECT_ID('dbo.Endodoncia','U') IS NOT NULL DROP TABLE dbo.Endodoncia;
    IF OBJECT_ID('dbo.Impactacion','U') IS NOT NULL DROP TABLE dbo.Impactacion;
    IF OBJECT_ID('dbo.Supernumerario','U') IS NOT NULL DROP TABLE dbo.Supernumerario;
    IF OBJECT_ID('dbo.Geminacion','U') IS NOT NULL DROP TABLE dbo.Geminacion;
    IF OBJECT_ID('dbo.Clavija','U') IS NOT NULL DROP TABLE dbo.Clavija;
    IF OBJECT_ID('dbo.Giroversion','U') IS NOT NULL DROP TABLE dbo.Giroversion;
    IF OBJECT_ID('dbo.Intrusion','U') IS NOT NULL DROP TABLE dbo.Intrusion;
    IF OBJECT_ID('dbo.Extruida','U') IS NOT NULL DROP TABLE dbo.Extruida;
    IF OBJECT_ID('dbo.Erupcion','U') IS NOT NULL DROP TABLE dbo.Erupcion;
    IF OBJECT_ID('dbo.Espigo','U') IS NOT NULL DROP TABLE dbo.Espigo;
    IF OBJECT_ID('dbo.Fractura','U') IS NOT NULL DROP TABLE dbo.Fractura;
    IF OBJECT_ID('dbo.OdontogramaVersion','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersion;

    -- Tablas base (dependen de Odontograma)
    IF OBJECT_ID('dbo.ProtesisTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisTeeth;
    IF OBJECT_ID('dbo.Protesis','U') IS NOT NULL DROP TABLE dbo.Protesis;
    IF OBJECT_ID('dbo.Transposicion','U') IS NOT NULL DROP TABLE dbo.Transposicion;
    IF OBJECT_ID('dbo.DienteCodigo','U') IS NOT NULL DROP TABLE dbo.DienteCodigo;
    IF OBJECT_ID('dbo.DienteArea','U') IS NOT NULL DROP TABLE dbo.DienteArea;
    IF OBJECT_ID('dbo.Diente','U') IS NOT NULL DROP TABLE dbo.Diente;
    IF OBJECT_ID('dbo.Diastema','U') IS NOT NULL DROP TABLE dbo.Diastema;
    IF OBJECT_ID('dbo.OdontogramaAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaAudit;
    
    -- Catálogos
    IF OBJECT_ID('dbo.CatalogoProcedimiento','U') IS NOT NULL DROP TABLE dbo.CatalogoProcedimiento;
    IF OBJECT_ID('dbo.CatalogoEstadoDiente','U') IS NOT NULL DROP TABLE dbo.CatalogoEstadoDiente;
    
    -- Tabla principal
    IF OBJECT_ID('dbo.Odontograma','U') IS NOT NULL DROP TABLE dbo.Odontograma;

    CREATE TABLE dbo.Odontograma (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nro_Historia NVARCHAR(50) NOT NULL,
        Version INT NOT NULL DEFAULT(1),
        Fecha_Visita DATETIME2 NULL,
        Tipo_Visita NVARCHAR(50) NULL,
        Observaciones NVARCHAR(MAX) NULL,
        Metadata NVARCHAR(MAX) NULL, -- campo libre para JSON serializado si es necesario
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        Fecha_Modificacion DATETIME2 NULL,
        Usuario_Modificacion NVARCHAR(100) NULL,
        Activo BIT NOT NULL DEFAULT(1)
    );
    GO

    -- Índice por nro_historia para búsquedas rápidas
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Odontograma_NroHistoria' AND object_id = OBJECT_ID('dbo.Odontograma'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Odontograma_NroHistoria ON dbo.Odontograma(Nro_Historia);
    END
    GO

    -- Tabla para datos por diente (estado, color, notas, prótesis, etc.)
    -- Tabla Diente: resumen por diente (una fila por diente en el odontograma)
    CREATE TABLE dbo.Diente (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NOT NULL,
        Nro_Historia NVARCHAR(50) NOT NULL,
        NumeroDiente TINYINT NOT NULL, -- convención ISO 1..32 o FDI 11..48 etc. almacenar según tu uso
        EstadoCodigo NVARCHAR(50) NULL, -- referencia a CatalogoEstadoDiente.Codigo
        Estado NVARCHAR(100) NULL,     -- etiqueta libre para lectura rápida
        Color NVARCHAR(30) NULL,      -- color visual aplicado
        Observaciones NVARCHAR(500) NULL,
        Tiene_Protesis BIT NOT NULL DEFAULT(0),
        Metadata NVARCHAR(MAX) NULL, -- campo libre para datos estructurados (JSON string)
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        Fecha_Modificacion DATETIME2 NULL,
        Usuario_Modificacion NVARCHAR(100) NULL,
        CONSTRAINT FK_Diente_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE
    );
    GO

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diente_OdontogramaId' AND object_id = OBJECT_ID('dbo.Diente'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Diente_OdontogramaId ON dbo.Diente(OdontogramaId);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diente_NroHistoria' AND object_id = OBJECT_ID('dbo.Diente'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Diente_NroHistoria ON dbo.Diente(Nro_Historia);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Diente_Odontograma_Numero' AND object_id = OBJECT_ID('dbo.Diente'))
    BEGIN
        CREATE UNIQUE INDEX UQ_Diente_Odontograma_Numero ON dbo.Diente(OdontogramaId, NumeroDiente);
    END
    GO

    -- Tabla para áreas por diente (ej.: "oclusal", "mesiovestibular", etc.)
    CREATE TABLE dbo.DienteArea (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NOT NULL,
        Nro_Historia NVARCHAR(50) NOT NULL,
        NumeroDiente TINYINT NOT NULL,
        Area NVARCHAR(50) NOT NULL,
        Estado NVARCHAR(100) NULL,
        Color NVARCHAR(30) NULL,
        Observaciones NVARCHAR(500) NULL,
        Metadata NVARCHAR(MAX) NULL,
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        Fecha_Modificacion DATETIME2 NULL,
        Usuario_Modificacion NVARCHAR(100) NULL,
        CONSTRAINT FK_DienteArea_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE
    );
    GO

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteArea_OdontogramaId' AND object_id = OBJECT_ID('dbo.DienteArea'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_DienteArea_OdontogramaId ON dbo.DienteArea(OdontogramaId);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteArea_NroHistoria' AND object_id = OBJECT_ID('dbo.DienteArea'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_DienteArea_NroHistoria ON dbo.DienteArea(Nro_Historia);
    END
    GO

    -- Tabla para códigos aplicados a un diente (procedimientos/diagnósticos)
    CREATE TABLE dbo.DienteCodigo (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NOT NULL,
        Nro_Historia NVARCHAR(50) NOT NULL,
        NumeroDiente TINYINT NOT NULL,
        Codigo NVARCHAR(50) NOT NULL,
        Descripcion NVARCHAR(250) NULL,
        Color NVARCHAR(30) NULL,
        Metadata NVARCHAR(MAX) NULL,
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        CONSTRAINT FK_DienteCodigo_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE
    );
    GO

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteCodigo_OdontogramaId' AND object_id = OBJECT_ID('dbo.DienteCodigo'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_DienteCodigo_OdontogramaId ON dbo.DienteCodigo(OdontogramaId);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteCodigo_NroHistoria' AND object_id = OBJECT_ID('dbo.DienteCodigo'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_DienteCodigo_NroHistoria ON dbo.DienteCodigo(Nro_Historia);
    END
    GO

    -- Tabla para transposiciones dentarias (flechas entre dientes)
    -- Transposiciones (flechas entre dos dientes)
    CREATE TABLE dbo.Transposicion (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NOT NULL,
        Nro_Historia NVARCHAR(50) NOT NULL,
        Diente_From TINYINT NOT NULL,
        Diente_To TINYINT NOT NULL,
        Color NVARCHAR(30) NULL,
        Observaciones NVARCHAR(500) NULL,
        Metadata NVARCHAR(MAX) NULL,
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        CONSTRAINT FK_Transposicion_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE
    );
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transposicion_OdontogramaId' AND object_id = OBJECT_ID('dbo.Transposicion'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Transposicion_OdontogramaId ON dbo.Transposicion(OdontogramaId);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transposicion_NroHistoria' AND object_id = OBJECT_ID('dbo.Transposicion'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Transposicion_NroHistoria ON dbo.Transposicion(Nro_Historia);
    END
    GO

    -- Tabla para prótesis por diente
    -- Protesis: entidad general para prótesis y coronas (vinculada a una lista de dientes en ProtesisTeeth)
    CREATE TABLE dbo.Protesis (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NOT NULL,
        Nro_Historia NVARCHAR(50) NOT NULL,
        Tipo NVARCHAR(50) NOT NULL, -- 'corona','puente','implante','removible_parcial','removible_total'
        SubTipo NVARCHAR(100) NULL,
        Posicion NVARCHAR(20) NULL, -- 'superior'|'inferior'|'ambas'
        Color NVARCHAR(30) NULL,
        Observaciones NVARCHAR(500) NULL,
        Metadata NVARCHAR(MAX) NULL,
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        CONSTRAINT FK_Protesis_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE
    );

    -- Tabla relacional que liga cada prótesis con sus dientes
    CREATE TABLE dbo.ProtesisTeeth (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProtesisId INT NOT NULL,
        NumeroDiente TINYINT NOT NULL,
        Posicion NVARCHAR(20) NULL,
        CONSTRAINT FK_ProtesisTeeth_Protesis FOREIGN KEY (ProtesisId) REFERENCES dbo.Protesis(Id) ON DELETE CASCADE
    );
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Protesis_OdontogramaId' AND object_id = OBJECT_ID('dbo.Protesis'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Protesis_OdontogramaId ON dbo.Protesis(OdontogramaId);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Protesis_NroHistoria' AND object_id = OBJECT_ID('dbo.Protesis'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Protesis_NroHistoria ON dbo.Protesis(Nro_Historia);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProtesisTeeth_ProtesisId' AND object_id = OBJECT_ID('dbo.ProtesisTeeth'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_ProtesisTeeth_ProtesisId ON dbo.ProtesisTeeth(ProtesisId);
    END
    GO

    -- Tabla para diastemas (espacios entre dientes)
    IF OBJECT_ID('dbo.Diastema','U') IS NOT NULL DROP TABLE dbo.Diastema;
    CREATE TABLE dbo.Diastema (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NOT NULL,
        Nro_Historia NVARCHAR(50) NOT NULL,
        Diente_Left TINYINT NOT NULL,
        Diente_Right TINYINT NOT NULL,
        Tamano DECIMAL(6,2) NULL, -- tamaño en mm (opcional)
        Observaciones NVARCHAR(500) NULL,
        Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario_Creacion NVARCHAR(100) NULL,
        CONSTRAINT FK_Diastema_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE
    );
    GO

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diastema_OdontogramaId' AND object_id = OBJECT_ID('dbo.Diastema'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Diastema_OdontogramaId ON dbo.Diastema(OdontogramaId);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diastema_NroHistoria' AND object_id = OBJECT_ID('dbo.Diastema'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Diastema_NroHistoria ON dbo.Diastema(Nro_Historia);
    END
    GO

    -- Tabla de auditoría simple para cambios rápidos
    IF OBJECT_ID('dbo.OdontogramaAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaAudit;
    CREATE TABLE dbo.OdontogramaAudit (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OdontogramaId INT NULL,
        Nro_Historia NVARCHAR(50) NULL,
        Accion NVARCHAR(50) NOT NULL,
        Detalle NVARCHAR(MAX) NULL,
        Fecha DATETIME2 NOT NULL DEFAULT(GETDATE()),
        Usuario NVARCHAR(100) NULL
    );
    GO

    -- TABLAS CATALOGO (opcionales)
    IF OBJECT_ID('dbo.CatalogoEstadoDiente','U') IS NOT NULL DROP TABLE dbo.CatalogoEstadoDiente;
    CREATE TABLE dbo.CatalogoEstadoDiente (
        Codigo NVARCHAR(50) PRIMARY KEY,
        Nombre NVARCHAR(100) NOT NULL,
        Descripcion NVARCHAR(250) NULL
    );
    GO

    -- Insertar algunos estados de ejemplo
    INSERT INTO dbo.CatalogoEstadoDiente (Codigo, Nombre) VALUES
    ('BUENO','Buen Estado'),
    ('CARIES','Caries'),
    ('ENDODONCIA','Endodoncia'),
    ('EXTRACCION','Extraccion');
    GO


    -- Nota: eliminada la tabla CatalogoProcedimiento y su FK.
    -- Los códigos ahora se consultan desde FactCatalogoServicios y Diagnosticos.

    -- Triggers simples para auditar cambios importantes (INSERTs)
    -- Trigger: log insert en DienteCodigo
    IF OBJECT_ID('dbo.trg_DienteCodigo_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteCodigo_Insert;
    GO
    CREATE TRIGGER dbo.trg_DienteCodigo_Insert
    ON dbo.DienteCodigo
    AFTER INSERT
    AS
    BEGIN
        SET NOCOUNT ON;
        INSERT INTO dbo.OdontogramaAudit (OdontogramaId, Nro_Historia, Accion, Detalle, Usuario)
        SELECT i.OdontogramaId, i.Nro_Historia, 'INSERT_DIENTE_CODIGO',
            'Diente=' + CAST(i.NumeroDiente AS NVARCHAR(10)) + ';Codigo=' + i.Codigo + ';Desc=' + ISNULL(i.Descripcion,''),
            i.Usuario_Creacion
        FROM inserted i;
    END
    GO

    -- Trigger: log insert/update en DienteArea
    IF OBJECT_ID('dbo.trg_DienteArea_InsertUpdate','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteArea_InsertUpdate;
    GO
    CREATE TRIGGER dbo.trg_DienteArea_InsertUpdate
    ON dbo.DienteArea
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        INSERT INTO dbo.OdontogramaAudit (OdontogramaId, Nro_Historia, Accion, Detalle, Usuario)
        SELECT i.OdontogramaId, i.Nro_Historia,
            CASE WHEN EXISTS(SELECT 1 FROM deleted d WHERE d.Id = i.Id) THEN 'UPDATE_DIENTE_AREA' ELSE 'INSERT_DIENTE_AREA' END,
            'Diente=' + CAST(i.NumeroDiente AS NVARCHAR(10)) + ';Area=' + i.Area + ';Estado=' + ISNULL(i.Estado,''),
            i.Usuario_Creacion
        FROM inserted i;
    END
    GO

    -- Trigger: log insert en Protesis
    IF OBJECT_ID('dbo.trg_Protesis_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Protesis_Insert;
    GO
    CREATE TRIGGER dbo.trg_Protesis_Insert
    ON dbo.Protesis
    AFTER INSERT
    AS
    BEGIN
        SET NOCOUNT ON;
        INSERT INTO dbo.OdontogramaAudit (OdontogramaId, Nro_Historia, Accion, Detalle, Usuario)
        SELECT i.OdontogramaId, i.Nro_Historia, 'INSERT_PROTESIS', 'Tipo=' + i.Tipo + ';SubTipo=' + ISNULL(i.SubTipo,''), i.Usuario_Creacion
        FROM inserted i;
    END
    GO

    -- Trigger: log insert en Transposicion
    IF OBJECT_ID('dbo.trg_Transposicion_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Transposicion_Insert;
    GO
    CREATE TRIGGER dbo.trg_Transposicion_Insert
    ON dbo.Transposicion
    AFTER INSERT
    AS
    BEGIN
        SET NOCOUNT ON;
        INSERT INTO dbo.OdontogramaAudit (OdontogramaId, Nro_Historia, Accion, Detalle, Usuario)
        SELECT i.OdontogramaId, i.Nro_Historia, 'INSERT_TRANSPOSICION', 'From=' + CAST(i.Diente_From AS NVARCHAR(10)) + ';To=' + CAST(i.Diente_To AS NVARCHAR(10)), i.Usuario_Creacion
        FROM inserted i;
    END
    GO

    -- NOTAS:
    -- 1) Si tu aplicación maneja versiones de odontograma (ej.: uno por visita), usa la tabla Odontograma con Version y crea
    --    un odontograma nuevo por cada visita en lugar de sobrescribir.
    -- 2) En escenarios donde prefieras una sola tabla con JSON por diente, SQL Server 2012 no soporta JSON nativo. Por eso
    --    diseñamos tablas normalizadas.
    -- 3) Para rendimiento, revisa índices en columnas que uses en WHERE (Nro_Cuenta, OdontogramaId, NumeroDiente).

    GO

    PRINT 'Script tablas.sql completado.';
    GO

    -- =============================
    -- EXTENSION: VERSIONAMIENTO Y ELEMENTOS AVANZADOS
    -- Agregado incremental sin alterar tablas existentes para compatibilidad.
    -- Nuevas tablas referencian OdontogramaVersionId. Si aún no migras, puedes
    -- crear una fila en OdontogramaVersion por cada Odontograma y usar ese Id.
    -- =============================

    IF OBJECT_ID('dbo.OdontogramaVersion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.OdontogramaVersion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaId INT NOT NULL,
            VersionNumber INT NOT NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            ParentVersionId INT NULL,
            Locked BIT NOT NULL DEFAULT(0),
            Metadata NVARCHAR(MAX) NULL,
            CONSTRAINT FK_OdontogramaVersion_Odontograma FOREIGN KEY (OdontogramaId) REFERENCES dbo.Odontograma(Id) ON DELETE CASCADE,
            CONSTRAINT FK_OdontogramaVersion_Parent FOREIGN KEY (ParentVersionId) REFERENCES dbo.OdontogramaVersion(Id)
        );
        CREATE UNIQUE INDEX UQ_OdontogramaVersion ON dbo.OdontogramaVersion(OdontogramaId, VersionNumber);
        CREATE INDEX IX_OdontogramaVersion_OdontogramaId ON dbo.OdontogramaVersion(OdontogramaId);
    END
    GO

    -- Helper: si no existen versiones, crear la inicial por cada odontograma (ejecutar manualmente)
    -- INSERT INTO dbo.OdontogramaVersion (OdontogramaId, VersionNumber, Usuario_Creacion)
    -- SELECT Id, 1, Usuario_Creacion FROM dbo.Odontograma o
    -- WHERE NOT EXISTS (SELECT 1 FROM dbo.OdontogramaVersion v WHERE v.OdontogramaId = o.Id);

    -- =============================
    -- ELEMENTOS INDIVIDUALES POR DIENTE
    -- Patrón: OdontogramaVersionId + NumeroDiente + atributos específicos
    -- =============================

    IF OBJECT_ID('dbo.Fractura','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Fractura (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Tipo NVARCHAR(50) NULL, -- vertical/horizontal/etc.
            Severidad NVARCHAR(30) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Fractura_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Fractura UNIQUE (OdontogramaVersionId, NumeroDiente, Tipo)
        );
        CREATE INDEX IX_Fractura_Version ON dbo.Fractura(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Espigo','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Espigo (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Tipo NVARCHAR(30) NULL, -- muñon / poste / perno
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Espigo_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Espigo UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Espigo_Version ON dbo.Espigo(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Erupcion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Erupcion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            ProgresoPct DECIMAL(5,2) NULL, -- % erupción
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Erupcion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Erupcion UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Erupcion_Version ON dbo.Erupcion(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Extruida','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Extruida (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            MagnitudMM DECIMAL(5,2) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Extruida_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Extruida UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Extruida_Version ON dbo.Extruida(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Intrusion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Intrusion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            MagnitudMM DECIMAL(5,2) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Intrusion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Intrusion UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Intrusion_Version ON dbo.Intrusion(OdontogramaVersionId);
    END
    GO

    -- Nueva tabla: configuración de raíces por diente (triángulos superiores)
    -- Captura el estado visual de hasta 3 triángulos (según tipo de diente) en la versión.
    -- Configuracion: 1,2,3 (cantidad de triángulos que aplica al diente en UI)
    IF OBJECT_ID('dbo.Raiz','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Raiz (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Configuracion TINYINT NOT NULL, -- 1 | 2 | 3
            Triangulo1Activo BIT NOT NULL DEFAULT(0),
            Triangulo2Activo BIT NOT NULL DEFAULT(0),
            Triangulo3Activo BIT NOT NULL DEFAULT(0),
            Activo BIT NOT NULL DEFAULT(1),
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            Fecha_Modificacion DATETIME2 NULL,
            Usuario_Modificacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Raiz_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Raiz UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Raiz_Version ON dbo.Raiz(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Giroversion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Giroversion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Direccion NVARCHAR(10) NOT NULL, -- cw/ccw
            Grados INT NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Giroversion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Giroversion UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Giroversion_Version ON dbo.Giroversion(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Clavija','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Clavija (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Posicion NVARCHAR(10) NOT NULL, -- above/below
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Clavija_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Clavija UNIQUE (OdontogramaVersionId, NumeroDiente, Posicion)
        );
        CREATE INDEX IX_Clavija_Version ON dbo.Clavija(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Geminacion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Geminacion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Tipo NVARCHAR(30) NULL, -- parcial / completa
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Geminacion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Geminacion UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Geminacion_Version ON dbo.Geminacion(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Supernumerario','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Supernumerario (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Diente_A TINYINT NOT NULL,
            Diente_B TINYINT NULL, -- opcional si entre dos piezas
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Supernumerario_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_Supernumerario_Version ON dbo.Supernumerario(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Impactacion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Impactacion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Tipo NVARCHAR(30) NULL, -- ósea / mucosa / parcial
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Impactacion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Impactacion UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Impactacion_Version ON dbo.Impactacion(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Endodoncia','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Endodoncia (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Conductos INT NULL,
            Estado NVARCHAR(50) NULL, -- parcial/completa/retratamiento
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Endodoncia_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Endodoncia UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Endodoncia_Version ON dbo.Endodoncia(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.CoronaTemporal','U') IS NULL
    BEGIN
        CREATE TABLE dbo.CoronaTemporal (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Material NVARCHAR(50) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_CoronaTemporal_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_CoronaTemporal UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_CoronaTemporal_Version ON dbo.CoronaTemporal(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.CoronaV','U') IS NULL
    BEGIN
        CREATE TABLE dbo.CoronaV (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            TipoCodigo NVARCHAR(50) NULL, -- metal-porcelana/zirconio/resina/etc
            Material NVARCHAR(50) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_CoronaV_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_CoronaV UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_CoronaV_Version ON dbo.CoronaV(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Restauracion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Restauracion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Tipo NVARCHAR(50) NOT NULL, -- temporal/definitiva/inlay/onlay/corona
            Material NVARCHAR(50) NULL,
            Areas NVARCHAR(200) NULL, -- lista de áreas separadas por comas
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Restauracion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_Restauracion_Version ON dbo.Restauracion(OdontogramaVersionId);
    END
    GO

    -- =============================
    -- ELEMENTOS DE DOS DIENTES / TRAMOS
    -- =============================

    IF OBJECT_ID('dbo.Fusion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Fusion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Diente_A TINYINT NOT NULL,
            Diente_B TINYINT NOT NULL,
            Tipo NVARCHAR(30) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Fusion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Fusion UNIQUE (OdontogramaVersionId, Diente_A, Diente_B)
        );
        CREATE INDEX IX_Fusion_Version ON dbo.Fusion(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Edentulo','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Edentulo (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Diente_Inicio TINYINT NOT NULL,
            Diente_Fin TINYINT NOT NULL,
            Tipo NVARCHAR(30) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Edentulo_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Edentulo UNIQUE (OdontogramaVersionId, Diente_Inicio, Diente_Fin)
        );
        CREATE INDEX IX_Edentulo_Version ON dbo.Edentulo(OdontogramaVersionId);
    END
    GO

    -- =============================
    -- PROTESIS / IMPLANTES (versionadas)
    -- =============================

    IF OBJECT_ID('dbo.ProtesisV','U') IS NULL
    BEGIN
        CREATE TABLE dbo.ProtesisV (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            TipoCodigo NVARCHAR(50) NOT NULL,
            SubTipo NVARCHAR(100) NULL,
            MaterialCodigo NVARCHAR(50) NULL,
            Color NVARCHAR(30) NULL,
            Observaciones NVARCHAR(500) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_ProtesisV_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_ProtesisV_Version ON dbo.ProtesisV(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.ProtesisVTeeth','U') IS NULL
    BEGIN
        CREATE TABLE dbo.ProtesisVTeeth (
            Id INT IDENTITY PRIMARY KEY,
            ProtesisVId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Rol NVARCHAR(30) NULL, -- pilar/pontico/implante
            Metadata NVARCHAR(MAX) NULL,
            CONSTRAINT FK_ProtesisVTeeth_ProtesisV FOREIGN KEY (ProtesisVId) REFERENCES dbo.ProtesisV(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_ProtesisVTeeth UNIQUE (ProtesisVId, NumeroDiente)
        );
        CREATE INDEX IX_ProtesisVTeeth_ProtesisVId ON dbo.ProtesisVTeeth(ProtesisVId);
    END
    GO

    IF OBJECT_ID('dbo.Implante','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Implante (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            DiametroMM DECIMAL(4,2) NULL,
            LongitudMM DECIMAL(4,1) NULL,
            Sistema NVARCHAR(50) NULL,
            Material NVARCHAR(50) NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Implante_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Implante UNIQUE (OdontogramaVersionId, NumeroDiente)
        );
        CREATE INDEX IX_Implante_Version ON dbo.Implante(OdontogramaVersionId);
    END
    GO

    -- =============================
    -- APARATOLOGIA / ORTODONCIA
    -- =============================

    IF OBJECT_ID('dbo.AparatoFijo','U') IS NULL
    BEGIN
        CREATE TABLE dbo.AparatoFijo (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Tipo NVARCHAR(50) NOT NULL, -- ortodoncia/retencion
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_AparatoFijo_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_AparatoFijo_Version ON dbo.AparatoFijo(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.AparatoFijoDiente','U') IS NULL
    BEGIN
        CREATE TABLE dbo.AparatoFijoDiente (
            Id INT IDENTITY PRIMARY KEY,
            AparatoFijoId INT NOT NULL,
            NumeroDiente TINYINT NOT NULL,
            Elemento NVARCHAR(30) NOT NULL, -- bracket/banda
            Metadata NVARCHAR(MAX) NULL,
            CONSTRAINT FK_AparatoFijoDiente_Aparato FOREIGN KEY (AparatoFijoId) REFERENCES dbo.AparatoFijo(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_AparatoFijoDiente UNIQUE (AparatoFijoId, NumeroDiente, Elemento)
        );
        CREATE INDEX IX_AparatoFijoDiente_AparatoId ON dbo.AparatoFijoDiente(AparatoFijoId);
    END
    GO

    IF OBJECT_ID('dbo.AparatoRemovible','U') IS NULL
    BEGIN
        CREATE TABLE dbo.AparatoRemovible (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Tipo NVARCHAR(50) NOT NULL, -- retenedor/placaactiva/funcional
            Posicion NVARCHAR(20) NULL, -- superior/inferior
            DienteInicio TINYINT NULL,
            DienteFin TINYINT NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_AparatoRemovible_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_AparatoRemovible_Version ON dbo.AparatoRemovible(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.ArcoOrtodoncia','U') IS NULL
    BEGIN
        CREATE TABLE dbo.ArcoOrtodoncia (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Tipo NVARCHAR(50) NULL, -- arco_superior / arco_inferior
            Color NVARCHAR(30) NULL,
            Puntos NVARCHAR(MAX) NOT NULL, -- JSON array de puntos [{x:..,y:..}]
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            Metadata NVARCHAR(MAX) NULL,
            CONSTRAINT FK_ArcoOrtodoncia_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_ArcoOrtodoncia_Version ON dbo.ArcoOrtodoncia(OdontogramaVersionId);
    END
    GO

    -- =============================
    -- ELEMENTOS GENERALES DEL LIENZO
    -- =============================

    IF OBJECT_ID('dbo.Linea','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Linea (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Color NVARCHAR(30) NULL,
            Grosor DECIMAL(4,2) NULL,
            Tipo NVARCHAR(30) NULL, -- continua/segmentada
            Puntos NVARCHAR(MAX) NOT NULL, -- JSON array
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Linea_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_Linea_Version ON dbo.Linea(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Flecha','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Flecha (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Color NVARCHAR(30) NULL,
            OrigenX DECIMAL(6,3) NOT NULL,
            OrigenY DECIMAL(6,3) NOT NULL,
            DestinoX DECIMAL(6,3) NOT NULL,
            DestinoY DECIMAL(6,3) NOT NULL,
            Estilo NVARCHAR(30) NULL, -- recta/curva
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Flecha_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_Flecha_Version ON dbo.Flecha(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.SimboloClinico','U') IS NULL
    BEGIN
        CREATE TABLE dbo.SimboloClinico (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            TipoCodigo NVARCHAR(50) NOT NULL,
            PosX DECIMAL(6,3) NOT NULL,
            PosY DECIMAL(6,3) NOT NULL,
            Color NVARCHAR(30) NULL,
            Metadata NVARCHAR(MAX) NULL,
            CONSTRAINT FK_SimboloClinico_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_SimboloClinico_Version ON dbo.SimboloClinico(OdontogramaVersionId);
    END
    GO

    IF OBJECT_ID('dbo.Anotacion','U') IS NULL
    BEGIN
        CREATE TABLE dbo.Anotacion (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL,
            Categoria NVARCHAR(50) NULL,
            Texto NVARCHAR(1000) NULL,
            Metadata NVARCHAR(MAX) NULL,
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario_Creacion NVARCHAR(100) NULL,
            CONSTRAINT FK_Anotacion_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_Anotacion_Version ON dbo.Anotacion(OdontogramaVersionId);
    END
    GO

    -- =============================
    -- AUDITORIA EXTENDIDA (opcional)
    -- =============================
    IF OBJECT_ID('dbo.OdontogramaVersionAudit','U') IS NULL
    BEGIN
        CREATE TABLE dbo.OdontogramaVersionAudit (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NULL,
            Entidad NVARCHAR(50) NOT NULL,
            Accion NVARCHAR(30) NOT NULL,
            Clave NVARCHAR(200) NULL,
            Detalle NVARCHAR(MAX) NULL,
            Fecha DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Usuario NVARCHAR(100) NULL,
            CONSTRAINT FK_OdontogramaVersionAudit_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_OdontogramaVersionAudit_Version_Fecha ON dbo.OdontogramaVersionAudit(OdontogramaVersionId, Fecha DESC);
    END
    GO

    -- =====================================================
    -- SNAPSHOT COMPLETO DE LA VERSION (estado consolidado)
    -- Guarda un JSON único por cada version del odontograma
    -- para rehidratación rápida del histórico.
    -- =====================================================
    IF OBJECT_ID('dbo.OdontogramaVersionSnapshot','U') IS NULL
    BEGIN
        CREATE TABLE dbo.OdontogramaVersionSnapshot (
            Id INT IDENTITY PRIMARY KEY,
            OdontogramaVersionId INT NOT NULL UNIQUE,
            Data NVARCHAR(MAX) NOT NULL, -- JSON serializado con todos los arrays/mapas del front
            Hash NVARCHAR(64) NULL,      -- opcional: hash de integridad (SHA256 hex) si se desea
            Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE()),
            Fecha_Modificacion DATETIME2 NULL,
            Usuario_Creacion NVARCHAR(100) NULL,
            Usuario_Modificacion NVARCHAR(100) NULL,
            Metadata NVARCHAR(MAX) NULL,
            CONSTRAINT FK_OdontogramaVersionSnapshot_Version FOREIGN KEY (OdontogramaVersionId) REFERENCES dbo.OdontogramaVersion(Id) ON DELETE CASCADE
        );
        CREATE INDEX IX_OdontogramaVersionSnapshot_Version ON dbo.OdontogramaVersionSnapshot(OdontogramaVersionId);
    END
    GO

    PRINT 'Extensión de tablas avanzadas aplicada.';
    GO



