    -- ==================================================================
    -- Bloque opcional de limpieza (DROP) - ejecutar antes de actualizar
    -- Ejecuta este bloque si quieres eliminar las tablas/objetos creados
    -- anteriormente para evitar conflictos al volver a aplicar el script.
    -- NOTA: revisa y usa con cuidado en entornos de producción.
    -- ==================================================================

    /*
    Bloque adicional: limpieza idempotente para entornos de desarrollo.
    Ejecuta este bloque si necesitas eliminar objetos creados por este script antes de volver a aplicarlo.
    */
    -- Limpieza: eliminar triggers e índices (de forma segura si existen)
    IF OBJECT_ID('dbo.trg_DienteCodigo_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteCodigo_Insert;
    IF OBJECT_ID('dbo.trg_DienteArea_InsertUpdate','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteArea_InsertUpdate;
    IF OBJECT_ID('dbo.trg_Protesis_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Protesis_Insert;
    IF OBJECT_ID('dbo.trg_Transposicion_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Transposicion_Insert;

    -- (Opcional) eliminar índices creados por el script
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Odontograma_NroCuenta' AND object_id = OBJECT_ID('dbo.Odontograma'))
        DROP INDEX IX_Odontograma_NroCuenta ON dbo.Odontograma;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diente_OdontogramaId' AND object_id = OBJECT_ID('dbo.Diente'))
        DROP INDEX IX_Diente_OdontogramaId ON dbo.Diente;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transposicion_OdontogramaId' AND object_id = OBJECT_ID('dbo.Transposicion'))
        DROP INDEX IX_Transposicion_OdontogramaId ON dbo.Transposicion;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Protesis_OdontogramaId' AND object_id = OBJECT_ID('dbo.Protesis'))
        DROP INDEX IX_Protesis_OdontogramaId ON dbo.Protesis;

    -- (Opcional) eliminar tablas en orden inverso de dependencia
    IF OBJECT_ID('dbo.ProtesisTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisTeeth;
    IF OBJECT_ID('dbo.Protesis','U') IS NOT NULL DROP TABLE dbo.Protesis;
    IF OBJECT_ID('dbo.Transposicion','U') IS NOT NULL DROP TABLE dbo.Transposicion;
    IF OBJECT_ID('dbo.DienteCodigo','U') IS NOT NULL DROP TABLE dbo.DienteCodigo;
    IF OBJECT_ID('dbo.DienteArea','U') IS NOT NULL DROP TABLE dbo.DienteArea;
    IF OBJECT_ID('dbo.Diente','U') IS NOT NULL DROP TABLE dbo.Diente;
    IF OBJECT_ID('dbo.Diastema','U') IS NOT NULL DROP TABLE dbo.Diastema;
    IF OBJECT_ID('dbo.TempRestoration','U') IS NOT NULL DROP TABLE dbo.TempRestoration;
    IF OBJECT_ID('dbo.OdontogramaAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaAudit;
    IF OBJECT_ID('dbo.CatalogoProcedimiento','U') IS NOT NULL DROP TABLE dbo.CatalogoProcedimiento;
    IF OBJECT_ID('dbo.CatalogoEstadoDiente','U') IS NOT NULL DROP TABLE dbo.CatalogoEstadoDiente;
    IF OBJECT_ID('dbo.Odontograma','U') IS NOT NULL DROP TABLE dbo.Odontograma;



    -- Eliminar triggers relacionados (si existen)
    IF OBJECT_ID('dbo.trg_DienteCodigo_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteCodigo_Insert;
    IF OBJECT_ID('dbo.trg_DienteArea_InsertUpdate','TR') IS NOT NULL DROP TRIGGER dbo.trg_DienteArea_InsertUpdate;
    IF OBJECT_ID('dbo.trg_Protesis_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Protesis_Insert;
    IF OBJECT_ID('dbo.trg_Transposicion_Insert','TR') IS NOT NULL DROP TRIGGER dbo.trg_Transposicion_Insert;
    GO

    -- Eliminar índices explícitos que pudieran quedar (comprobación previa)
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteCodigo_OdontogramaId' AND object_id = OBJECT_ID('dbo.DienteCodigo'))
        DROP INDEX IX_DienteCodigo_OdontogramaId ON dbo.DienteCodigo;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteCodigo_NroCuenta' AND object_id = OBJECT_ID('dbo.DienteCodigo'))
        DROP INDEX IX_DienteCodigo_NroCuenta ON dbo.DienteCodigo;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteArea_OdontogramaId' AND object_id = OBJECT_ID('dbo.DienteArea'))
        DROP INDEX IX_DienteArea_OdontogramaId ON dbo.DienteArea;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DienteArea_NroCuenta' AND object_id = OBJECT_ID('dbo.DienteArea'))
        DROP INDEX IX_DienteArea_NroCuenta ON dbo.DienteArea;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transposicion_OdontogramaId' AND object_id = OBJECT_ID('dbo.Transposicion'))
        DROP INDEX IX_Transposicion_OdontogramaId ON dbo.Transposicion;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transposicion_NroCuenta' AND object_id = OBJECT_ID('dbo.Transposicion'))
        DROP INDEX IX_Transposicion_NroCuenta ON dbo.Transposicion;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Protesis_OdontogramaId' AND object_id = OBJECT_ID('dbo.Protesis'))
        DROP INDEX IX_Protesis_OdontogramaId ON dbo.Protesis;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Protesis_NroCuenta' AND object_id = OBJECT_ID('dbo.Protesis'))
        DROP INDEX IX_Protesis_NroCuenta ON dbo.Protesis;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProtesisTeeth_ProtesisId' AND object_id = OBJECT_ID('dbo.ProtesisTeeth'))
        DROP INDEX IX_ProtesisTeeth_ProtesisId ON dbo.ProtesisTeeth;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diastema_OdontogramaId' AND object_id = OBJECT_ID('dbo.Diastema'))
        DROP INDEX IX_Diastema_OdontogramaId ON dbo.Diastema;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diastema_NroCuenta' AND object_id = OBJECT_ID('dbo.Diastema'))
        DROP INDEX IX_Diastema_NroCuenta ON dbo.Diastema;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diente_OdontogramaId' AND object_id = OBJECT_ID('dbo.Diente'))
        DROP INDEX IX_Diente_OdontogramaId ON dbo.Diente;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Diente_NroCuenta' AND object_id = OBJECT_ID('dbo.Diente'))
        DROP INDEX IX_Diente_NroCuenta ON dbo.Diente;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Diente_Odontograma_Numero' AND object_id = OBJECT_ID('dbo.Diente'))
        DROP INDEX UQ_Diente_Odontograma_Numero ON dbo.Diente;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Odontograma_NroCuenta' AND object_id = OBJECT_ID('dbo.Odontograma'))
        DROP INDEX IX_Odontograma_NroCuenta ON dbo.Odontograma;
    GO

    -- Eliminar tablas en orden inverso de dependencias para evitar errores de FK
    IF OBJECT_ID('dbo.ProtesisTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisTeeth;
    IF OBJECT_ID('dbo.Protesis','U') IS NOT NULL DROP TABLE dbo.Protesis;
    IF OBJECT_ID('dbo.DienteCodigo','U') IS NOT NULL DROP TABLE dbo.DienteCodigo;
    IF OBJECT_ID('dbo.DienteArea','U') IS NOT NULL DROP TABLE dbo.DienteArea;
    IF OBJECT_ID('dbo.Diente','U') IS NOT NULL DROP TABLE dbo.Diente;
    IF OBJECT_ID('dbo.Transposicion','U') IS NOT NULL DROP TABLE dbo.Transposicion;
    IF OBJECT_ID('dbo.Diastema','U') IS NOT NULL DROP TABLE dbo.Diastema;
    IF OBJECT_ID('dbo.TempRestoration','U') IS NOT NULL DROP TABLE dbo.TempRestoration;
    IF OBJECT_ID('dbo.Edentulo','U') IS NOT NULL DROP TABLE dbo.Edentulo;
    IF OBJECT_ID('dbo.Espigo','U') IS NOT NULL DROP TABLE dbo.Espigo;
    IF OBJECT_ID('dbo.Fractura','U') IS NOT NULL DROP TABLE dbo.Fractura;
    IF OBJECT_ID('dbo.Fusion','U') IS NOT NULL DROP TABLE dbo.Fusion;
    IF OBJECT_ID('dbo.Geminacion','U') IS NOT NULL DROP TABLE dbo.Geminacion;
    IF OBJECT_ID('dbo.Giroversion','U') IS NOT NULL DROP TABLE dbo.Giroversion;
    IF OBJECT_ID('dbo.Clavija','U') IS NOT NULL DROP TABLE dbo.Clavija;
    IF OBJECT_ID('dbo.Erupcion','U') IS NOT NULL DROP TABLE dbo.Erupcion;
    IF OBJECT_ID('dbo.Extruida','U') IS NOT NULL DROP TABLE dbo.Extruida;
    IF OBJECT_ID('dbo.Intrusion','U') IS NOT NULL DROP TABLE dbo.Intrusion;
    IF OBJECT_ID('dbo.Supernumeraria','U') IS NOT NULL DROP TABLE dbo.Supernumeraria;
    IF OBJECT_ID('dbo.FullProsthesis','U') IS NOT NULL DROP TABLE dbo.FullProsthesis;
    IF OBJECT_ID('dbo.PartialRemovable','U') IS NOT NULL DROP TABLE dbo.PartialRemovable;
    IF OBJECT_ID('dbo.RemovableAppliance','U') IS NOT NULL DROP TABLE dbo.RemovableAppliance;
    IF OBJECT_ID('dbo.OdontogramaAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaAudit;
    IF OBJECT_ID('dbo.CatalogoProcedimiento','U') IS NOT NULL DROP TABLE dbo.CatalogoProcedimiento;
    IF OBJECT_ID('dbo.CatalogoEstadoDiente','U') IS NOT NULL DROP TABLE dbo.CatalogoEstadoDiente;
    IF OBJECT_ID('dbo.Odontograma','U') IS NOT NULL DROP TABLE dbo.Odontograma;
    GO

    -- ==================================================================
    -- BLOQUE AMPLIADO DE LIMPIEZA SEGURO (VERSIONAMIENTO)
    -- Este bloque elimina primero las tablas que dependen de OdontogramaVersion
    -- y luego OdontogramaVersion, para permitir que finalmente se pueda eliminar
    -- Odontograma sin errores de FOREIGN KEY.
    -- Ejecuta sólo en entornos de desarrollo / migración.
    -- ==================================================================
    /*
        IMPORTANTE:
        1. Asegúrate de tener respaldo antes de ejecutar.
        2. Si hay sesiones usando estas tablas, podrías necesitar:
            ALTER DATABASE <TuDB> SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            ... DROP ...
            ALTER DATABASE <TuDB> SET MULTI_USER;
    */

    -- Eliminar triggers adicionales si existieran sobre tablas versionadas (no listados originalmente)
    -- (Agregar aquí si en el futuro se crean triggers sobre las tablas de versión)

    -- 1) Tablas de elementos versionados (hijos de OdontogramaVersion)
    IF OBJECT_ID('dbo.Linea','U') IS NOT NULL DROP TABLE dbo.Linea;
    IF OBJECT_ID('dbo.Flecha','U') IS NOT NULL DROP TABLE dbo.Flecha;
    IF OBJECT_ID('dbo.SimboloClinico','U') IS NOT NULL DROP TABLE dbo.SimboloClinico;
    IF OBJECT_ID('dbo.Anotacion','U') IS NOT NULL DROP TABLE dbo.Anotacion;
    IF OBJECT_ID('dbo.AparatoFijoDiente','U') IS NOT NULL DROP TABLE dbo.AparatoFijoDiente;
    IF OBJECT_ID('dbo.AparatoFijo','U') IS NOT NULL DROP TABLE dbo.AparatoFijo;
    IF OBJECT_ID('dbo.ArcoOrtodoncia','U') IS NOT NULL DROP TABLE dbo.ArcoOrtodoncia;
    IF OBJECT_ID('dbo.AparatoFijoDiente','U') IS NOT NULL DROP TABLE dbo.AparatoFijoDiente;
    IF OBJECT_ID('dbo.AparatoFijo','U') IS NOT NULL DROP TABLE dbo.AparatoFijo;
    IF OBJECT_ID('dbo.AparatoRemovible','U') IS NOT NULL DROP TABLE dbo.AparatoRemovible;
    IF OBJECT_ID('dbo.ProtesisVTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisVTeeth;
    IF OBJECT_ID('dbo.ProtesisV','U') IS NOT NULL DROP TABLE dbo.ProtesisV;
    IF OBJECT_ID('dbo.Implante','U') IS NOT NULL DROP TABLE dbo.Implante;
    IF OBJECT_ID('dbo.Fusion','U') IS NOT NULL DROP TABLE dbo.Fusion;
    IF OBJECT_ID('dbo.Edentulo','U') IS NOT NULL DROP TABLE dbo.Edentulo;
    IF OBJECT_ID('dbo.Supernumerario','U') IS NOT NULL DROP TABLE dbo.Supernumerario;
    IF OBJECT_ID('dbo.Restauracion','U') IS NOT NULL DROP TABLE dbo.Restauracion;
    IF OBJECT_ID('dbo.CoronaV','U') IS NOT NULL DROP TABLE dbo.CoronaV;
    IF OBJECT_ID('dbo.CoronaTemporal','U') IS NOT NULL DROP TABLE dbo.CoronaTemporal;
    IF OBJECT_ID('dbo.Endodoncia','U') IS NOT NULL DROP TABLE dbo.Endodoncia;
    IF OBJECT_ID('dbo.Impactacion','U') IS NOT NULL DROP TABLE dbo.Impactacion;
    IF OBJECT_ID('dbo.Geminacion','U') IS NOT NULL DROP TABLE dbo.Geminacion;
    IF OBJECT_ID('dbo.Giroversion','U') IS NOT NULL DROP TABLE dbo.Giroversion;
    IF OBJECT_ID('dbo.Clavija','U') IS NOT NULL DROP TABLE dbo.Clavija;
    IF OBJECT_ID('dbo.Intrusion','U') IS NOT NULL DROP TABLE dbo.Intrusion;
    IF OBJECT_ID('dbo.Extruida','U') IS NOT NULL DROP TABLE dbo.Extruida;
    IF OBJECT_ID('dbo.Erupcion','U') IS NOT NULL DROP TABLE dbo.Erupcion;
    IF OBJECT_ID('dbo.Espigo','U') IS NOT NULL DROP TABLE dbo.Espigo;
    IF OBJECT_ID('dbo.Fractura','U') IS NOT NULL DROP TABLE dbo.Fractura;

    -- 2) Auditoría de versiones (referencia a OdontogramaVersion)
    IF OBJECT_ID('dbo.OdontogramaVersionAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersionAudit;

    -- 3) Tabla de versiones (referencia a Odontograma)
    IF OBJECT_ID('dbo.OdontogramaVersion','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersion;

    -- 4) Finalmente las tablas base que referencian Odontograma (si no se eliminaron antes)
    IF OBJECT_ID('dbo.ProtesisTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisTeeth;
    IF OBJECT_ID('dbo.Protesis','U') IS NOT NULL DROP TABLE dbo.Protesis;
    IF OBJECT_ID('dbo.Transposicion','U') IS NOT NULL DROP TABLE dbo.Transposicion;
    IF OBJECT_ID('dbo.Diastema','U') IS NOT NULL DROP TABLE dbo.Diastema;
    IF OBJECT_ID('dbo.DienteCodigo','U') IS NOT NULL DROP TABLE dbo.DienteCodigo;
    IF OBJECT_ID('dbo.DienteArea','U') IS NOT NULL DROP TABLE dbo.DienteArea;
    IF OBJECT_ID('dbo.Diente','U') IS NOT NULL DROP TABLE dbo.Diente;
    IF OBJECT_ID('dbo.OdontogramaAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaAudit;
    IF OBJECT_ID('dbo.CatalogoProcedimiento','U') IS NOT NULL DROP TABLE dbo.CatalogoProcedimiento;
    IF OBJECT_ID('dbo.CatalogoEstadoDiente','U') IS NOT NULL DROP TABLE dbo.CatalogoEstadoDiente;

    -- 5) Última: Odontograma
    IF OBJECT_ID('dbo.Odontograma','U') IS NOT NULL DROP TABLE dbo.Odontograma;
    GO

    PRINT 'Bloque de limpieza ampliado ejecutado.';
    GO




























-- ========================================
-- SCRIPT DE LIMPIEZA COMPLETA - VERSIÓN MEJORADA
-- Elimina todas las tablas del sistema de odontogramas
-- ========================================

SET NOCOUNT ON;
GO

PRINT 'Iniciando limpieza completa del sistema de odontogramas...';
GO

-- ========================================
-- 1. IDENTIFICAR DEPENDENCIAS PROBLEMÁTICAS
-- ========================================
PRINT 'Identificando dependencias...';
PRINT '';

SELECT 
    OBJECT_NAME(f.parent_object_id) AS TablaHija,
    OBJECT_NAME(f.referenced_object_id) AS TablaPadre,
    f.name AS NombreFK
FROM sys.foreign_keys f
WHERE OBJECT_NAME(f.referenced_object_id) IN ('Odontograma', 'OdontogramaVersion')
ORDER BY OBJECT_NAME(f.referenced_object_id), OBJECT_NAME(f.parent_object_id);

PRINT '';
PRINT '========================================';
GO

-- ========================================
-- 2. ELIMINAR TODAS LAS FOREIGN KEYS RELACIONADAS
-- ========================================
PRINT 'Eliminando restricciones de Foreign Key...';

DECLARE @SQL NVARCHAR(MAX) = '';

SELECT @SQL = @SQL + 
    'IF OBJECT_ID(''' + QUOTENAME(OBJECT_SCHEMA_NAME(f.parent_object_id)) + '.' + 
    QUOTENAME(OBJECT_NAME(f.parent_object_id)) + ''', ''U'') IS NOT NULL ' +
    'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(f.parent_object_id)) + '.' + 
    QUOTENAME(OBJECT_NAME(f.parent_object_id)) + 
    ' DROP CONSTRAINT ' + QUOTENAME(f.name) + ';' + CHAR(13) + CHAR(10)
FROM sys.foreign_keys f
WHERE OBJECT_NAME(f.referenced_object_id) IN ('Odontograma', 'OdontogramaVersion')
   OR OBJECT_NAME(f.parent_object_id) IN (
        'Odontograma', 'Diente', 'DienteArea', 'DienteCodigo', 'Transposicion', 
        'Protesis', 'ProtesisTeeth', 'Diastema', 'OdontogramaAudit',
        'CatalogoEstadoDiente', 'CatalogoProcedimiento', 'OdontogramaVersion',
        'Fractura', 'Espigo', 'Erupcion', 'Extruida', 'Intrusion', 'Raiz',
        'Giroversion', 'Clavija', 'Geminacion', 'Supernumerario', 'Impactacion',
        'Endodoncia', 'CoronaTemporal', 'CoronaV', 'Restauracion', 'Fusion',
        'Edentulo', 'ProtesisV', 'ProtesisVTeeth', 'Implante', 'AparatoRemovible',
        'AparatoFijo', 'AparatoFijoDiente', 'ArcoOrtodoncia', 'Linea', 'Flecha',
        'SimboloClinico', 'Anotacion', 'OdontogramaVersionAudit', 'OdontogramaVersionSnapshot'
    );

IF LEN(@SQL) > 0
BEGIN
    EXEC sp_executesql @SQL;
    PRINT 'Foreign Keys eliminadas exitosamente.';
END
ELSE
BEGIN
    PRINT 'No se encontraron Foreign Keys para eliminar.';
END
GO

-- ========================================
-- 3. ELIMINAR TRIGGERS
-- ========================================
PRINT '';
PRINT 'Eliminando triggers...';

IF OBJECT_ID('dbo.trg_DienteCodigo_Insert','TR') IS NOT NULL 
    DROP TRIGGER dbo.trg_DienteCodigo_Insert;
IF OBJECT_ID('dbo.trg_DienteArea_InsertUpdate','TR') IS NOT NULL 
    DROP TRIGGER dbo.trg_DienteArea_InsertUpdate;
IF OBJECT_ID('dbo.trg_Protesis_Insert','TR') IS NOT NULL 
    DROP TRIGGER dbo.trg_Protesis_Insert;
IF OBJECT_ID('dbo.trg_Transposicion_Insert','TR') IS NOT NULL 
    DROP TRIGGER dbo.trg_Transposicion_Insert;
GO

-- ========================================
-- 4. ELIMINAR TODAS LAS TABLAS
-- ========================================
PRINT '';
PRINT 'Eliminando tablas...';

-- Elementos de lienzo y anotaciones
IF OBJECT_ID('dbo.Anotacion','U') IS NOT NULL DROP TABLE dbo.Anotacion;
IF OBJECT_ID('dbo.SimboloClinico','U') IS NOT NULL DROP TABLE dbo.SimboloClinico;
IF OBJECT_ID('dbo.Flecha','U') IS NOT NULL DROP TABLE dbo.Flecha;
IF OBJECT_ID('dbo.Linea','U') IS NOT NULL DROP TABLE dbo.Linea;

-- Aparatos de ortodoncia
IF OBJECT_ID('dbo.ArcoOrtodoncia','U') IS NOT NULL DROP TABLE dbo.ArcoOrtodoncia;
IF OBJECT_ID('dbo.AparatoFijoDiente','U') IS NOT NULL DROP TABLE dbo.AparatoFijoDiente;
IF OBJECT_ID('dbo.AparatoFijo','U') IS NOT NULL DROP TABLE dbo.AparatoFijo;
IF OBJECT_ID('dbo.AparatoRemovible','U') IS NOT NULL DROP TABLE dbo.AparatoRemovible;

-- Prótesis e implantes versionados
IF OBJECT_ID('dbo.ProtesisVTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisVTeeth;
IF OBJECT_ID('dbo.ProtesisV','U') IS NOT NULL DROP TABLE dbo.ProtesisV;
IF OBJECT_ID('dbo.Implante','U') IS NOT NULL DROP TABLE dbo.Implante;

-- Elementos dentales individuales versionados
IF OBJECT_ID('dbo.Restauracion','U') IS NOT NULL DROP TABLE dbo.Restauracion;
IF OBJECT_ID('dbo.CoronaV','U') IS NOT NULL DROP TABLE dbo.CoronaV;
IF OBJECT_ID('dbo.CoronaTemporal','U') IS NOT NULL DROP TABLE dbo.CoronaTemporal;
IF OBJECT_ID('dbo.Endodoncia','U') IS NOT NULL DROP TABLE dbo.Endodoncia;
IF OBJECT_ID('dbo.Raiz','U') IS NOT NULL DROP TABLE dbo.Raiz;

-- Anomalías y condiciones dentales
IF OBJECT_ID('dbo.Fusion','U') IS NOT NULL DROP TABLE dbo.Fusion;
IF OBJECT_ID('dbo.Edentulo','U') IS NOT NULL DROP TABLE dbo.Edentulo;
IF OBJECT_ID('dbo.Supernumerario','U') IS NOT NULL DROP TABLE dbo.Supernumerario;
IF OBJECT_ID('dbo.Impactacion','U') IS NOT NULL DROP TABLE dbo.Impactacion;
IF OBJECT_ID('dbo.Geminacion','U') IS NOT NULL DROP TABLE dbo.Geminacion;
IF OBJECT_ID('dbo.Giroversion','U') IS NOT NULL DROP TABLE dbo.Giroversion;
IF OBJECT_ID('dbo.Clavija','U') IS NOT NULL DROP TABLE dbo.Clavija;
IF OBJECT_ID('dbo.Intrusion','U') IS NOT NULL DROP TABLE dbo.Intrusion;
IF OBJECT_ID('dbo.Extruida','U') IS NOT NULL DROP TABLE dbo.Extruida;
IF OBJECT_ID('dbo.Erupcion','U') IS NOT NULL DROP TABLE dbo.Erupcion;
IF OBJECT_ID('dbo.Espigo','U') IS NOT NULL DROP TABLE dbo.Espigo;
IF OBJECT_ID('dbo.Fractura','U') IS NOT NULL DROP TABLE dbo.Fractura;

-- Auditoría y snapshot de versiones
IF OBJECT_ID('dbo.OdontogramaVersionAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersionAudit;
IF OBJECT_ID('dbo.OdontogramaVersionSnapshot','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersionSnapshot;

-- Tabla de versiones
IF OBJECT_ID('dbo.OdontogramaVersion','U') IS NOT NULL DROP TABLE dbo.OdontogramaVersion;

-- Tablas base del odontograma
IF OBJECT_ID('dbo.ProtesisTeeth','U') IS NOT NULL DROP TABLE dbo.ProtesisTeeth;
IF OBJECT_ID('dbo.Protesis','U') IS NOT NULL DROP TABLE dbo.Protesis;
IF OBJECT_ID('dbo.Transposicion','U') IS NOT NULL DROP TABLE dbo.Transposicion;
IF OBJECT_ID('dbo.DienteCodigo','U') IS NOT NULL DROP TABLE dbo.DienteCodigo;
IF OBJECT_ID('dbo.DienteArea','U') IS NOT NULL DROP TABLE dbo.DienteArea;
IF OBJECT_ID('dbo.Diente','U') IS NOT NULL DROP TABLE dbo.Diente;
IF OBJECT_ID('dbo.Diastema','U') IS NOT NULL DROP TABLE dbo.Diastema;
IF OBJECT_ID('dbo.OdontogramaAudit','U') IS NOT NULL DROP TABLE dbo.OdontogramaAudit;

-- Tablas catálogo
IF OBJECT_ID('dbo.CatalogoProcedimiento','U') IS NOT NULL DROP TABLE dbo.CatalogoProcedimiento;
IF OBJECT_ID('dbo.CatalogoEstadoDiente','U') IS NOT NULL DROP TABLE dbo.CatalogoEstadoDiente;

-- Tabla principal
IF OBJECT_ID('dbo.Odontograma','U') IS NOT NULL DROP TABLE dbo.Odontograma;

PRINT 'Tablas eliminadas.';
GO

-- ========================================
-- 5. VERIFICACIÓN FINAL
-- ========================================
PRINT '';
PRINT '========================================';
PRINT 'VERIFICACIÓN FINAL';
PRINT '========================================';

DECLARE @TablasRestantes INT;

SELECT @TablasRestantes = COUNT(*)
FROM sys.tables
WHERE name IN (
    'Odontograma', 'Diente', 'DienteArea', 'DienteCodigo', 'Transposicion', 
    'Protesis', 'ProtesisTeeth', 'Diastema', 'OdontogramaAudit',
    'CatalogoEstadoDiente', 'CatalogoProcedimiento', 'OdontogramaVersion',
    'Fractura', 'Espigo', 'Erupcion', 'Extruida', 'Intrusion', 'Raiz',
    'Giroversion', 'Clavija', 'Geminacion', 'Supernumerario', 'Impactacion',
    'Endodoncia', 'CoronaTemporal', 'CoronaV', 'Restauracion', 'Fusion',
    'Edentulo', 'ProtesisV', 'ProtesisVTeeth', 'Implante', 'AparatoRemovible',
    'AparatoFijo', 'AparatoFijoDiente', 'ArcoOrtodoncia', 'Linea', 'Flecha',
    'SimboloClinico', 'Anotacion', 'OdontogramaVersionAudit', 'OdontogramaVersionSnapshot'
);

IF @TablasRestantes = 0
BEGIN
    PRINT 'ÉXITO: Todas las tablas del sistema de odontogramas han sido eliminadas correctamente.';
    PRINT '';
END
ELSE
BEGIN
    PRINT 'ADVERTENCIA: Aún existen ' + CAST(@TablasRestantes AS VARCHAR(10)) + ' tabla(s) relacionada(s).';
    PRINT '';
    PRINT 'Tablas restantes:';
    
    SELECT 
        t.name AS TablasRestantes,
        s.name AS Esquema
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name IN (
        'Odontograma', 'Diente', 'DienteArea', 'DienteCodigo', 'Transposicion', 
        'Protesis', 'ProtesisTeeth', 'Diastema', 'OdontogramaAudit',
        'CatalogoEstadoDiente', 'CatalogoProcedimiento', 'OdontogramaVersion',
        'Fractura', 'Espigo', 'Erupcion', 'Extruida', 'Intrusion', 'Raiz',
        'Giroversion', 'Clavija', 'Geminacion', 'Supernumerario', 'Impactacion',
        'Endodoncia', 'CoronaTemporal', 'CoronaV', 'Restauracion', 'Fusion',
        'Edentulo', 'ProtesisV', 'ProtesisVTeeth', 'Implante', 'AparatoRemovible',
        'AparatoFijo', 'AparatoFijoDiente', 'ArcoOrtodoncia', 'Linea', 'Flecha',
        'SimboloClinico', 'Anotacion', 'OdontogramaVersionAudit', 'OdontogramaVersionSnapshot'
    );
    
    PRINT '';
    PRINT 'FKs restantes que referencian estas tablas:';
    
    SELECT 
        OBJECT_SCHEMA_NAME(f.parent_object_id) + '.' + OBJECT_NAME(f.parent_object_id) AS TablaOrigen,
        f.name AS NombreFK,
        OBJECT_SCHEMA_NAME(f.referenced_object_id) + '.' + OBJECT_NAME(f.referenced_object_id) AS TablaReferenciada
    FROM sys.foreign_keys f
    WHERE OBJECT_NAME(f.referenced_object_id) IN (
        'Odontograma', 'OdontogramaVersion'
    );
END

PRINT '========================================';
PRINT 'Proceso completado.';
PRINT '========================================';
GO