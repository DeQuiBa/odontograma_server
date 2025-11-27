// Clean, single-file Express server for Odontograma persistence
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// DB config via env with sensible defaults for local dev
const dbConfig = {
  user: process.env.DB_USER || 'johann',
  password: process.env.DB_PASS || '1234',
  server: process.env.DB_SERVER || '192.168.80.11',
  database: process.env.DB_NAME || 'SIGH',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let pool;
async function initDb() {
  if (pool) return pool;
  pool = await sql.connect(dbConfig);
  await ensureHistoriaSchema();
  await ensureObservacionesSchema();
  await ensureRaizSchema();
  await ensureCodigoFkDisabled();
  return pool;
}

// Optional patients table name (if available)
const PATIENTS_TABLE = process.env.PATIENTS_TABLE || null;

// Helper: obtener Nro_Historia desde Odontograma.Id
async function getNroCuentaByOdontograma(odontogramaId) {
  if (!pool) await initDb();
  const r = pool.request();
  r.input('id', sql.Int, odontogramaId);
  const rs = await r.query(`SELECT TOP 1 Nro_Historia FROM dbo.Odontograma WHERE Id = @id`);
  return rs.recordset && rs.recordset[0] ? rs.recordset[0].Nro_Historia : null;
}

// Helper: write audit rows (best-effort)
async function logAudit({ odontogramaId = null, nroCuenta = null, accion = '', detalle = null, usuario = null }) {
  try {
    if (!pool) return;
    const r = pool.request();
    r.input('OdontogramaId', sql.Int, odontogramaId);
    r.input('Nro_Historia', sql.NVarChar(50), nroCuenta);
    r.input('Accion', sql.NVarChar(50), accion);
    r.input('Detalle', sql.NVarChar(sql.MAX), detalle);
    r.input('Usuario', sql.NVarChar(100), usuario);
    await r.query(`INSERT INTO dbo.OdontogramaAudit (OdontogramaId, Nro_Historia, Accion, Detalle, Usuario) VALUES (@OdontogramaId, @Nro_Historia, @Accion, @Detalle, @Usuario)`);
  } catch (err) {
    console.error('logAudit error', err);
  }
}

// Startup guard: disable FK from DienteCodigo to CatalogoProcedimiento to allow external code sources
async function ensureCodigoFkDisabled() {
  try {
    if (!pool) return;
    const rs = await pool.request().query(`SELECT name FROM sys.foreign_keys WHERE name = 'FK_DienteCodigo_Procedimiento' AND parent_object_id = OBJECT_ID('dbo.DienteCodigo')`);
    const exists = rs.recordset && rs.recordset.length > 0;
    if (exists) {
      await pool.request().query(`ALTER TABLE dbo.DienteCodigo DROP CONSTRAINT FK_DienteCodigo_Procedimiento`);
      console.log('🔧 FK_DienteCodigo_Procedimiento eliminado (liberado para fuentes externas)');
    }
  } catch (err) {
    console.error('⚠️ No se pudo eliminar FK_DienteCodigo_Procedimiento', err);
  }
}

// Helper: audit for versioned operations (best-effort)
async function logVersionAudit({ versionId = null, entidad = '', accion = '', clave = null, detalle = null, usuario = null }) {
  try {
    if (!pool) return;
    const r = pool.request();
    r.input('OdontogramaVersionId', sql.Int, versionId);
    r.input('Entidad', sql.NVarChar(50), entidad);
    r.input('Accion', sql.NVarChar(30), accion);
    r.input('Clave', sql.NVarChar(200), clave || null);
    r.input('Detalle', sql.NVarChar(sql.MAX), detalle || null);
    r.input('Usuario', sql.NVarChar(100), usuario || null);
    await r.query(`INSERT INTO dbo.OdontogramaVersionAudit (OdontogramaVersionId, Entidad, Accion, Clave, Detalle, Usuario) VALUES (@OdontogramaVersionId, @Entidad, @Accion, @Clave, @Detalle, @Usuario)`);
  } catch (err) {
    // swallow
  }
}

// Startup schema migration: mover de Nro_Cuenta a Nro_Historia (nullable) en tablas base
async function ensureHistoriaSchema() {
  try {
    if (!pool) return;
    const tables = ['Odontograma','Diente','DienteArea','DienteCodigo','Transposicion','Protesis','Diastema','OdontogramaAudit'];
    for (const t of tables) {
      const hasHist = await pool.request().query(`SELECT COL_LENGTH('dbo.${t}','Nro_Historia') AS L`);
      const L = hasHist.recordset && hasHist.recordset[0] ? hasHist.recordset[0].L : null;
      if (!L) {
        await pool.request().query(`ALTER TABLE dbo.${t} ADD Nro_Historia NVARCHAR(50) NULL`);
      }
      const hasCuenta = await pool.request().query(`SELECT COL_LENGTH('dbo.${t}','Nro_Cuenta') AS L`);
      const LC = hasCuenta.recordset && hasCuenta.recordset[0] ? hasCuenta.recordset[0].L : null;
      if (LC) {
        try { await pool.request().query(`ALTER TABLE dbo.${t} ALTER COLUMN Nro_Cuenta INT NULL`); } catch (_) {}
      }
      const idxName = `IX_${t}_Nro_Historia`;
      const idxExists = await pool.request().query(`SELECT 1 AS X FROM sys.indexes WHERE name='${idxName}' AND object_id=OBJECT_ID('dbo.${t}')`);
      if (!idxExists.recordset || idxExists.recordset.length === 0) {
        try { await pool.request().query(`CREATE NONCLUSTERED INDEX ${idxName} ON dbo.${t}(Nro_Historia)`); } catch (_) {}
      }
    }
    console.log('✅ Esquema migrado a Nro_Historia (columns/index)');
  } catch (err) {
    console.error('⚠️ ensureHistoriaSchema error', err);
  }
}

// Startup schema guard: ensure columns for dbo.Raiz exist (in case script not re-applied)
async function ensureRaizSchema() {
  try {
    if (!pool) return;
    const r = pool.request();
    const exists = await r.query("SELECT OBJECT_ID('dbo.Raiz') AS Obj");
    const objId = exists.recordset && exists.recordset[0] ? exists.recordset[0].Obj : null;
    if (!objId) {
      // Table missing entirely: create minimal structure
      await pool.request().query(`CREATE TABLE dbo.Raiz (
        Id INT IDENTITY PRIMARY KEY,
        OdontogramaVersionId INT NOT NULL,
        NumeroDiente TINYINT NOT NULL,
        Configuracion TINYINT NOT NULL DEFAULT(1),
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
      );`);
      await pool.request().query("CREATE INDEX IX_Raiz_Version ON dbo.Raiz(OdontogramaVersionId)");
      console.log('✅ Tabla dbo.Raiz creada');
      return;
    }
    // Check each column
    const colsRs = await pool.request().query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Raiz')");
    const have = new Set((colsRs.recordset || []).map(c => c.name));
    const alters = [];
    if (!have.has('Configuracion')) alters.push("ALTER TABLE dbo.Raiz ADD Configuracion TINYINT NOT NULL DEFAULT(1)");
    if (!have.has('Triangulo1Activo')) alters.push("ALTER TABLE dbo.Raiz ADD Triangulo1Activo BIT NOT NULL DEFAULT(0)");
    if (!have.has('Triangulo2Activo')) alters.push("ALTER TABLE dbo.Raiz ADD Triangulo2Activo BIT NOT NULL DEFAULT(0)");
    if (!have.has('Triangulo3Activo')) alters.push("ALTER TABLE dbo.Raiz ADD Triangulo3Activo BIT NOT NULL DEFAULT(0)");
    if (!have.has('Activo')) alters.push("ALTER TABLE dbo.Raiz ADD Activo BIT NOT NULL DEFAULT(1)");
    if (!have.has('Metadata')) alters.push("ALTER TABLE dbo.Raiz ADD Metadata NVARCHAR(MAX) NULL");
    if (!have.has('Fecha_Creacion')) alters.push("ALTER TABLE dbo.Raiz ADD Fecha_Creacion DATETIME2 NOT NULL DEFAULT(GETDATE())");
    if (!have.has('Usuario_Creacion')) alters.push("ALTER TABLE dbo.Raiz ADD Usuario_Creacion NVARCHAR(100) NULL");
    if (!have.has('Fecha_Modificacion')) alters.push("ALTER TABLE dbo.Raiz ADD Fecha_Modificacion DATETIME2 NULL");
    if (!have.has('Usuario_Modificacion')) alters.push("ALTER TABLE dbo.Raiz ADD Usuario_Modificacion NVARCHAR(100) NULL");
    for (const stmt of alters) {
      await pool.request().query(stmt);
    }
    if (alters.length) console.log(`🔧 dbo.Raiz columnas agregadas: ${alters.length}`);
  } catch (err) {
    console.error('⚠️ Error asegurando esquema dbo.Raiz', err);
  }
}

// Startup schema guard: ensure Observaciones column exists where API writes it
async function ensureObservacionesSchema() {
  try {
    if (!pool) return;
    const targets = [
      { table: 'Odontograma', type: 'NVARCHAR(MAX)' },
      { table: 'DienteArea', type: 'NVARCHAR(500)' },
      { table: 'Protesis', type: 'NVARCHAR(500)' },
      { table: 'Diastema', type: 'NVARCHAR(500)' }
    ];
    for (const t of targets) {
      const rs = await pool.request().query(`SELECT COL_LENGTH('dbo.${t.table}','Observaciones') AS L`);
      const L = rs.recordset && rs.recordset[0] ? rs.recordset[0].L : null;
      if (!L) {
        await pool.request().query(`ALTER TABLE dbo.${t.table} ADD Observaciones ${t.type} NULL`);
        console.log(`🔧 dbo.${t.table}.Observaciones agregado`);
      }
    }
  } catch (err) {
    console.error('⚠️ ensureObservacionesSchema error', err);
  }
}

// --- Endpoints ---
// Middleware: auto-resolver nro_cuenta para POST bajo /api/odontograma/:id/* si falta
app.use('/api/odontograma/:id', async (req, res, next) => {
  try {
    if (req.method === 'POST' && (req.body?.nroHistoria === undefined || req.body?.nroHistoria === null)) {
      const odontogramaId = parseInt(req.params.id, 10);
      if (odontogramaId) {
        const nro = await getNroCuentaByOdontograma(odontogramaId);
        if (nro !== null && nro !== undefined) {
          req.body = { ...(req.body || {}), nroHistoria: nro };
        }
      }
    }
  } catch (err) {
    // continuar sin bloquear en caso de error; endpoints podrán manejarlo
  }
  next();
});



// =============================================
// NUEVO: Búsqueda por Número de Historia Clínica
// =============================================
// Devuelve datos del paciente + conteo y últimos IDs de odontogramas/versiones ligados a su historia
app.get('/api/historia/:nroHistoria/existe', async (req, res) => {
  try {
    await initDb();
    const nroHistoria = req.params.nroHistoria && req.params.nroHistoria.trim();
    if (!nroHistoria) return res.status(400).json({ error: 'nroHistoria requerido' });

    // Buscar paciente por NroHistoriaClinica
    const r = pool.request();
    // Usar NVarChar para evitar error TDS con longitud/metadata
    r.input('hist', sql.NVarChar(50), nroHistoria);
    const pacienteRs = await r.query(`
      SELECT TOP 1 
        p.NroHistoriaClinica,
        p.NroDocumento,
        LTRIM(RTRIM(CONCAT(ISNULL(p.ApellidoPaterno,''),' ',ISNULL(p.ApellidoMaterno,''),' ',ISNULL(p.PrimerNombre,''),' ',ISNULL(p.SegundoNombre,'')))) AS NombresPaciente,
        p.IdPaciente
      FROM dbo.Pacientes p
      WHERE p.NroHistoriaClinica = @hist
    `);
    const paciente = pacienteRs.recordset && pacienteRs.recordset[0] ? pacienteRs.recordset[0] : null;
    const exists = !!paciente;
    if (!exists) return res.json({ exists: false, source: 'HistoriaClinica', paciente: null, odontogramasCount: 0 });

    // Obtener lista de odontogramas asociados a esa historia clínica.
    // Un odontograma puede haberse creado con Nro_Cuenta = IdAtencion (Atenciones.IdAtencion)
    // o Nro_Cuenta = IdPaciente. Cubrimos ambos casos.
    const listRs = await pool.request()
      .input('hist', sql.NVarChar(50), nroHistoria)
      .query(`
        SELECT o.Id, o.Nro_Historia, o.Activo, o.Fecha_Creacion
        FROM dbo.Odontograma o
        WHERE o.Nro_Historia = @hist
        ORDER BY o.Fecha_Creacion DESC, o.Id DESC
      `);
    const odontogramas = listRs.recordset || [];
    const odontogramasCount = odontogramas.length;

    let latestOdontogramaId = null;
    let latestVersionId = null;
    if (odontogramasCount > 0) {
      latestOdontogramaId = odontogramas[0].Id;
      const vRs = await pool.request()
        .input('odId', sql.Int, latestOdontogramaId)
        .query(`SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odId ORDER BY VersionNumber DESC, Id DESC`);
      latestVersionId = vRs.recordset && vRs.recordset[0] ? vRs.recordset[0].Id : null;
    }

    return res.json({
      exists,
      source: 'HistoriaClinica',
      paciente: {
        nroHistoriaClinica: paciente.NroHistoriaClinica,
        nroDocumento: paciente.NroDocumento,
        nombresPaciente: paciente.NombresPaciente,
        idPaciente: paciente.IdPaciente
      },
      odontogramasCount,
      latestOdontogramaId,
      latestVersionId,
      odontogramas
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error verificando nroHistoriaClinica' });
  }
});

// Listado compacto de odontogramas por historia clínica
app.get('/api/historia/:nroHistoria/odontogramas', async (req, res) => {
  try {
    await initDb();
    const nroHistoria = req.params.nroHistoria && req.params.nroHistoria.trim();
    if (!nroHistoria) return res.status(400).json({ error: 'nroHistoria requerido' });
    const rs = await pool.request()
      .input('hist', sql.NVarChar(50), nroHistoria)
      .query(`
        SELECT o.Id, o.Nro_Historia, o.Fecha_Creacion, o.Activo
        FROM dbo.Odontograma o
        WHERE o.Nro_Historia = @hist
        ORDER BY o.Fecha_Creacion DESC, o.Id DESC
      `);
    res.json(rs.recordset || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando odontogramas por historia clínica' });
  }
});

// List odontogramas by patient account (Nro_Cuenta)
app.get('/api/odontogramas/:nroCuenta', async (req, res) => {
  try {
    await initDb();
    const nroHistoria = (req.params.nroCuenta || '').toString();
    const r = pool.request();
    r.input('nroHistoria', sql.NVarChar(50), nroHistoria);
    const result = await r.query(`SELECT Id, Nro_Historia, Version, Observaciones, Fecha_Creacion, Usuario_Creacion FROM dbo.Odontograma WHERE Nro_Historia = @nroHistoria ORDER BY Fecha_Creacion DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo odontogramas' });
  }
});

// Create odontograma (auto crea versión inicial 1)
app.post('/api/odontograma', async (req, res) => {
  try {
    await initDb();
    const { nroHistoria, nroCuenta, fechaVisita, tipoVisita, observaciones, usuario, metadata = null } = req.body;
    const historia = nroHistoria ?? (nroCuenta ? String(nroCuenta) : null);
    if (!historia) return res.status(400).json({ error: 'nroHistoria requerido' });
    const tr = new sql.Transaction(pool);
    await tr.begin();
    try {
      const r = tr.request();
      r.input('Nro_Historia', sql.NVarChar(50), historia);
      r.input('Fecha_Visita', sql.DateTime2, fechaVisita || null);
      r.input('Tipo_Visita', sql.NVarChar(50), tipoVisita || null);
      r.input('Observaciones', sql.NVarChar(sql.MAX), observaciones || null);
      r.input('Usuario', sql.NVarChar(100), usuario || null);
      r.input('Meta', sql.NVarChar(sql.MAX), metadata);
      const insert = await r.query(`INSERT INTO dbo.Odontograma (Nro_Historia, Fecha_Visita, Tipo_Visita, Observaciones, Usuario_Creacion, Metadata) VALUES (@Nro_Historia, @Fecha_Visita, @Tipo_Visita, @Observaciones, @Usuario, @Meta); SELECT SCOPE_IDENTITY() AS Id;`);
      const id = insert.recordset && insert.recordset[0] ? insert.recordset[0].Id : null;
      // Crear versión inicial 1 sólo si no existe
      if (id) {
        const rv = tr.request();
        rv.input('oId', sql.Int, id);
        rv.input('usuario', sql.NVarChar(100), usuario || null);
        const exists = await rv.query(`SELECT TOP 1 1 AS Has FROM dbo.OdontogramaVersion WHERE OdontogramaId=@oId AND VersionNumber=1`);
        if (!exists.recordset || exists.recordset.length === 0) {
          await rv.query(`INSERT INTO dbo.OdontogramaVersion (OdontogramaId, VersionNumber, Usuario_Creacion) VALUES (@oId, 1, @usuario);`);
        }
      }
      await tr.commit();
      // Obtener Id de versión 1
      let versionId = null;
      if (id) {
        const r2 = pool.request();
        r2.input('oId', sql.Int, id);
        const v1 = await r2.query(`SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE OdontogramaId=@oId AND VersionNumber=1 ORDER BY Id`);
        versionId = v1.recordset && v1.recordset[0] ? v1.recordset[0].Id : null;
      }
      res.status(201).json({ id, versionId });
    } catch (e) {
      try { await tr.rollback(); } catch(_) {}
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error creating odontograma' });
  }
});

// Get full odontograma payload (for UI rehydration)
app.get('/api/odontograma/:id/full', async (req, res) => {
  try {
    await initDb();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const reqO = pool.request();
    reqO.input('id', sql.Int, id);
    const [odontogramaResult, dientesResult, areasResult, codesResult, protesisResult, transResult, diastemaResult, auditResult] = await Promise.all([
      reqO.query(`SELECT * FROM dbo.Odontograma WHERE Id = @id`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.Diente WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.DienteArea WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.DienteCodigo WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT p.*, pt.NumeroDiente FROM dbo.Protesis p LEFT JOIN dbo.ProtesisTeeth pt ON p.Id = pt.ProtesisId WHERE p.OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.Transposicion WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.Diastema WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.OdontogramaAudit WHERE OdontogramaId = @odontogramaId ORDER BY Fecha DESC`)
    ]);

    if (!odontogramaResult.recordset || odontogramaResult.recordset.length === 0) return res.status(404).json({ error: 'Odontograma no encontrado' });
    const odontograma = odontogramaResult.recordset[0];
    odontograma.dientes = dientesResult.recordset || [];
    odontograma.areas = areasResult.recordset || [];
    odontograma.codigos = codesResult.recordset || [];
    const protesisRows = protesisResult.recordset || [];
    const protesisMap = {};
    for (const row of protesisRows) {
      if (!protesisMap[row.Id]) protesisMap[row.Id] = { ...row, dientes: [] };
      if (row.NumeroDiente) protesisMap[row.Id].dientes.push(row.NumeroDiente);
    }
    odontograma.protesis = Object.values(protesisMap);
    odontograma.transposiciones = transResult.recordset || [];
    odontograma.diastemas = diastemaResult.recordset || [];
    odontograma.audit = auditResult.recordset || [];
    // Elementos versionados (edentulos, restauraciones, fracturas, etc.) ahora sólo vía /api/version/:versionId/full
    res.json(odontograma);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo odontograma completo' });
  }
});

// ==========================
// Odontograma Versions
// ==========================

// Create a new version for an odontograma (auto-increment VersionNumber)
app.post('/api/odontograma/:id/version', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { usuario, parentVersionId = null, metadata = null } = req.body || {};
    if (!odontogramaId) return res.status(400).json({ error: 'invalid odontograma id' });
    const tr = new sql.Transaction(pool);
    await tr.begin();
    try {
      const r = tr.request();
      r.input('oId', sql.Int, odontogramaId);
      r.input('usuario', sql.NVarChar(100), usuario || null);
      r.input('parentId', sql.Int, parentVersionId || null);
      r.input('metadata', sql.NVarChar(sql.MAX), metadata || null);
      const sel = await r.query(`SELECT ISNULL(MAX(VersionNumber), 0) AS MaxV FROM dbo.OdontogramaVersion WHERE OdontogramaId = @oId`);
      const nextV = (sel.recordset && sel.recordset[0] ? sel.recordset[0].MaxV : 0) + 1;
      const ins = await r.query(`INSERT INTO dbo.OdontogramaVersion (OdontogramaId, VersionNumber, Usuario_Creacion, ParentVersionId, Metadata) VALUES (@oId, ${nextV}, @usuario, @parentId, @metadata); SELECT SCOPE_IDENTITY() AS Id;`);
      const versionId = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
      await tr.commit();
      res.status(201).json({ id: versionId, versionNumber: nextV });
    } catch (e) {
      try { await tr.rollback(); } catch (_) {}
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando version' });
  }
});

// List versions for an odontograma
app.get('/api/odontograma/:id/versions', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('oId', sql.Int, odontogramaId);
    const rs = await r.query(`SELECT Id, OdontogramaId, VersionNumber, Fecha_Creacion, Usuario_Creacion, ParentVersionId, Locked, Metadata FROM dbo.OdontogramaVersion WHERE OdontogramaId = @oId ORDER BY VersionNumber DESC`);
    res.json(rs.recordset || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando versiones' });
  }
});

// Get a full version snapshot
app.get('/api/version/:versionId/full', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    if (!versionId) return res.status(400).json({ error: 'invalid version id' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);

    const [versionRow, fracturas, espigos, erupciones, extruidas, intrusiones, giroversiones, clavijas, geminaciones, supernumerarios, impactaciones, endodoncias, coronasTemp, coronas, restauraciones, fusiones, edentulos, protesisJoin, implantes, aparatosJoin, aparatosRemovibles, arcos, lineas, flechas, simbolos, anotaciones, audits, raices] = await Promise.all([
      r.query(`SELECT TOP 1 * FROM dbo.OdontogramaVersion WHERE Id = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Fractura WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Espigo WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Erupcion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Extruida WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Intrusion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Giroversion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Clavija WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Geminacion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Supernumerario WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Impactacion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Endodoncia WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.CoronaTemporal WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.CoronaV WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Restauracion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Fusion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Edentulo WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT p.*, t.NumeroDiente, t.Rol FROM dbo.ProtesisV p LEFT JOIN dbo.ProtesisVTeeth t ON p.Id = t.ProtesisVId WHERE p.OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Implante WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT a.*, d.NumeroDiente, d.Elemento FROM dbo.AparatoFijo a LEFT JOIN dbo.AparatoFijoDiente d ON a.Id = d.AparatoFijoId WHERE a.OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.AparatoRemovible WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.ArcoOrtodoncia WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Linea WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Flecha WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.SimboloClinico WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Anotacion WHERE OdontogramaVersionId = @vid`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.OdontogramaVersionAudit WHERE OdontogramaVersionId = @vid ORDER BY Fecha DESC`),
      pool.request().input('vid', sql.Int, versionId).query(`SELECT * FROM dbo.Raiz WHERE OdontogramaVersionId = @vid`)
    ]);

    if (!versionRow.recordset || versionRow.recordset.length === 0) return res.status(404).json({ error: 'Version no encontrada' });
    const version = versionRow.recordset[0];

    // group prosthesis
    const pMap = {};
    for (const row of (protesisJoin.recordset || [])) {
      if (!pMap[row.Id]) pMap[row.Id] = { ...row, dientes: [] };
      if (row.NumeroDiente != null) pMap[row.Id].dientes.push({ numero: row.NumeroDiente, rol: row.Rol || null });
      delete pMap[row.Id].NumeroDiente; delete pMap[row.Id].Rol;
    }

    // group aparato fijo
    const aMap = {};
    for (const row of (aparatosJoin.recordset || [])) {
      if (!aMap[row.Id]) aMap[row.Id] = { ...row, dientes: [] };
      if (row.NumeroDiente != null) aMap[row.Id].dientes.push({ numero: row.NumeroDiente, elemento: row.Elemento });
      delete aMap[row.Id].NumeroDiente; delete aMap[row.Id].Elemento;
    }

    res.json({
      version,
      fracturas: fracturas.recordset || [],
      espigos: espigos.recordset || [],
      erupciones: erupciones.recordset || [],
      extruidas: extruidas.recordset || [],
      intrusiones: intrusiones.recordset || [],
      giroversiones: giroversiones.recordset || [],
      clavijas: clavijas.recordset || [],
      geminaciones: geminaciones.recordset || [],
      supernumerarios: supernumerarios.recordset || [],
      impactaciones: impactaciones.recordset || [],
      endodoncias: endodoncias.recordset || [],
      coronasTemporales: coronasTemp.recordset || [],
      coronas: coronas.recordset || [],
      restauraciones: restauraciones.recordset || [],
      fusiones: fusiones.recordset || [],
      edentulos: edentulos.recordset || [],
      protesis: Object.values(pMap),
      implantes: implantes.recordset || [],
      aparatosFijos: Object.values(aMap),
      aparatosRemovibles: aparatosRemovibles.recordset || [],
      arcos: arcos.recordset || [],
      lineas: lineas.recordset || [],
      flechas: flechas.recordset || [],
      simbolos: simbolos.recordset || [],
      anotaciones: anotaciones.recordset || [],
      audit: audits.recordset || [],
      raices: raices.recordset || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo version completa' });
  }
});

// ==========================
// Version Snapshot (JSON completo)
// ==========================
// POST /api/version/:versionId/snapshot  { data: { ...estadoUI }, usuario }
app.post('/api/version/:versionId/snapshot', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { data, usuario = null, metadata = null } = req.body || {};
    if (!versionId || data === undefined) return res.status(400).json({ error: 'versionId y data requeridos' });
    const vr = pool.request();
    vr.input('vid', sql.Int, versionId);
    const vexists = await vr.query(`SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE Id = @vid`);
    if (!vexists.recordset || vexists.recordset.length === 0) return res.status(404).json({ error: 'Version no existe' });
    const jsonData = (typeof data === 'string') ? data : JSON.stringify(data);
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('data', sql.NVarChar(sql.MAX), jsonData);
    r.input('usuario', sql.NVarChar(100), usuario);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    // Upsert único por versión
    const upsertSql = `IF EXISTS(SELECT 1 FROM dbo.OdontogramaVersionSnapshot WHERE OdontogramaVersionId=@vid)
      BEGIN
        UPDATE dbo.OdontogramaVersionSnapshot SET Data=@data, Fecha_Modificacion=GETDATE(), Usuario_Modificacion=@usuario, Metadata=@metadata WHERE OdontogramaVersionId=@vid;
        SELECT OdontogramaVersionId AS OdontogramaVersionId FROM dbo.OdontogramaVersionSnapshot WHERE OdontogramaVersionId=@vid;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.OdontogramaVersionSnapshot (OdontogramaVersionId, Data, Usuario_Creacion, Metadata) VALUES (@vid, @data, @usuario, @metadata);
        SELECT OdontogramaVersionId AS OdontogramaVersionId FROM dbo.OdontogramaVersionSnapshot WHERE OdontogramaVersionId=@vid;
      END`;
    const rs = await r.query(upsertSql);
    await logVersionAudit({ versionId, entidad: 'VersionSnapshot', accion: 'UPSERT', clave: `VersionId=${versionId}`, detalle: `Bytes=${jsonData.length}` , usuario});
    res.status(201).json({ ok: true, versionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando snapshot' });
  }
});

// GET /api/version/:versionId/snapshot -> { versionId, data }
app.get('/api/version/:versionId/snapshot', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    if (!versionId) return res.status(400).json({ error: 'versionId requerido' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    const rs = await r.query(`SELECT TOP 1 Data, Fecha_Creacion, Fecha_Modificacion, Usuario_Creacion, Usuario_Modificacion, Metadata FROM dbo.OdontogramaVersionSnapshot WHERE OdontogramaVersionId=@vid`);
    if (!rs.recordset || rs.recordset.length === 0) return res.status(404).json({ error: 'Snapshot no encontrado' });
    let parsed = null;
    const raw = rs.recordset[0].Data;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    res.json({ versionId, data: parsed, raw, meta: rs.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo snapshot' });
  }
});

// ==========================
// Base Diastema (OdontogramaId)
// ==========================

app.post('/api/odontograma/:id/diastema', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { nroHistoria, diente_left, diente_right, tamano = null, observaciones = null, usuario = null } = req.body || {};
    if (!odontogramaId || !diente_left || !diente_right) return res.status(400).json({ error: 'missing fields' });
    const historia = nroHistoria || await getNroCuentaByOdontograma(odontogramaId);
    const r = pool.request();
    r.input('OdontogramaId', sql.Int, odontogramaId);
    r.input('Nro_Historia', sql.NVarChar(50), historia || null);
    r.input('Left', sql.TinyInt, diente_left);
    r.input('Right', sql.TinyInt, diente_right);
    r.input('Tam', sql.Decimal(6,2), tamano);
    r.input('Obs', sql.NVarChar(500), observaciones);
    r.input('Usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Diastema (OdontogramaId, Nro_Historia, Diente_Left, Diente_Right, Tamano, Observaciones, Usuario_Creacion) VALUES (@OdontogramaId, @Nro_Historia, @Left, @Right, @Tam, @Obs, @Usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logAudit({ odontogramaId, nroCuenta: historia, accion: 'INSERT_DIASTEMA', detalle: `L=${diente_left};R=${diente_right};Tam=${tamano}`, usuario });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando diastema' });
  }
});

app.get('/api/odontograma/:id/diastemas', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('oId', sql.Int, odontogramaId);
    const rs = await r.query(`SELECT * FROM dbo.Diastema WHERE OdontogramaId = @oId`);
    res.json(rs.recordset || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando diastemas' });
  }
});

app.delete('/api/odontograma/:id/diastema/:diastemaId', async (req, res) => {
  try {
    await initDb();
    const diastemaId = parseInt(req.params.diastemaId, 10);
    const r = pool.request();
    r.input('id', sql.Int, diastemaId);
    await r.query(`DELETE FROM dbo.Diastema WHERE Id = @id`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando diastema' });
  }
});

// ==========================
// Base Protesis (OdontogramaId)
// ==========================

app.post('/api/odontograma/:id/protesis', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { nroHistoria, tipo, subTipo = null, posicion = null, color = null, observaciones = null, metadata = null, usuario = null, dientes = [] } = req.body || {};
    if (!odontogramaId || !tipo) return res.status(400).json({ error: 'missing fields' });
    const historia = nroHistoria || await getNroCuentaByOdontograma(odontogramaId);
    const tr = new sql.Transaction(pool);
    await tr.begin();
    try {
      const r = tr.request();
      r.input('OdontogramaId', sql.Int, odontogramaId);
      r.input('Nro_Historia', sql.NVarChar(50), historia || null);
      r.input('Tipo', sql.NVarChar(50), tipo);
      r.input('SubTipo', sql.NVarChar(100), subTipo);
      r.input('Posicion', sql.NVarChar(20), posicion);
      r.input('Color', sql.NVarChar(30), color);
      r.input('Obs', sql.NVarChar(500), observaciones);
      r.input('Meta', sql.NVarChar(sql.MAX), metadata);
      r.input('Usuario', sql.NVarChar(100), usuario);
      const ins = await r.query(`INSERT INTO dbo.Protesis (OdontogramaId, Nro_Historia, Tipo, SubTipo, Posicion, Color, Observaciones, Metadata, Usuario_Creacion) VALUES (@OdontogramaId, @Nro_Historia, @Tipo, @SubTipo, @Posicion, @Color, @Obs, @Meta, @Usuario); SELECT SCOPE_IDENTITY() AS Id;`);
      const protesisId = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
      for (const d of (Array.isArray(dientes) ? dientes : [])) {
        const rr = tr.request();
        rr.input('pid', sql.Int, protesisId);
        rr.input('num', sql.TinyInt, d);
        await rr.query(`INSERT INTO dbo.ProtesisTeeth (ProtesisId, NumeroDiente) VALUES (@pid, @num)`);
      }
      await tr.commit();
      await logAudit({ odontogramaId, nroCuenta: historia, accion: 'INSERT_PROTESIS', detalle: `Tipo=${tipo};Dientes=${(dientes||[]).join(',')}`, usuario });
      res.status(201).json({ id: protesisId });
    } catch (e) {
      try { await tr.rollback(); } catch (_) {}
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando protesis' });
  }
});

app.delete('/api/odontograma/:id/protesis/:protesisId', async (req, res) => {
  try {
    await initDb();
    const protesisId = parseInt(req.params.protesisId, 10);
    const r = pool.request();
    r.input('id', sql.Int, protesisId);
    await r.query(`DELETE FROM dbo.Protesis WHERE Id = @id`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando protesis' });
  }
});

// ==========================
// Versioned element endpoints (create/delete)
// ==========================

function required(body, fields) {
  for (const f of fields) if (body[f] === undefined || body[f] === null) return false;
  return true;
}

// Helper factory for simple per-tooth inserts
function makePerToothPost(path, table, extraCols = []) {
  app.post(`/api/version/:versionId/${path}`, async (req, res) => {
    try {
      await initDb();
      const versionId = parseInt(req.params.versionId, 10);
      const { numeroDiente, usuario = null } = req.body || {};
      if (!versionId || !numeroDiente) return res.status(400).json({ error: 'missing fields' });
      const r = pool.request();
      r.input('vid', sql.Int, versionId);
      r.input('num', sql.TinyInt, numeroDiente);
      r.input('usuario', sql.NVarChar(100), usuario);
      const cols = ['OdontogramaVersionId', 'NumeroDiente'];
      const vals = ['@vid', '@num'];
      for (const c of extraCols) {
        r.input(c.name, c.type, req.body[c.body] !== undefined ? req.body[c.body] : null);
        cols.push(c.col);
        vals.push(`@${c.name}`);
      }
      const sqlText = `INSERT INTO dbo.${table} (${cols.join(',')}) VALUES (${vals.join(',')}); SELECT SCOPE_IDENTITY() AS Id;`;
      const ins = await r.query(sqlText);
      const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
      await logVersionAudit({ versionId, entidad: table, accion: 'INSERT', clave: `Id=${id}`, detalle: `Diente=${numeroDiente}`, usuario });
      res.status(201).json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: `Error creando ${table}` });
    }
  });

  app.delete(`/api/version/:versionId/${path}/:id`, async (req, res) => {
    try {
      await initDb();
      const versionId = parseInt(req.params.versionId, 10);
      const id = parseInt(req.params.id, 10);
      const r = pool.request();
      r.input('id', sql.Int, id);
      await r.query(`DELETE FROM dbo.${table} WHERE Id = @id`);
      await logVersionAudit({ versionId, entidad: table, accion: 'DELETE', clave: `Id=${id}` });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: `Error eliminando ${table}` });
    }
  });
}

// Register per-tooth:
makePerToothPost('fractura', 'Fractura', [
  { name: 'tipo', col: 'Tipo', body: 'tipo', type: sql.NVarChar(50) },
  { name: 'severidad', col: 'Severidad', body: 'severidad', type: sql.NVarChar(30) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) },
  { name: 'metadata', col: 'Metadata', body: 'metadata', type: sql.NVarChar(sql.MAX) }
]);
makePerToothPost('espigo', 'Espigo', [
  { name: 'tipo', col: 'Tipo', body: 'tipo', type: sql.NVarChar(30) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) },
  { name: 'metadata', col: 'Metadata', body: 'metadata', type: sql.NVarChar(sql.MAX) }
]);
makePerToothPost('erupcion', 'Erupcion', [
  { name: 'progreso', col: 'ProgresoPct', body: 'progresoPct', type: sql.Decimal(5,2) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) },
  { name: 'metadata', col: 'Metadata', body: 'metadata', type: sql.NVarChar(sql.MAX) }
]);
makePerToothPost('extruida', 'Extruida', [
  { name: 'magnitud', col: 'MagnitudMM', body: 'magnitudMM', type: sql.Decimal(5,2) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('intrusion', 'Intrusion', [
  { name: 'magnitud', col: 'MagnitudMM', body: 'magnitudMM', type: sql.Decimal(5,2) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('giroversion', 'Giroversion', [
  { name: 'direccion', col: 'Direccion', body: 'direccion', type: sql.NVarChar(10) },
  { name: 'grados', col: 'Grados', body: 'grados', type: sql.Int },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('clavija', 'Clavija', [
  { name: 'posicion', col: 'Posicion', body: 'posicion', type: sql.NVarChar(10) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('geminacion', 'Geminacion', [
  { name: 'tipo', col: 'Tipo', body: 'tipo', type: sql.NVarChar(30) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('impactacion', 'Impactacion', [
  { name: 'tipo', col: 'Tipo', body: 'tipo', type: sql.NVarChar(30) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('endodoncia', 'Endodoncia', [
  { name: 'conductos', col: 'Conductos', body: 'conductos', type: sql.Int },
  { name: 'estado', col: 'Estado', body: 'estado', type: sql.NVarChar(50) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('corona-temporal', 'CoronaTemporal', [
  { name: 'material', col: 'Material', body: 'material', type: sql.NVarChar(50) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('restauracion', 'Restauracion', [
  { name: 'tipo', col: 'Tipo', body: 'tipo', type: sql.NVarChar(50) },
  { name: 'material', col: 'Material', body: 'material', type: sql.NVarChar(50) },
  { name: 'areas', col: 'Areas', body: 'areas', type: sql.NVarChar(200) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);
makePerToothPost('corona', 'CoronaV', [
  { name: 'tipoCodigo', col: 'TipoCodigo', body: 'tipoCodigo', type: sql.NVarChar(50) },
  { name: 'material', col: 'Material', body: 'material', type: sql.NVarChar(50) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);

// Dual-tooth/tramo helpers
app.post('/api/version/:versionId/fusion', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { dienteA, dienteB, tipo = null, color = null, usuario = null } = req.body || {};
    if (!versionId || !dienteA || !dienteB) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('a', sql.TinyInt, dienteA);
    r.input('b', sql.TinyInt, dienteB);
    r.input('tipo', sql.NVarChar(30), tipo);
    r.input('color', sql.NVarChar(30), color);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Fusion (OdontogramaVersionId, Diente_A, Diente_B, Tipo, Color, Usuario_Creacion) VALUES (@vid, @a, @b, @tipo, @color, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Fusion', accion: 'INSERT', clave: `Id=${id}`, detalle: `A=${dienteA};B=${dienteB}`, usuario });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando Fusion' });
  }
});

app.delete('/api/version/:versionId/fusion/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Fusion WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'Fusion', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando Fusion' });
  }
});

app.post('/api/version/:versionId/edentulo', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { dienteInicio, dienteFin, tipo = null, color = null, usuario = null } = req.body || {};
    if (!versionId || !dienteInicio || !dienteFin) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('ini', sql.TinyInt, dienteInicio);
    r.input('fin', sql.TinyInt, dienteFin);
    r.input('tipo', sql.NVarChar(30), tipo);
    r.input('color', sql.NVarChar(30), color);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Edentulo (OdontogramaVersionId, Diente_Inicio, Diente_Fin, Tipo, Color, Usuario_Creacion) VALUES (@vid, @ini, @fin, @tipo, @color, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Edentulo', accion: 'INSERT', clave: `Id=${id}`, detalle: `I=${dienteInicio};F=${dienteFin}`, usuario });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando Edentulo' });
  }
});

app.delete('/api/version/:versionId/edentulo/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Edentulo WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'Edentulo', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando Edentulo' });
  }
});

// Supernumerario (puede ser entre dientes)
app.post('/api/version/:versionId/supernumerario', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { dienteA, dienteB = null, color = null, usuario = null } = req.body || {};
    if (!versionId || !dienteA) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('a', sql.TinyInt, dienteA);
    r.input('b', sql.TinyInt, dienteB);
    r.input('color', sql.NVarChar(30), color);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Supernumerario (OdontogramaVersionId, Diente_A, Diente_B, Color, Usuario_Creacion) VALUES (@vid, @a, @b, @color, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Supernumerario', accion: 'INSERT', clave: `Id=${id}`, detalle: `A=${dienteA};B=${dienteB}` , usuario});
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando Supernumerario' });
  }
});

app.delete('/api/version/:versionId/supernumerario/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Supernumerario WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'Supernumerario', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando Supernumerario' });
  }
});

// ProtesisV with teeth
app.post('/api/version/:versionId/protesis', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { tipoCodigo, subTipo = null, materialCodigo = null, color = null, observaciones = null, metadata = null, usuario = null, dientes = [] } = req.body || {};
    if (!versionId || !tipoCodigo) return res.status(400).json({ error: 'missing fields' });
    const tr = new sql.Transaction(pool);
    await tr.begin();
    try {
      const r = tr.request();
      r.input('vid', sql.Int, versionId);
      r.input('tipo', sql.NVarChar(50), tipoCodigo);
      r.input('sub', sql.NVarChar(100), subTipo);
      r.input('mat', sql.NVarChar(50), materialCodigo);
      r.input('color', sql.NVarChar(30), color);
      r.input('obs', sql.NVarChar(500), observaciones);
      r.input('metadata', sql.NVarChar(sql.MAX), metadata);
      r.input('usuario', sql.NVarChar(100), usuario);
      const ins = await r.query(`INSERT INTO dbo.ProtesisV (OdontogramaVersionId, TipoCodigo, SubTipo, MaterialCodigo, Color, Observaciones, Metadata, Usuario_Creacion) VALUES (@vid, @tipo, @sub, @mat, @color, @obs, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
      const protesisId = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
      for (const t of (Array.isArray(dientes) ? dientes : [])) {
        const rr = tr.request();
        rr.input('pid', sql.Int, protesisId);
        rr.input('num', sql.TinyInt, t.numero);
        rr.input('rol', sql.NVarChar(30), t.rol || null);
        await rr.query(`INSERT INTO dbo.ProtesisVTeeth (ProtesisVId, NumeroDiente, Rol) VALUES (@pid, @num, @rol)`);
      }
      await tr.commit();
      await logVersionAudit({ versionId, entidad: 'ProtesisV', accion: 'INSERT', clave: `Id=${protesisId}`, detalle: `Tipo=${tipoCodigo}`, usuario });
      res.status(201).json({ id: protesisId });
    } catch (e) {
      try { await tr.rollback(); } catch (_) {}
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando ProtesisV' });
  }
});

app.delete('/api/version/:versionId/protesis/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.ProtesisV WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'ProtesisV', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando ProtesisV' });
  }
});

// Implante
makePerToothPost('implante', 'Implante', [
  { name: 'diam', col: 'DiametroMM', body: 'diametroMM', type: sql.Decimal(4,2) },
  { name: 'long', col: 'LongitudMM', body: 'longitudMM', type: sql.Decimal(4,1) },
  { name: 'sistema', col: 'Sistema', body: 'sistema', type: sql.NVarChar(50) },
  { name: 'material', col: 'Material', body: 'material', type: sql.NVarChar(50) },
  { name: 'color', col: 'Color', body: 'color', type: sql.NVarChar(30) }
]);

// Aparatología fija + dientes
app.post('/api/version/:versionId/aparato-fijo', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { tipo, color = null, usuario = null, dientes = [], metadata = null } = req.body || {};
    if (!versionId || !tipo) return res.status(400).json({ error: 'missing fields' });
    const tr = new sql.Transaction(pool);
    await tr.begin();
    try {
      const r = tr.request();
      r.input('vid', sql.Int, versionId);
      r.input('tipo', sql.NVarChar(50), tipo);
      r.input('color', sql.NVarChar(30), color);
      r.input('metadata', sql.NVarChar(sql.MAX), metadata);
      r.input('usuario', sql.NVarChar(100), usuario);
      const ins = await r.query(`INSERT INTO dbo.AparatoFijo (OdontogramaVersionId, Tipo, Color, Metadata, Usuario_Creacion) VALUES (@vid, @tipo, @color, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
      const aparatoId = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
      for (const d of (Array.isArray(dientes) ? dientes : [])) {
        const rr = tr.request();
        rr.input('aid', sql.Int, aparatoId);
        rr.input('num', sql.TinyInt, d.numero);
        rr.input('elem', sql.NVarChar(30), d.elemento);
        await rr.query(`INSERT INTO dbo.AparatoFijoDiente (AparatoFijoId, NumeroDiente, Elemento) VALUES (@aid, @num, @elem)`);
      }
      await tr.commit();
      await logVersionAudit({ versionId, entidad: 'AparatoFijo', accion: 'INSERT', clave: `Id=${aparatoId}`, detalle: `Tipo=${tipo}`, usuario });
      res.status(201).json({ id: aparatoId });
    } catch (e) {
      try { await tr.rollback(); } catch (_) {}
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando AparatoFijo' });
  }
});

app.delete('/api/version/:versionId/aparato-fijo/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.AparatoFijo WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'AparatoFijo', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando AparatoFijo' });
  }
});

// Aparatología removible
app.post('/api/version/:versionId/aparato-removible', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { tipo, posicion = null, dienteInicio = null, dienteFin = null, color = null, usuario = null, metadata = null } = req.body || {};
    if (!versionId || !tipo) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('tipo', sql.NVarChar(50), tipo);
    r.input('posicion', sql.NVarChar(20), posicion);
    r.input('dienteInicio', sql.TinyInt, dienteInicio);
    r.input('dienteFin', sql.TinyInt, dienteFin);
    r.input('color', sql.NVarChar(30), color);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.AparatoRemovible (OdontogramaVersionId, Tipo, Posicion, DienteInicio, DienteFin, Color, Metadata, Usuario_Creacion) VALUES (@vid, @tipo, @posicion, @dienteInicio, @dienteFin, @color, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'AparatoRemovible', accion: 'INSERT', clave: `Id=${id}`, detalle: `Tipo=${tipo}`, usuario });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando AparatoRemovible' });
  }
});

app.delete('/api/version/:versionId/aparato-removible/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.AparatoRemovible WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'AparatoRemovible', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando AparatoRemovible' });
  }
});

// Arco de ortodoncia
app.post('/api/version/:versionId/arco', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { tipo = null, color = null, puntos, usuario = null, metadata = null } = req.body || {};
    if (!versionId || !puntos) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('tipo', sql.NVarChar(50), tipo);
    r.input('color', sql.NVarChar(30), color);
    r.input('puntos', sql.NVarChar(sql.MAX), puntos);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.ArcoOrtodoncia (OdontogramaVersionId, Tipo, Color, Puntos, Metadata, Usuario_Creacion) VALUES (@vid, @tipo, @color, @puntos, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'ArcoOrtodoncia', accion: 'INSERT', clave: `Id=${id}` , usuario});
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando ArcoOrtodoncia' });
  }
});

app.delete('/api/version/:versionId/arco/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.ArcoOrtodoncia WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'ArcoOrtodoncia', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando ArcoOrtodoncia' });
  }
});

// General canvas elements
app.post('/api/version/:versionId/linea', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { color = null, grosor = null, tipo = null, puntos, metadata = null, usuario = null } = req.body || {};
    if (!versionId || !puntos) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('color', sql.NVarChar(30), color);
    r.input('grosor', sql.Decimal(4,2), grosor);
    r.input('tipo', sql.NVarChar(30), tipo);
    r.input('puntos', sql.NVarChar(sql.MAX), puntos);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Linea (OdontogramaVersionId, Color, Grosor, Tipo, Puntos, Metadata, Usuario_Creacion) VALUES (@vid, @color, @grosor, @tipo, @puntos, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Linea', accion: 'INSERT', clave: `Id=${id}` });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando Linea' });
  }
});

app.delete('/api/version/:versionId/linea/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Linea WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'Linea', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando Linea' });
  }
});

app.post('/api/version/:versionId/flecha', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { color = null, origenX, origenY, destinoX, destinoY, estilo = null, metadata = null, usuario = null } = req.body || {};
    if (!versionId || origenX === undefined || origenY === undefined || destinoX === undefined || destinoY === undefined) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('color', sql.NVarChar(30), color);
    r.input('ox', sql.Decimal(6,3), origenX);
    r.input('oy', sql.Decimal(6,3), origenY);
    r.input('dx', sql.Decimal(6,3), destinoX);
    r.input('dy', sql.Decimal(6,3), destinoY);
    r.input('estilo', sql.NVarChar(30), estilo);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Flecha (OdontogramaVersionId, Color, OrigenX, OrigenY, DestinoX, DestinoY, Estilo, Metadata, Usuario_Creacion) VALUES (@vid, @color, @ox, @oy, @dx, @dy, @estilo, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Flecha', accion: 'INSERT', clave: `Id=${id}` });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando Flecha' });
  }
});

app.delete('/api/version/:versionId/flecha/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Flecha WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'Flecha', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando Flecha' });
  }
});

app.post('/api/version/:versionId/simbolo', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { tipoCodigo, posX, posY, color = null, metadata = null, usuario = null } = req.body || {};
    if (!versionId || !tipoCodigo || posX === undefined || posY === undefined) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('tipo', sql.NVarChar(50), tipoCodigo);
    r.input('x', sql.Decimal(6,3), posX);
    r.input('y', sql.Decimal(6,3), posY);
    r.input('color', sql.NVarChar(30), color);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.SimboloClinico (OdontogramaVersionId, TipoCodigo, PosX, PosY, Color, Metadata, Usuario_Creacion) VALUES (@vid, @tipo, @x, @y, @color, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'SimboloClinico', accion: 'INSERT', clave: `Id=${id}` });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando SimboloClinico' });
  }
});

app.delete('/api/version/:versionId/simbolo/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.SimboloClinico WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'SimboloClinico', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando SimboloClinico' });
  }
});

app.post('/api/version/:versionId/anotacion', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { categoria = null, texto = null, metadata = null, usuario = null } = req.body || {};
    if (!versionId) return res.status(400).json({ error: 'missing versionId' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('cat', sql.NVarChar(50), categoria);
    r.input('txt', sql.NVarChar(1000), texto);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const ins = await r.query(`INSERT INTO dbo.Anotacion (OdontogramaVersionId, Categoria, Texto, Metadata, Usuario_Creacion) VALUES (@vid, @cat, @txt, @metadata, @usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const id = ins.recordset && ins.recordset[0] ? ins.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Anotacion', accion: 'INSERT', clave: `Id=${id}` });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando Anotacion' });
  }
});

app.delete('/api/version/:versionId/anotacion/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Anotacion WHERE Id = @id`);
    await logVersionAudit({ versionId, entidad: 'Anotacion', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando Anotacion' });
  }
});

// ==========================
// Raices (triángulos de raíces) - Upsert por diente/version
// ==========================
app.post('/api/version/:versionId/raiz', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const { numeroDiente, configuracion, triangulo1Activo = false, triangulo2Activo = false, triangulo3Activo = false, metadata = null, usuario = null } = req.body || {};
    if (!versionId || !numeroDiente || !configuracion) return res.status(400).json({ error: 'missing fields' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    r.input('num', sql.TinyInt, numeroDiente);
    r.input('config', sql.TinyInt, configuracion);
    r.input('t1', sql.Bit, triangulo1Activo ? 1 : 0);
    r.input('t2', sql.Bit, triangulo2Activo ? 1 : 0);
    r.input('t3', sql.Bit, triangulo3Activo ? 1 : 0);
    r.input('metadata', sql.NVarChar(sql.MAX), metadata);
    r.input('usuario', sql.NVarChar(100), usuario);
    const upsert = `IF EXISTS (SELECT 1 FROM dbo.Raiz WHERE OdontogramaVersionId=@vid AND NumeroDiente=@num)
      BEGIN
        UPDATE dbo.Raiz SET Configuracion=@config, Triangulo1Activo=@t1, Triangulo2Activo=@t2, Triangulo3Activo=@t3, Metadata=@metadata, Fecha_Modificacion=GETDATE(), Usuario_Modificacion=@usuario WHERE OdontogramaVersionId=@vid AND NumeroDiente=@num;
        SELECT Id FROM dbo.Raiz WHERE OdontogramaVersionId=@vid AND NumeroDiente=@num;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.Raiz (OdontogramaVersionId, NumeroDiente, Configuracion, Triangulo1Activo, Triangulo2Activo, Triangulo3Activo, Metadata, Usuario_Creacion) VALUES (@vid, @num, @config, @t1, @t2, @t3, @metadata, @usuario);
        SELECT SCOPE_IDENTITY() AS Id;
      END`;
    const rs = await r.query(upsert);
    const id = rs.recordset && rs.recordset[0] ? rs.recordset[0].Id : null;
    await logVersionAudit({ versionId, entidad: 'Raiz', accion: 'UPSERT', clave: `Id=${id}`, detalle: `Diente=${numeroDiente};Cfg=${configuracion}`, usuario });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando raiz' });
  }
});

app.get('/api/version/:versionId/raices', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    if (!versionId) return res.status(400).json({ error: 'invalid version id' });
    const r = pool.request();
    r.input('vid', sql.Int, versionId);
    const rs = await r.query(`SELECT * FROM dbo.Raiz WHERE OdontogramaVersionId=@vid`);
    res.json(rs.recordset || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo raices' });
  }
});

app.delete('/api/version/:versionId/raiz/:id', async (req, res) => {
  try {
    await initDb();
    const versionId = parseInt(req.params.versionId, 10);
    const id = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('id', sql.Int, id);
    await r.query(`DELETE FROM dbo.Raiz WHERE Id=@id`);
    await logVersionAudit({ versionId, entidad: 'Raiz', accion: 'DELETE', clave: `Id=${id}` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando raiz' });
  }
});

// ==========================
// Actualizar Observaciones de Odontograma
// ==========================
app.post('/api/odontograma/:id/observaciones', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { observaciones, usuario = null } = req.body || {};
    if (!odontogramaId) return res.status(400).json({ error: 'invalid odontograma id' });
    const r = pool.request();
    r.input('id', sql.Int, odontogramaId);
    r.input('obs', sql.NVarChar(sql.MAX), observaciones || null);
    r.input('usuario', sql.NVarChar(100), usuario);
    await r.query(`UPDATE dbo.Odontograma SET Observaciones=@obs, Fecha_Modificacion=GETDATE(), Usuario_Modificacion=@usuario WHERE Id=@id`);
    await logAudit({ odontogramaId, accion: 'UPDATE_OBSERVACIONES', detalle: observaciones ? `Len=${observaciones.length}` : 'NULL', usuario });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando observaciones' });
  }
});

// Save a diente codigo
app.post('/api/odontograma/:id/diente/codigo', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { nroHistoria, numeroDiente, codigo, descripcion, color, usuario } = req.body;
    if (!odontogramaId || !numeroDiente || !codigo) return res.status(400).json({ error: 'missing required fields' });
    const historia = nroHistoria || await getNroCuentaByOdontograma(odontogramaId);
    if (!historia) return res.status(400).json({ error: 'Nro_Historia requerido (no encontrado en Odontograma y no enviado en la solicitud)' });
    const r = pool.request();
    r.input('OdontogramaId', sql.Int, odontogramaId);
    r.input('Nro_Historia', sql.NVarChar(50), historia);
    r.input('NumeroDiente', sql.TinyInt, numeroDiente);
    r.input('Codigo', sql.NVarChar(50), codigo);
    r.input('Descripcion', sql.NVarChar(250), descripcion || null);
    r.input('Color', sql.NVarChar(30), color || null);
    r.input('Usuario', sql.NVarChar(100), usuario || null);
    const insert = await r.query(`INSERT INTO dbo.DienteCodigo (OdontogramaId, Nro_Historia, NumeroDiente, Codigo, Descripcion, Color, Usuario_Creacion) VALUES (@OdontogramaId, @Nro_Historia, @NumeroDiente, @Codigo, @Descripcion, @Color, @Usuario); SELECT SCOPE_IDENTITY() AS Id;`);
    const newId = insert.recordset && insert.recordset[0] ? insert.recordset[0].Id : null;
    await logAudit({ odontogramaId, nroCuenta: historia, accion: 'ADD_CODIGO', detalle: `Diente=${numeroDiente};Codigo=${codigo}`, usuario });
    res.status(201).json({ id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando codigo' });
  }
});

// Upsert diente area
app.post('/api/odontograma/:id/diente/area', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { nroHistoria, numeroDiente, area, estado, color, observaciones, usuario } = req.body;
    if (!odontogramaId || !numeroDiente || !area) return res.status(400).json({ error: 'missing required fields' });
    const historia = nroHistoria || await getNroCuentaByOdontograma(odontogramaId);
    if (!historia) return res.status(400).json({ error: 'Nro_Historia requerido (no encontrado en Odontograma y no enviado en la solicitud)' });
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      const tr = trx.request();
      tr.input('OdontogramaId', sql.Int, odontogramaId);
      tr.input('Nro_Historia', sql.NVarChar(50), historia);
      tr.input('NumeroDiente', sql.TinyInt, numeroDiente);
      tr.input('Area', sql.NVarChar(50), area);
      tr.input('Estado', sql.NVarChar(100), estado || null);
      tr.input('Color', sql.NVarChar(30), color || null);
      tr.input('Observaciones', sql.NVarChar(500), observaciones || null);
      tr.input('Usuario', sql.NVarChar(100), usuario || null);
      const upsertSql = `IF EXISTS (SELECT 1 FROM dbo.DienteArea WHERE OdontogramaId=@OdontogramaId AND NumeroDiente=@NumeroDiente AND Area=@Area)
        BEGIN
          UPDATE dbo.DienteArea SET Estado=@Estado, Color=@Color, Observaciones=@Observaciones, Fecha_Modificacion=GETDATE(), Usuario_Modificacion=@Usuario WHERE OdontogramaId=@OdontogramaId AND NumeroDiente=@NumeroDiente AND Area=@Area
        END
        ELSE
        BEGIN
          INSERT INTO dbo.DienteArea (OdontogramaId, Nro_Historia, NumeroDiente, Area, Estado, Color, Observaciones, Usuario_Creacion) VALUES (@OdontogramaId, @Nro_Historia, @NumeroDiente, @Area, @Estado, @Color, @Observaciones, @Usuario)
        END`;
      await tr.query(upsertSql);
      await trx.commit();
      await logAudit({ odontogramaId, nroCuenta: historia, accion: 'UPSERT_DIENTE_AREA', detalle: `Diente=${numeroDiente};Area=${area};Estado=${estado}`, usuario });
      res.json({ ok: true });
    } catch (err) {
      try { await trx.rollback(); } catch (e) {}
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando area' });
  }
});

// Mark extraction on tooth
app.post('/api/odontograma/:id/diente/extraccion', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { nroHistoria, numeroDiente, usuario } = req.body;
    if (!odontogramaId || !numeroDiente) return res.status(400).json({ error: 'missing required fields' });
    const historia = nroHistoria || await getNroCuentaByOdontograma(odontogramaId);
    if (!historia) return res.status(400).json({ error: 'Nro_Historia requerido (no encontrado en Odontograma y no enviado en la solicitud)' });
    const trx = new sql.Transaction(pool);
    await trx.begin();
    try {
      const tr = trx.request();
      tr.input('OdontogramaId', sql.Int, odontogramaId);
      tr.input('Nro_Historia', sql.NVarChar(50), historia);
      tr.input('NumeroDiente', sql.TinyInt, numeroDiente);
      tr.input('Usuario', sql.NVarChar(100), usuario || null);
      const upsert = `IF EXISTS (SELECT 1 FROM dbo.Diente WHERE OdontogramaId=@OdontogramaId AND NumeroDiente=@NumeroDiente)
        BEGIN
          UPDATE dbo.Diente SET Estado='extraccion', Fecha_Modificacion=GETDATE(), Usuario_Modificacion=@Usuario WHERE OdontogramaId=@OdontogramaId AND NumeroDiente=@NumeroDiente
        END
        ELSE
        BEGIN
          INSERT INTO dbo.Diente (OdontogramaId, Nro_Historia, NumeroDiente, Estado, Usuario_Creacion) VALUES (@OdontogramaId, @Nro_Historia, @NumeroDiente, 'extraccion', @Usuario)
        END`;
      await tr.query(upsert);
      await trx.commit();
      await logAudit({ odontogramaId, nroCuenta: historia, accion: 'MARK_EXTRACCION', detalle: `Diente=${numeroDiente}`, usuario });
      res.json({ ok: true });
    } catch (err) {
      try { await trx.rollback(); } catch (e) {}
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error marcando extraccion' });
  }
});

// Create/Upsert a catalog code
app.get('/api/codigos', async (req, res) => {
  try {
    await initDb();
    const q = (req.query.q || '').toString().trim();
    const r = pool.request();
    if (q) {
      r.input('q', sql.NVarChar(200), `%${q}%`);
      // Buscar en servicios y diagnósticos en vez de CatalogoProcedimiento
      const result = await r.query(`
        SELECT TOP 50 
          F.Codigo AS Codigo, 
          F.Nombre AS Descripcion,
          NULL AS Categoria,
          NULL AS ColorDefault,
          1 AS Activo
        FROM dbo.FactCatalogoServicios F
        WHERE (F.Codigo LIKE @q OR F.Nombre LIKE @q)

        UNION ALL

        SELECT TOP 50 
          D.CodigoCIE2004 AS Codigo,
          D.Descripcion AS Descripcion,
          NULL AS Categoria,
          NULL AS ColorDefault,
          1 AS Activo
        FROM dbo.Diagnosticos D
        WHERE (D.CodigoCIE2004 LIKE @q OR D.Descripcion LIKE @q)
      `);
      return res.json(result.recordset);
    }
    const result = await r.query(`
      SELECT TOP 100 
        F.Codigo AS Codigo, 
        F.Nombre AS Descripcion,
        NULL AS Categoria,
        NULL AS ColorDefault,
        1 AS Activo
      FROM dbo.FactCatalogoServicios F
      ORDER BY F.Codigo
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo codigos' });
  }
});

app.post('/api/codigos', async (req, res) => {
  try {
    await initDb();
    const { codigo, descripcion, categoria, colorDefault } = req.body;
    if (!codigo || !descripcion) return res.status(400).json({ error: 'codigo y descripcion requeridos' });
    const r = pool.request();
    r.input('Codigo', sql.NVarChar(50), codigo);
    r.input('Descripcion', sql.NVarChar(500), descripcion);
    r.input('Categoria', sql.NVarChar(100), categoria || null);
    r.input('ColorDefault', sql.NVarChar(20), colorDefault || null);
    const sqlText = `IF EXISTS(SELECT 1 FROM dbo.CatalogoProcedimiento WHERE Codigo=@Codigo)
      UPDATE dbo.CatalogoProcedimiento SET Descripcion=@Descripcion, Categoria=@Categoria, ColorDefault=@ColorDefault WHERE Codigo=@Codigo
      ELSE
      INSERT INTO dbo.CatalogoProcedimiento (Codigo, Descripcion, Categoria, ColorDefault) VALUES (@Codigo, @Descripcion, @Categoria, @ColorDefault)`;
    await r.query(sqlText);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando codigo' });
  }
});

// Transposicion endpoints
app.post('/api/odontograma/:id/transposicion', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const { diente_from, diente_to, color, observaciones, usuario, nroHistoria } = req.body;
    const r = pool.request();
    r.input('odontogramaId', sql.Int, odontogramaId);
    const historia = nroHistoria || await getNroCuentaByOdontograma(odontogramaId);
    if (!historia) return res.status(400).json({ error: 'Nro_Historia requerido (no encontrado en Odontograma y no enviado en la solicitud)' });
    r.input('nroHistoria', sql.NVarChar(50), historia);
    r.input('from', sql.TinyInt, diente_from);
    r.input('to', sql.TinyInt, diente_to);
    r.input('color', sql.NVarChar(30), color || null);
    r.input('obs', sql.NVarChar(500), observaciones || null);
    r.input('usuario', sql.NVarChar(100), usuario || null);
    await r.query(`INSERT INTO dbo.Transposicion (OdontogramaId, Nro_Historia, Diente_From, Diente_To, Color, Observaciones, Usuario_Creacion) VALUES (@odontogramaId, @nroHistoria, @from, @to, @color, @obs, @usuario)`);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando transposicion' });
  }
});

app.get('/api/odontograma/:id/transposiciones', async (req, res) => {
  try {
    await initDb();
    const odontogramaId = parseInt(req.params.id, 10);
    const r = pool.request();
    r.input('odontogramaId', sql.Int, odontogramaId);
    const result = await r.query(`SELECT * FROM dbo.Transposicion WHERE OdontogramaId = @odontogramaId`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo transposiciones' });
  }
});

app.delete('/api/odontograma/:id/transposicion/:transId', async (req, res) => {
  try {
    await initDb();
    const transId = parseInt(req.params.transId, 10);
    const r = pool.request();
    r.input('id', sql.Int, transId);
    await r.query(`DELETE FROM dbo.Transposicion WHERE Id = @id`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando transposicion' });
  }
});

// ==========================
// Histórico por Nro_Cuenta
// ==========================

// Lista de odontogramas históricos por cuenta, con correlativo y conteo de versiones
app.get('/api/odontograma/historico/:nroCuenta', async (req, res) => {
  try {
    await initDb();
    const nroHistoria = (req.params.nroCuenta || '').toString();
    const r = pool.request();
    r.input('nroHistoria', sql.NVarChar(50), nroHistoria);
    const q = `
      SELECT 
        o.Id,
        o.Nro_Historia,
        o.Version,
        o.Fecha_Visita,
        o.Tipo_Visita,
        o.Observaciones,
        o.Fecha_Creacion,
        o.Usuario_Creacion,
        (SELECT COUNT(*) FROM dbo.OdontogramaVersion v WHERE v.OdontogramaId = o.Id) AS Versiones,
        RIGHT('0000000000' + CAST(o.Id AS VARCHAR(10)), 10) AS Correlativo
      FROM dbo.Odontograma o
      WHERE o.Nro_Historia = @nroHistoria
      ORDER BY o.Fecha_Creacion DESC`;
    const rs = await r.query(q);
    res.json(rs.recordset || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo historico' });
  }
});

// Obtiene un odontograma específico por Nro_Cuenta + correlativo (Id zero-padded)
app.get('/api/odontograma/historico/:nroCuenta/:correlativo', async (req, res) => {
  try {
    await initDb();
    const nroHistoria = (req.params.nroCuenta || '').toString();
    const { correlativo } = req.params;
    const id = parseInt(correlativo, 10); // admite '0000000123' => 123
    if (!nroHistoria || !id) return res.status(400).json({ error: 'parámetros inválidos' });

    // Validar que pertenezca a la cuenta
    const r0 = pool.request();
    r0.input('nroHistoria', sql.NVarChar(50), nroHistoria);
    r0.input('id', sql.Int, id);
    const e = await r0.query(`SELECT TOP 1 Id FROM dbo.Odontograma WHERE Nro_Historia = @nroHistoria AND Id = @id`);
    if (!e.recordset || e.recordset.length === 0) return res.status(404).json({ error: 'Odontograma no encontrado para la cuenta indicada' });

    // Reutilizar la carga "full" del odontograma
    const reqO = pool.request();
    reqO.input('id', sql.Int, id);
    const [odontogramaResult, dientesResult, areasResult, codesResult, protesisResult, transResult, diastemaResult, auditResult, versionsResult] = await Promise.all([
      reqO.query(`SELECT * FROM dbo.Odontograma WHERE Id = @id`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.Diente WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.DienteArea WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.DienteCodigo WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT p.*, pt.NumeroDiente FROM dbo.Protesis p LEFT JOIN dbo.ProtesisTeeth pt ON p.Id = pt.ProtesisId WHERE p.OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.Transposicion WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.Diastema WHERE OdontogramaId = @odontogramaId`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT * FROM dbo.OdontogramaAudit WHERE OdontogramaId = @odontogramaId ORDER BY Fecha DESC`),
      pool.request().input('odontogramaId', sql.Int, id).query(`SELECT Id, VersionNumber, Fecha_Creacion, Usuario_Creacion FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontogramaId ORDER BY VersionNumber DESC`)
    ]);

    const protesisRows = protesisResult.recordset || [];
    const protesisMap = {};
    for (const row of protesisRows) {
      if (!protesisMap[row.Id]) protesisMap[row.Id] = { ...row, dientes: [] };
      if (row.NumeroDiente) protesisMap[row.Id].dientes.push(row.NumeroDiente);
    }

    const odontograma = odontogramaResult.recordset && odontogramaResult.recordset[0] ? odontogramaResult.recordset[0] : null;
    if (!odontograma) return res.status(404).json({ error: 'Odontograma no encontrado' });
    odontograma.dientes = dientesResult.recordset || [];
    odontograma.areas = areasResult.recordset || [];
    odontograma.codigos = codesResult.recordset || [];
    odontograma.protesis = Object.values(protesisMap);
    odontograma.transposiciones = transResult.recordset || [];
    odontograma.diastemas = diastemaResult.recordset || [];
    odontograma.audit = auditResult.recordset || [];
    odontograma.versiones = versionsResult.recordset || [];
    odontograma.correlativo = ('0000000000' + String(id)).slice(-10);

    res.json(odontograma);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo historial por correlativo' });
  }
});

// =============================================
// NUEVA RUTA: Requerimiento por correlativo + nro_cuenta
// =============================================
app.get('/api/requerimiento/correlativo/:correlativo/:nroCuenta', async (req, res) => {
  try {
    await initDb();
    const { correlativo, nroCuenta } = req.params;
    const request = pool.request();
    request.input('correlativo', sql.VarChar(50), correlativo);
    request.input('nro_cuenta', sql.Int, parseInt(nroCuenta, 10));
    const result = await request.query(`
      SELECT 
        rb.id,
        rb.id_correlativo,
        rb.nro_cuenta,
        rb.medico,
        rb.nombres_paciente,
        rb.edad,
        rb.historia_clinica,
        rb.fecha_salida,
        rb.hora,
        rb.servicio,
        rb.fecha_creacion,
        rb.usuario_creacion,
        dfb.funcion,
        dfb.opcion
      FROM RequerimientoBiologico rb
      LEFT JOIN DetalleFuncionBiologica dfb ON dfb.requerimiento_id = rb.id
      WHERE rb.id_correlativo = @correlativo AND rb.nro_cuenta = @nro_cuenta
    `);
    if (!result.recordset || result.recordset.length === 0) return res.status(404).json({ error: 'Requerimiento no encontrado' });
    const base = result.recordset[0];
    const requerimiento = {
      id: base.id,
      id_correlativo: base.id_correlativo,
      nro_cuenta: base.nro_cuenta,
      medico: base.medico,
      nombres_paciente: base.nombres_paciente,
      edad: base.edad,
      historia_clinica: base.historia_clinica,
      fecha_salida: base.fecha_salida,
      hora: base.hora ? base.hora.toISOString().substring(11, 16) : null,
      servicio: base.servicio,
      fecha_creacion: base.fecha_creacion,
      usuario_creacion: base.usuario_creacion,
      funciones: {}
    };
    for (const row of result.recordset) {
      if (row.funcion) {
        if (!requerimiento.funciones[row.funcion]) requerimiento.funciones[row.funcion] = [];
        requerimiento.funciones[row.funcion].push(row.opcion);
      }
    }
    requerimiento.total_funciones = Object.keys(requerimiento.funciones).length;
    if (requerimiento.fecha_creacion) {
      const fecha = new Date(requerimiento.fecha_creacion);
      requerimiento.fecha_formato = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    res.json(requerimiento);
  } catch (error) {
    console.error('Error obteniendo requerimiento:', error);
    res.status(500).json({ error: 'Error obteniendo requerimiento' });
  }
});

// Static assets (optional)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.send('Odontograma API'));


// ⬇️ ESTA LÍNEA DEBE ESTAR SEPARADA
const PORT = process.env.PORT || 3088;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log('\n✅ Server running successfully!');
    console.log(`\n🌐 Local:   http://localhost:${PORT}`);
    console.log(`🌐 API:     http://localhost:${PORT}/api`);
    console.log(`📊 Database: ${dbConfig.server}/${dbConfig.database}\n`);
  });
}).catch(err => {
  console.error('❌ DB init failed', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n🔄 Closing server...');
  try {
    if (pool) await pool.close();
    console.log('✅ DB pool closed');
  } catch (err) {
    console.error('❌ Error closing pool', err);
  }
  console.log('👋 Goodbye!\n');
  process.exit();
});
