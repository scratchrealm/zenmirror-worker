## zenmirror-worker

This is the Cloudflare worker that powers zenmirror.org

This serves content from zenodo.org and sandbox.zenodo.org

Only records with figurl.json at the root can be served

When a http request for a file is received, it first checks the cache (on the R2 bucket called zen). If the file is found, it serves the file. If the file is not found, then it retrieves the content from zenodo, stores it in the cache, and then serves the content.

## To deploy

Use wrangler v2

wrangler2 login

wrangler2 publish

