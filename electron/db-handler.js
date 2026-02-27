const fs = require('fs')
const path = require('path')

let dbPath = null

/**
 * Inicializa o path do db.json.
 * PROD: userData (persistente fora do app)
 * DEV: root do projeto
 */
function init(userDataPath, isDev, resourcesPath) {
  if (isDev) {
    dbPath = path.join(__dirname, '..', 'db.json')
  } else {
    dbPath = path.join(userDataPath, 'db.json')

    // Se não existe no userData, copia o template
    if (!fs.existsSync(dbPath)) {
      // Packaged: extraResources/db.json | Local: ../db.json
      const templatePath = resourcesPath
        ? path.join(resourcesPath, 'db.json')
        : path.join(__dirname, '..', 'db.json')

      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, dbPath)
      } else {
        // Cria db vazio como fallback
        const emptyDB = {
          accounts: [],
          transactions: [],
          recurrents: [],
          history: [],
        }
        fs.writeFileSync(dbPath, JSON.stringify(emptyDB, null, 2), 'utf-8')
      }
    }
  }
}

function readDB() {
  const raw = fs.readFileSync(dbPath, 'utf-8')
  return JSON.parse(raw)
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Parseia path estilo json-server: "/accounts", "/accounts/1", "/transactions/tx-001"
 * Retorna { collection, id }
 */
function parsePath(urlPath) {
  const parts = urlPath.replace(/^\//, '').split('/')
  const collection = parts[0]
  const id = parts[1] ?? null
  return { collection, id }
}

/**
 * GET — retorna collection inteira ou item por id
 * Suporta query params simples (filtro por igualdade)
 */
function handleGet(urlPath, params) {
  const db = readDB()
  const { collection, id } = parsePath(urlPath)

  if (!db[collection]) return id ? null : []

  if (id) {
    // Busca por id (number ou string)
    return db[collection].find(item =>
      String(item.id) === String(id)
    ) ?? null
  }

  let items = [...db[collection]]

  // Filtros por query params (igualdade simples, como json-server)
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      items = items.filter(item => String(item[key]) === String(value))
    }
  }

  return items
}

/**
 * POST — adiciona item à collection
 * Para accounts: auto-incrementa id numérico
 * Para o resto: usa o id que veio no body (UUID)
 */
function handlePost(urlPath, body) {
  const db = readDB()
  const { collection } = parsePath(urlPath)

  if (!db[collection]) db[collection] = []

  // Auto-increment para accounts
  if (collection === 'accounts' && !body.id) {
    const maxId = db[collection].reduce((max, item) =>
      typeof item.id === 'number' && item.id > max ? item.id : max, 0)
    body.id = maxId + 1
  }

  db[collection].push(body)
  writeDB(db)
  return body
}

/**
 * PATCH — atualiza item por id
 */
function handlePatch(urlPath, body) {
  const db = readDB()
  const { collection, id } = parsePath(urlPath)

  if (!db[collection] || !id) return null

  const index = db[collection].findIndex(item =>
    String(item.id) === String(id)
  )

  if (index === -1) return null

  db[collection][index] = { ...db[collection][index], ...body }
  writeDB(db)
  return db[collection][index]
}

/**
 * DELETE — remove item por id
 */
function handleDelete(urlPath) {
  const db = readDB()
  const { collection, id } = parsePath(urlPath)

  if (!db[collection] || !id) return {}

  const index = db[collection].findIndex(item =>
    String(item.id) === String(id)
  )

  if (index === -1) return {}

  const [removed] = db[collection].splice(index, 1)
  writeDB(db)
  return removed
}

module.exports = { init, handleGet, handlePost, handlePatch, handleDelete }
