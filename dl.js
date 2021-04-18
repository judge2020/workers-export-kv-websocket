let WebsocketClient = require('websocket').client
let fs = require('fs')
let sqlite3 = require('sqlite3')
let sanitize = require('sanitize-filename')
let mkdirp = require('mkdirp')
const { Command } = require('commander')
const program = new Command()

program.option('-d, --domain <domain>',
  'workers.dev hostname, eg kv-export.my.workers.dev').
  option('-o, --outdir <directory>',
    'if set, uses the filesystem instead of a sqlite3 database', 'no').
  parse(process.argv)
let options = program.opts()

mkdirp.sync('out')

if (!options.domain) {
  throw new Error("--domain is required. See --help.");
}
let workers_dev_domain = options.domain;

let wantFs = options.outdir !== 'no'
let wantSqlite = options.outdir === 'no'

let to_end = false
let expected_messages = 0
let count = 0

function doWriteFs (key, value) {
  fs.writeFileSync(`out/${sanitize(key)}`, value)
}

let db

function doWriteSqlite (cnt, key, value) {
  if (!db) {
    db = new sqlite3.Database('out.sqlite3')
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS outkv (
id BIGINT PRIMARY KEY,
key TEXT NOT NULL,
value BLOB NOT NULL
)`)
    })
  }
  // assuming KV list is deterministic in order; not entirely confident in that
  db.run('INSERT OR REPLACE INTO outkv VALUES (?, ?, ?)', [cnt, key, value])
}

function doConnect (cursor = '') {
  var client = new WebsocketClient()
  let local_count = 0
  let local_expected = 0
  client.on('connect', function(connection) {
    connection.on('error', function(error) {
      console.log('Connection Error: ' + error.toString())
    })
    connection.on('close', function() {
    })

    function seeIfDone () {
      // noinspection EqualityComparisonWithCoercionJS
      if (local_count == local_expected) {
        connection.close()
      }
      // noinspection EqualityComparisonWithCoercionJS
      if (to_end && count == expected_messages) {
        process.exit()
      }
    }

    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        let json = JSON.parse(message.utf8Data)
        if (json.type == 'message') {
          count += 1
          local_count += 1
          process.stdout.write(`${count}\r`)
          if (wantFs) {
            doWriteFs(json.key,
              Buffer.from(json.message, 'base64').toString('binary'))
          } else if (wantSqlite) {
            if (typeof json.key == 'undefined' || json.key == '') {
              console.log(message)
              console.log('warning: couldn\'t save key, was undefined')
            } else {
              doWriteSqlite(count, json.key,
                Buffer.from(json.message, 'base64').toString('binary'))
            }
          }
          seeIfDone()
        } else if (json.type == 'cursor') {
          expected_messages += json.expect
          local_expected += json.expect
          if (json.cursor == '') {
            to_end = true
          } else {
            return doConnect(json.cursor)
          }
        } else if (json.type == 'done') {
          seeIfDone()
        } else {
          console.log(message.utf8Data)
        }
      }
    })
    if (cursor) {
      connection.sendUTF(`pull ${cursor}`)
    } else {
      connection.sendUTF(`pull`)
    }
  })
  client.connect(
    `wss://${workers_dev_domain}/this_should_be_a_secret_string_todo_add_to_config`)
}

doConnect()
