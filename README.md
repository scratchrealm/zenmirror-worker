## Zenmirror

Figurl interactive documents can be exported as standalone HTML bundles, which are essentially mini static websites containing all necessary HTML/JavaScript/CSS files and datasets, with no external dependencies. While it is possible to store the directory in a .zip file and send it to collaborators, the receiver would need to download a potentially large file, unzip it and host the contents on a local web server to be able to view the document. The better approach for sharing an exported Figurl document is to upload the directory to a service such as Zenodo, which will store and serve the document to those who request it. However, Zenodo itself does not offer a preview of HTML files for security reasons. To this end, zenmirror.org was created to cache and serve Figurl interactive figures and documents that are archived on Zenodo.

## What is this repo?

This is the Cloudflare worker that powers zenmirror.org

This serves content from zenodo.org and sandbox.zenodo.org

Only records with figurl.json at the root can be served

When a http request for a file is received, it first checks the cache (on the R2 bucket called zen). If the file is found, it serves the file. If the file is not found, then it retrieves the content from zenodo, stores it in the cache, and then serves the content.

## To deploy

Use wrangler v2

wrangler2 login

wrangler2 publish

