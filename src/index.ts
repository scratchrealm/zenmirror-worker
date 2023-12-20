/**
 * This a cloudflare worker
 *
 * - Run `npx wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket
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
        if (request.method === 'GET') {
            if (!['zenodo', 'zenodo-sandbox'].includes(service)) {
                return new Response('Invalid service', {status: 500})
            }
            const service1 = service as ('zenodo' | 'zenodo-sandbox')
            if (!isValidRecordId(recordId)) {
                return new Response('Invalid record ID', {status: 500})
            }
            // Construct the Zenodo URL
            const zenodoUrl = `https://${service1 === 'zenodo-sandbox' ? 'sandbox.zenodo.org' : 'zenodo.org'}/records/${recordId}/files/${fileName}`;

            // Fetch the content from the Zenodo URL
            const response = await fetch(zenodoUrl);

            // Return the response from Zenodo
            return response;
        }
        else {
            return new Response('Invalid request method', {status: 500})
        }
    }
}

const isValidRecordId = (recordId: string): boolean => {
    return /^[0-9]+$/.test(recordId)
}