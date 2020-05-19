#!/usr/bin/env node
const promisify = require('util').promisify
const xml2js = require('xml2js')
const parseString = promisify(xml2js.parseString)

const fs = require('fs')
const fsOptions = { encoding: 'utf8' }

const buildXML = (data) => {
  const builder = new xml2js.Builder()
  return builder.buildObject(data)
}

const getEntries = (config, context) => {
  let entries = [];
  const labels = Object.entries(config.$labels || {})
  labels.forEach(tuple => {
    const label = context? [context, tuple[0]].join('/') : tuple[0]
    const labelConfig = tuple[1]
    const extendedConfig = { ...config, ...labelConfig }
    extendedConfig.$labels = labelConfig.$labels
    const entry = { label, ...extendedConfig }
    const childEntries = getEntries(extendedConfig, label)
    if (config.$aggregateLabels && childEntries.length) {
      const key = extendedConfig.$aggregateLabels
      const aggregation = (childEntries || [])
        .filter(entry => key in entry)
        .map(entry => entry[key])
        .filter((e, i, a) => a.indexOf(e) === i)
      if (key in entry) aggregation.concat(entry[key])
      entry[key] = aggregation.join(' OR ')
    }
    entries = entries.concat(childEntries).concat(entry)
  })
  return entries
}


const create = (config) => {
  const entries = getEntries(config)
  const filters = {
    feed: {
      '$': {
        'xmlns': 'http://www.w3.org/2005/Atom',
        'xmlns:apps': 'http://schemas.google.com/apps/2006'
      },
      entry: entries.map(entry => {
        const props = []
        Object.entries(entry).forEach(tuple => {
          const name = tuple[0]
          if (name.charAt(0) == '$') return
          const value = tuple[1]
          props.push({ $: { name, value }})
        })
        return { 'apps:property': props }
      })
    }
  }
  return filters
}

const argv = require('yargs') // eslint-disable-line
  .usage('Usage: $0 generate [file]')
  .demandCommand(1)
  .command('generate <file>', false)
  .strict()
  .argv


switch (argv._[0]) {
  case 'generate': {
    try {
      const data = fs.readFileSync(argv.file, fsOptions)
      const config = JSON.parse(data)
      const filters = create(config, data)
      process.stdout.write(buildXML(filters))
      process.exit(0)
    } catch(err) {
      process.exit(1)
    }
  }
}
