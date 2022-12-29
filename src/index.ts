/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import ObjectCache from "./ObjectCache";

// These initial Types are based on bindings that don't exist in the project yet,
// you can follow the links to learn how to implement them.

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	MY_BUCKET: R2Bucket
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url)
		const key = url.pathname.slice(1)
		const a = key.split('/')
		const service: string | undefined = a[0]
		const recordId = a[1]
		const fileName = a.slice(2).join('/')

		// if (request.method === 'HEAD') {
		// 	const object = await env.MY_BUCKET.head(key)
		// 	if (!object) {
		// 		return new Response('Object Not Found', {status: 404})
		// 	}
		// 	const headers = new Headers()
		// 	object.writeHttpMetadata(headers)
		// 	headers.set('etag', object.httpEtag)
		// 	return new Response('', {
		// 		headers
		// 	})
		// }
		if (request.method === 'GET') {
			if (!['zenodo', 'zenodo-sandbox'].includes(service)) {
				return new Response('Invalid service', {status: 500})
			}
			const service1 = service as ('zenodo' | 'zenodo-sandbox')
			if (!isValidRecordId(recordId)) {
				return new Response('Invalid record ID', {status: 500})
			}
			const zrec = await getZenodoRecord(service1, recordId, env.MY_BUCKET)
			if (!zrec) {
				return new Response('Record Not Found', {status: 404})
			}
			// there's a problem with auto-appending the index.html - relative paths of other files
			// instead we need to redirect on the client side to include the index.html in the url address
			// const a = zrec.files.find(f => (f.key === fileName)) || zrec.files.find(f => (f.key === appendPaths(fileName, 'index.html')))
			const a = zrec.files.find(f => (f.key === fileName))
			if (!a) {
				if (zrec.files.find(f => (f.key === appendPaths(fileName, 'index.html')))) {
					// tricky
					return new Response(`<html><head><meta http-equiv="refresh" content="0; url=${key.endsWith('/') ? "index.html" : key.split('/')[key.split('/').length - 1] + '/index.html'}" /></head></html>`, {headers: {'Content-Type': 'text/html'}})
				}
				else return new Response('File Not Found', {status: 404})
			}
			const md5 = a.checksum
			const fileObjectKey = `md5/${md5[0]}${md5[1]}/${md5[2]}${md5[3]}/${md5[4]}${md5[5]}/${md5}`
			let fileObject = await env.MY_BUCKET.get(fileObjectKey)
			if (!fileObject) {
				const zenodoFileUrl = a.links.self
				const resp = await fetch(zenodoFileUrl)
				// const resp = await axios.get(zenodoFileUrl, {responseType: 'stream'})
				if (resp.status !== 200) {
					return new Response('File Not Found on Zenodo', {status: 404})
				}
				// note that resp.body doesn't work because put complains that the length of the stream cannot be determined
				await env.MY_BUCKET.put(fileObjectKey, await resp.text())
				fileObject = await env.MY_BUCKET.get(fileObjectKey)
				if (!fileObject) {
					return new Response('File Not Found (unexpected)', {status: 404})
				}
			}
			const headers = new Headers()
			fileObject.writeHttpMetadata(headers)
			headers.set('etag', fileObject.httpEtag)
			return new Response(fileObject.body, {
				headers
			})
		}
		else {
			return new Response('Method Not Allowed', {
				status: 405,
				headers: {
					Allow: 'GET'
				}
			})
		}
	},
};

const recordCache = new ObjectCache<ZenodoRecord>(1000 * 60 * 5)

type FileRecord = {
    bucket: string,
    checksum: string,
    key: string,
    id: string,
    links: {
		self: string
	},
	size: number,
	type: string
}

type ZenodoRecord = {
	files: FileRecord[]
}

export const getZenodoRecord = async (service: 'zenodo' | 'zenodo-sandbox', recordId: string, bucket: R2Bucket): Promise<ZenodoRecord | undefined> => {
	// first check in cache
	const cacheKey = `${service}/${recordId}`
    const a = recordCache.get(cacheKey)
    if (a) return a

	// next check in bucket
	const objectKey = `${service}/${recordId}/record.json`
	const object = await bucket.get(objectKey)
	if (object) {
		const obj = (await object.json()) as ZenodoRecord
		recordCache.set(cacheKey, obj)
		return obj
	}

	// next check in zenodo
	const zenodoRecordUrl = `https://${service === 'zenodo-sandbox' ? 'sandbox.zenodo.org' : 'zenodo.org'}/api/records/${recordId}`
    // const x = await axios.get(zenodoRecordUrl, {responseType: 'json'})
	const x = await fetch(zenodoRecordUrl)
    const zrec = (await x.json()) as ZenodoRecord
    if (zrec) {
		if (isValidRecord(zrec)) {
			await bucket.put(objectKey, JSON.stringify(zrec))
			recordCache.set(cacheKey, zrec as ZenodoRecord)
			return zrec as ZenodoRecord
		}
		else {
			return undefined
		}
    }
    else return undefined
}

const isValidRecord = (zrec: ZenodoRecord) => {
	const a = zrec.files.find(f => (f.key === 'figurl.json'))
	return (a !== undefined)
}

const isValidRecordId = (id: string) => {
    // TODO
    return (id.length >= 5) && (id.length <= 11)
}

const appendPaths = (a: string, b: string) => {
	if (!a) return b
	if (!b) return a
	if (a.endsWith('/')) return a + b
	else return `${a}/${b}`
}