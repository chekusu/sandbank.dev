#!/usr/bin/env node

const token = process.env.CLOUDFLARE_API_TOKEN
const zoneIdFromEnv = process.env.CLOUDFLARE_ZONE_ID
const zoneName = process.env.CLOUDFLARE_ZONE_NAME || 'sandbank.dev'
const recordName = process.env.DNS_RECORD_NAME
const recordType = process.env.DNS_RECORD_TYPE || 'A'
const recordContent = process.env.DNS_RECORD_CONTENT
const proxied = process.env.DNS_RECORD_PROXIED !== '0'

if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required')
if (!recordName) throw new Error('DNS_RECORD_NAME is required')
if (!recordContent) throw new Error('DNS_RECORD_CONTENT is required')

const api = 'https://api.cloudflare.com/client/v4'
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
}

let zoneId = zoneIdFromEnv
if (!zoneId) {
  const zone = await cf(`/zones?name=${encodeURIComponent(zoneName)}`)
  zoneId = zone.result?.[0]?.id
}
if (!zoneId) throw new Error(`Cloudflare zone not found: ${zoneName}`)

const existing = await cf(`/zones/${zoneId}/dns_records?type=${encodeURIComponent(recordType)}&name=${encodeURIComponent(recordName)}`)
const payload = {
  name: recordName,
  type: recordType,
  content: recordContent,
  proxied,
  ttl: 1,
}

if (existing.result?.[0]?.id) {
  const recordId = existing.result[0].id
  await cf(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  console.log(`Updated ${recordType} ${recordName} -> ${recordContent}`)
} else {
  await cf(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  console.log(`Created ${recordType} ${recordName} -> ${recordContent}`)
}

async function cf(path, init = {}) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
  })
  const data = await response.json()
  if (!response.ok || data.success === false) {
    throw new Error(`${init.method || 'GET'} ${path} failed: ${JSON.stringify(data.errors || data)}`)
  }
  return data
}
