# ʕ •́؈•̀) `workers-export-kv-websocket`

Have enough keys in Workers KV for [stevenpack/cloudflare-workers-kv-export](https://github.com/stevenpack/cloudflare-workers-kv-export) to be too slow for exporting? This script utilized Workers itself to export KV data in a fast (but not necessarily efficient) manner.

## WARNING: costs & efficiency

Due to [the 1000 operations per workers invocation limitation](https://developers.cloudflare.com/workers/platform/limits#kv-limits), as well as `list` only returning 1000 keys, we're limited to 1,000 (990 to give leadway) KV get requests per workers invocation.

While this shouldn't be a problem if you have only tens of millions of keys to export ($5/10 million GET + $0.05 for 10000 LISTs = $5.05), this can end up costing hundreds of dollars if you have hundreds of millions of keys to export. See [this pricing sheet](https://docs.google.com/spreadsheets/d/e/2PACX-1vSaVi1Ji1HyTa09nMxBzW8LrmjEboaznohsL1qoveRArnSClqAZeLPIZS2nXqi-tUTuI9ZU0CnGOLyl/pubhtml?gid=0&single=true) (not guaranteed).

Be sure to calculate your expected costs, assuming you know just how many keys you might have in your namespace.

## 🔋 Getting Started

This template is meant to be used with [Wrangler](https://github.com/cloudflare/wrangler). If you are not already familiar with the tool, we recommend that you install the tool and configure it to work with your [Cloudflare account](https://dash.cloudflare.com). Documentation can be found [here](https://developers.cloudflare.com/workers/tooling/wrangler/).

1. run this command:

```bash
wrangler generate kv-ws-export https://github.com/judge2020/workers-export-kv-websocket
```

2. in your new project folder, edit `wrangler.toml` and input your account_id.

3. Add the following to the end of your wrangler.toml, replacing the KV id with the KV id you want to export

```
kv_namespaces = [
    { binding = "ARCHIVE_KV", id = "KV ID HERE" }
]
```

4. deploy the worker with `wrangler publish` and make note of the domain it uses, eg `my-kv.me.workers.dev`

5. run `node dl.js --domain my-kv.me.workers.dev`. This will start the output process. If you would like to instead store each key to a file, you may do so with `--out <directory>`, however note that performance is severely worse with the filesystem overhead.

Note: Once you are finished, you should delete the worker or unlist it from workers.dev [here](https://dash.cloudflare.com/?to=/:account/workers). Leaving it open might pose a security risk if someone unauthorized tries to export your keys using `dl.js`.
